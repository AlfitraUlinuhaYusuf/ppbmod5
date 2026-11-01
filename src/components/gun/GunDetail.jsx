import { useState } from 'react'
import { ArrowLeft, Star, Send, Loader, ShoppingCart, ThumbsDown, ThumbsUp, Pencil, Trash2, X, BookmarkPlus, Share2 } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import { useReviews, useCreateReview } from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import reviewService from '../../services/reviewService'
import ConfirmModal from '../modals/ConfirmModal'
import { formatPrice, averageRating } from '../../utils/helpers'

/**
 * Full-screen product detail view.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onBack    — return to catalog
 * @param {Function} [props.onEdit]  — navigate to edit page
 * @param {Function} [props.onDelete]— trigger delete flow
 */
export default function GunDetail({ gun, onBack, onEdit, onDelete, onAddToCart, onSaveDraft }) {
  const imageUrls = gun.image_urls?.length
    ? gun.image_urls
    : [gun.image_url || gun.image || '/guns/pistol.svg']
  const [selectedImage, setSelectedImage] = useState(0)
  const imgSrc = imageUrls[selectedImage] || imageUrls[0]
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  // Reviews
  const { reviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')
  const [editingReview, setEditingReview] = useState(null)
  const [deleteReviewTarget, setDeleteReviewTarget] = useState(null)
  const [reviewMutationLoading, setReviewMutationLoading] = useState(false)
  const [votingReviewId, setVotingReviewId] = useState(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [shareError, setShareError] = useState('')

  const avgRating = reviewsLoading ? (gun.average_rating || 0) : averageRating(reviews)
  const reviewCount = reviewsLoading ? (gun.review_count || reviews.length) : reviews.length

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }

    try {
      if (editingReview) {
        setReviewMutationLoading(true)
        await reviewService.updateReview(editingReview.id, getUserIdentifier(), {
          rating,
          comment: comment.trim(),
        })
        setReviewSuccess('Review updated.')
        setEditingReview(null)
      } else {
        const result = await createReview(gun.id, {
          user_identifier: getUserIdentifier(),
          rating,
          comment: comment.trim(),
        })
        if (!result) {
          setReviewError('Could not submit review. The server may be unavailable.')
          return
        }
        setReviewSuccess('Review submitted!')
      }
      setComment('')
      setRating(5)
      await refetchReviews()
    } catch (error) {
      setReviewError(error.message || 'Review could not be saved.')
    } finally {
      setReviewMutationLoading(false)
    }
  }

  const handleEditReview = (review) => {
    setEditingReview(review)
    setRating(Number(review.rating) || 5)
    setComment(review.comment || '')
    setReviewError('')
    setReviewSuccess('')
    document.querySelector('.review-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleDeleteReview = async () => {
    if (!deleteReviewTarget) return
    try {
      setReviewMutationLoading(true)
      setReviewError('')
      await reviewService.deleteReview(deleteReviewTarget.id, getUserIdentifier())
      setDeleteReviewTarget(null)
      setReviewSuccess('Review deleted.')
      await refetchReviews()
    } catch (error) {
      setReviewError(error.message || 'Review could not be deleted.')
    } finally {
      setReviewMutationLoading(false)
    }
  }

  const handleVote = async (review, vote) => {
    if (!review.can_vote || votingReviewId !== null) return
    try {
      setVotingReviewId(review.id)
      setReviewError('')
      await reviewService.setReviewVote(review.id, getUserIdentifier(), vote)
      await refetchReviews()
    } catch (error) {
      setReviewError(error.message || 'Your vote could not be saved.')
    } finally {
      setVotingReviewId(null)
    }
  }

  const cancelReviewEdit = () => {
    setEditingReview(null)
    setRating(5)
    setComment('')
    setReviewError('')
  }

  const handleShare = async () => {
    if (!gun.id) {
      setShareError('Produk ini tidak memiliki ID yang dapat dibagikan.')
      return
    }

    const shareUrl = new URL(window.location.href)
    shareUrl.searchParams.set('product', String(gun.id))
    const shareData = {
      title: gun.name,
      text: `Lihat ${gun.name} di katalog demo Bore & Barrel.`,
      url: shareUrl.toString(),
    }

    setShareError('')
    setShareMessage('')
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        setShareMessage('Link produk berhasil dibagikan.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url)
        setShareMessage('Link produk disalin. Silakan bagikan kepada orang lain.')
      } else {
        throw new Error('Browser ini tidak mendukung fitur berbagi atau salin link.')
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setShareError(error.message || 'Link produk gagal dibagikan.')
      }
    }
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {/* Hero */}
      <div className="detail-hero">
        <img className="detail-img" src={imgSrc} alt={gun.name} />
        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            <FavoriteButton gunId={gun.id || gun.name} />
            {onAddToCart && (
              <button type="button" className="btn btn--primary" onClick={() => onAddToCart(gun)}>
                <ShoppingCart size={16} /> Tambah ke keranjang demo
              </button>
            )}
            {onSaveDraft && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  const saved = onSaveDraft(gun)
                  setDraftSaved(Boolean(saved))
                  setDraftError(saved ? '' : 'Produk gagal disimpan ke Draft.')
                }}
              >
                <BookmarkPlus size={16} /> Simpan ke Draft
              </button>
            )}
            <button type="button" className="btn btn--outline" onClick={handleShare}>
              <Share2 size={16} /> Bagikan link
            </button>
            {onEdit && (
              <button type="button" className="btn btn--outline" onClick={() => onEdit(gun)}>
                Edit
              </button>
            )}
            {onDelete && (
              <button type="button" className="btn btn--danger" onClick={() => onDelete(gun)}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {imageUrls.length > 1 && (
        <div className="detail-gallery" aria-label="Galeri gambar produk">
          {imageUrls.map((url, index) => (
            <button
              type="button"
              key={`${url}-${index}`}
              className={`detail-gallery__thumb${selectedImage === index ? ' is-active' : ''}`}
              onClick={() => setSelectedImage(index)}
              aria-label={`Tampilkan gambar ${index + 1}`}
              aria-pressed={selectedImage === index}
            >
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {draftSaved && <p className="form-success" role="status">Produk disimpan ke Draft profil.</p>}
      {draftError && <p className="form-error" role="alert">{draftError}</p>}
      {shareMessage && <p className="form-success" role="status">{shareMessage}</p>}
      {shareError && <p className="form-error" role="alert">{shareError}</p>}

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications (from ingredients / steps if present) */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>
                {step.instruction || step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews</h2>

        {/* Submit review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <h3 className="section-title">{editingReview ? 'Edit your review' : 'Write a review'}</h3>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a short review (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || reviewMutationLoading || !gun.id}
          >
            {submitting || reviewMutationLoading ? (
              <><Loader size={16} className="spin" /> Saving…</>
            ) : (
              <><Send size={16} /> {editingReview ? 'Save Changes' : 'Submit Review'}</>
            )}
          </button>
          {editingReview && (
            <button type="button" className="btn btn--outline" onClick={cancelReviewEdit} disabled={reviewMutationLoading}>
              <X size={16} /> Cancel edit
            </button>
          )}

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
          {!gun.id && (
            <p className="form-hint">
              Reviews require a server-generated product ID. This product is local-only.
            </p>
          )}
        </form>

        {/* Existing reviews */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => (
              <li key={rev.id} className="review-item">
                <div className="review-head">
                  <span className="review-user">{rev.user_identifier || 'Anonymous'}</span>
                  <span className="review-stars-display">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < rev.rating ? 'var(--brass)' : 'none'}
                        stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                      />
                    ))}
                  </span>
                </div>
                {rev.comment && <p className="review-comment">{rev.comment}</p>}
                <div className="review-actions">
                  <button
                    type="button"
                    className={`review-vote-btn${rev.user_vote === 1 ? ' is-active' : ''}`}
                    onClick={() => handleVote(rev, 1)}
                    disabled={!rev.can_vote || votingReviewId !== null}
                    aria-label={`Thumbs up review by ${rev.user_identifier || 'Anonymous'}`}
                    aria-pressed={rev.user_vote === 1}
                    title={rev.can_vote ? 'Thumbs up' : 'Voting needs the review_votes backend table'}
                  >
                    <ThumbsUp size={16} /> <span>{rev.thumbs_up || 0}</span>
                  </button>
                  <button
                    type="button"
                    className={`review-vote-btn${rev.user_vote === -1 ? ' is-active' : ''}`}
                    onClick={() => handleVote(rev, -1)}
                    disabled={!rev.can_vote || votingReviewId !== null}
                    aria-label={`Thumbs down review by ${rev.user_identifier || 'Anonymous'}`}
                    aria-pressed={rev.user_vote === -1}
                    title={rev.can_vote ? 'Thumbs down' : 'Voting needs the review_votes backend table'}
                  >
                    <ThumbsDown size={16} /> <span>{rev.thumbs_down || 0}</span>
                  </button>
                  {rev.vote_storage === 'local' && (
                    <span className="form-hint">Vote tersimpan di browser ini saja sampai voting backend tersedia.</span>
                  )}
                  {rev.is_owner && (
                    <div className="review-owner-actions">
                      <button type="button" className="btn btn--outline btn--sm" onClick={() => handleEditReview(rev)} disabled={reviewMutationLoading}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button type="button" className="btn btn--danger-ghost" onClick={() => setDeleteReviewTarget(rev)} disabled={reviewMutationLoading} aria-label="Hapus review">
                        <Trash2 size={15} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteReviewTarget)}
        title="Delete review?"
        message="This review will be permanently deleted."
        confirmLabel="Delete review"
        danger
        loading={reviewMutationLoading}
        onConfirm={handleDeleteReview}
        onCancel={() => setDeleteReviewTarget(null)}
      />
    </div>
  )
}
