import { apiClient, IS_SUPABASE } from '../config/api'
import { getUserIdentifier } from './userService'

let supportsReviewVotes = null
const LOCAL_REVIEW_VOTES_KEY = 'bore_barrel_review_votes'

const isMissingVoteTable = (error) => {
  const message = `${error?.message || ''} ${JSON.stringify(error?.raw || '')}`.toLowerCase()
  return message.includes('review_votes') &&
    /(does not exist|could not find|unknown relation|schema cache)/.test(message)
}

const isUnsupportedVoteEndpoint = (error) => [404, 405, 501].includes(error?.status)

const getLocalReviewVotes = () => {
  let stored
  try {
    stored = localStorage.getItem(LOCAL_REVIEW_VOTES_KEY)
  } catch {
    throw new Error('Browser storage is unavailable; your vote could not be loaded.')
  }
  if (!stored) return []

  let votes
  try {
    votes = JSON.parse(stored)
  } catch {
    throw new Error("Saved review votes are invalid. Clear this browser's review vote data and try again.")
  }
  if (!Array.isArray(votes)) {
    throw new Error("Saved review votes are invalid. Clear this browser's review vote data and try again.")
  }
  return votes.filter((entry) =>
    entry &&
    (typeof entry.review_id === 'string' || typeof entry.review_id === 'number') &&
    typeof entry.user_id === 'string' &&
    (entry.vote === 1 || entry.vote === -1),
  )
}

const saveLocalReviewVotes = (votes) => {
  try {
    localStorage.setItem(LOCAL_REVIEW_VOTES_KEY, JSON.stringify(votes))
  } catch {
    throw new Error('Browser storage is unavailable; your vote could not be saved.')
  }
}

const setLocalReviewVote = (reviewId, userId, vote) => {
  if (vote !== 1 && vote !== -1) {
    throw new Error('Vote must be thumbs up (1) or thumbs down (-1).')
  }
  const votes = getLocalReviewVotes()
  const existing = votes.find((entry) =>
    String(entry.review_id) === String(reviewId) && entry.user_id === userId,
  )
  const nextVote = existing?.vote === vote ? null : vote
  const nextVotes = votes.filter((entry) =>
    String(entry.review_id) !== String(reviewId) || entry.user_id !== userId,
  )
  if (nextVote !== null) {
    nextVotes.push({ review_id: reviewId, user_id: userId, vote: nextVote })
  }
  saveLocalReviewVotes(nextVotes)
  return { success: true, data: { vote: nextVote } }
}

// ---------------------------------------------------------------------------
// ReviewService — product reviews & ratings.
// Supports both Supabase (public.reviews) and university API (/api/v1/recipes/:id/reviews).
// ---------------------------------------------------------------------------

class ReviewService {
  /**
   * Fetch all reviews for a given product.
   */
  async getReviews(gunId) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(
        `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
      )
      const rows = Array.isArray(data) ? data : []
      let votes = []
      if (rows.length > 0 && supportsReviewVotes !== false) {
        const reviewIds = rows.map((review) => review.id)
        const idList = reviewIds.map((id) => encodeURIComponent(String(id))).join(',')
        try {
          votes = await apiClient.get(
            `/rest/v1/review_votes?review_id=in.(${idList})&select=review_id,user_id,vote`,
          )
          supportsReviewVotes = true
        } catch (error) {
          if (!isMissingVoteTable(error)) throw error
          supportsReviewVotes = false
          console.warn('Supabase review_votes table is missing; votes will be stored in this browser until migrated.')
        }
      }

      if (supportsReviewVotes === false) {
        votes = getLocalReviewVotes()
      }

      const userId = getUserIdentifier()
      const voteSummary = new Map()
      for (const vote of Array.isArray(votes) ? votes : []) {
        const summary = voteSummary.get(String(vote.review_id)) || { up: 0, down: 0, current: null }
        const value = Number(vote.vote)
        if (value === 1) summary.up += 1
        if (value === -1) summary.down += 1
        if (String(vote.user_id) === userId) summary.current = value
        voteSummary.set(String(vote.review_id), summary)
      }

      const list = rows.map((r) => {
        const summary = voteSummary.get(String(r.id)) || { up: 0, down: 0, current: null }
        return {
            id: r.id,
            product_id: r.product_id,
            user_identifier: r.user_id ? `Operator ${String(r.user_id).substring(0, 8)}` : 'Anonymous',
            is_owner: String(r.user_id) === userId,
            rating: r.rating,
            comment: r.comment || '',
            created_at: r.created_at,
            updated_at: r.updated_at,
            thumbs_up: summary.up,
            thumbs_down: summary.down,
            user_vote: summary.current,
            can_vote: true,
            vote_storage: supportsReviewVotes === false ? 'local' : 'backend',
          }
      })

      return { success: true, data: list }
    }

    const response = await apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
    const userId = getUserIdentifier()
    if (Array.isArray(response?.data)) {
      const needsLocalVotes = supportsReviewVotes === false ||
        response.data.some((review) => review.can_vote === false)
      if (needsLocalVotes) supportsReviewVotes = false
      const localVotes = needsLocalVotes ? getLocalReviewVotes() : []
      response.data = response.data.map((review) => ({
        ...review,
        is_owner: review.is_owner ?? String(review.user_id || review.user_identifier) === userId,
        thumbs_up: needsLocalVotes
          ? localVotes.filter((vote) => String(vote.review_id) === String(review.id) && vote.vote === 1).length
          : Number(review.thumbs_up) || 0,
        thumbs_down: needsLocalVotes
          ? localVotes.filter((vote) => String(vote.review_id) === String(review.id) && vote.vote === -1).length
          : Number(review.thumbs_down) || 0,
        user_vote: needsLocalVotes
          ? localVotes.find((vote) => String(vote.review_id) === String(review.id) && vote.user_id === userId)?.vote ?? null
          : review.user_vote ?? null,
        can_vote: true,
        vote_storage: needsLocalVotes ? 'local' : 'backend',
      }))
    }
    return response
  }

  /**
   * Submit a new review.
   * @param {string|number} gunId
   * @param {Object} reviewData  { user_identifier, rating, comment }
   */
  async createReview(gunId, reviewData) {
    if (IS_SUPABASE) {
      const payload = {
        product_id: Number(gunId),
        user_id: reviewData.user_id || reviewData.user_identifier,
        rating: Number(reviewData.rating),
        comment: reviewData.comment || '',
      }

      const res = await apiClient.post('/rest/v1/reviews', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      return {
        success: true,
        data: {
          ...created,
          user_identifier: `Operator ${String(created?.user_id || payload.user_id).substring(0, 8)}`,
          is_owner: true,
          thumbs_up: 0,
          thumbs_down: 0,
          user_vote: null,
          can_vote: true,
          vote_storage: supportsReviewVotes === false ? 'local' : 'backend',
        },
      }
    }

    return apiClient.post(`/api/v1/recipes/${gunId}/reviews`, {
      ...reviewData,
      user_identifier: reviewData.user_identifier || getUserIdentifier(),
    })
  }

  /**
   * Edit an existing review.
   */
  async updateReview(reviewId, userId, reviewData) {
    if (IS_SUPABASE) {
      const res = await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}&user_id=eq.${userId}`,
        {
          rating: Number(reviewData.rating),
          comment: reviewData.comment,
        },
        { headers: { Prefer: 'return=representation' } },
      )
      if (!Array.isArray(res) || res.length === 0) {
        throw new Error('Review not found or you do not have permission to edit it.')
      }
      return { success: true, data: res[0] }
    }

    return apiClient.put(`/api/v1/reviews/${reviewId}`, {
      ...reviewData,
      user_identifier: userId,
    })
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId, userId) {
    if (IS_SUPABASE) {
      const deleted = await apiClient.delete(
        `/rest/v1/reviews?id=eq.${reviewId}&user_id=eq.${userId}`,
        { headers: { Prefer: 'return=representation' } },
      )
      if (!Array.isArray(deleted) || deleted.length === 0) {
        throw new Error('Review not found or you do not have permission to delete it.')
      }
      return { success: true }
    }

    return apiClient.delete(`/api/v1/reviews/${reviewId}`, {
      params: { user_identifier: userId },
    })
  }

  async setReviewVote(reviewId, userId, vote) {
    if (IS_SUPABASE) {
      if (supportsReviewVotes === false) {
        return setLocalReviewVote(reviewId, userId, vote)
      }
      const query = `/rest/v1/review_votes?review_id=eq.${reviewId}&user_id=eq.${userId}`
      try {
        const existing = await apiClient.get(`${query}&select=vote`)
        const currentVote = Array.isArray(existing) ? Number(existing[0]?.vote) || null : null
        if (currentVote === vote) {
          await apiClient.delete(query)
          return { success: true, data: { vote: null } }
        }
        if (currentVote) {
          const updated = await apiClient.patch(query, { vote }, {
            headers: { Prefer: 'return=representation' },
          })
          return { success: true, data: { vote: Array.isArray(updated) ? Number(updated[0]?.vote) : vote } }
        }
        await apiClient.post('/rest/v1/review_votes', {
          review_id: reviewId,
          user_id: userId,
          vote,
        }, {
          headers: { Prefer: 'return=minimal' },
        })
        return { success: true, data: { vote } }
      } catch (error) {
        if (!isMissingVoteTable(error)) throw error
        supportsReviewVotes = false
        console.warn('Supabase review_votes table is missing; votes will be stored in this browser until migrated.')
        return setLocalReviewVote(reviewId, userId, vote)
      }
    }

    if (supportsReviewVotes === false) {
      return setLocalReviewVote(reviewId, userId, vote)
    }

    try {
      return await apiClient.post(`/api/v1/reviews/${reviewId}/vote`, {
        user_identifier: userId,
        vote,
      })
    } catch (error) {
      if (!isUnsupportedVoteEndpoint(error)) throw error
      supportsReviewVotes = false
      return setLocalReviewVote(reviewId, userId, vote)
    }
  }
}

export default new ReviewService()
