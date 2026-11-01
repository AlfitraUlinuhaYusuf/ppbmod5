import { useState } from 'react'
import {
  Check,
  Copy,
  FileText,
  Heart,
  Pencil,
  Play,
  Shield,
  Trash2,
} from 'lucide-react'
import userService from '../services/userService'
import { useFavorites } from '../hooks/useFavorites'
import { deleteDraft, getAllDraftIds, getDraftTimestamp, loadDraft, formatDraftTime } from '../utils/draftStorage'
import { deleteCatalogDraft, getCatalogDrafts } from '../utils/catalogDraftStorage'

const readDrafts = () => [
  ...getAllDraftIds().map((id) => {
    const data = loadDraft(id)
    return {
      id,
      kind: 'form',
      name: data?.formData?.name || (id === 'create' ? 'Produk baru' : `Produk ${id}`),
      timestamp: getDraftTimestamp(id),
    }
  }),
  ...getCatalogDrafts().map((product) => ({
    id: product.id,
    kind: 'catalog',
    name: product.name || 'Produk katalog',
    product,
    timestamp: product.savedAt,
  })),
]

export default function ProfilePage({ onReplaySplash, onEditProfile, onResumeDraft }) {
  const [profile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)
  const [drafts, setDrafts] = useState(readDrafts)
  const { favorites } = useFavorites()

  const handleCopyId = async () => {
    if (!profile.userId) return
    try {
      await navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Unable to copy the profile identifier.', error)
    }
  }

  const handleDeleteDraft = (draft) => {
    const deleted = draft.kind === 'catalog'
      ? deleteCatalogDraft(draft.id)
      : deleteDraft(draft.id)
    if (deleted) setDrafts(readDrafts())
  }

  return (
    <div className="profile-page">
      <section className="masthead profile-masthead">
        <div>
          <h1 className="display">Profil Pengguna</h1>
          <p className="lede">Informasi profil dan preferensi demo Anda.</p>
        </div>
        <div className="profile-head-actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={onEditProfile}>
            <Pencil size={14} /> Edit profil
          </button>
          {onReplaySplash && (
            <button type="button" className="btn btn--outline btn--sm" onClick={onReplaySplash}>
              <Play size={14} /> Intro
            </button>
          )}
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder"><Shield size={36} stroke="var(--brass)" /></div>
            )}
          </div>
          <div className="profile-identity">
            <h2 className="display">{profile.username || 'Shooter'}</h2>
            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
              <button type="button" className="icon-btn" onClick={handleCopyId} title="Salin ID pengguna" aria-label="Salin ID pengguna">
                {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
              </button>
            </div>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>
        </div>
        <div className="profile-stats">
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Favorit</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{drafts.length}</div>
            <div className="stat-label">Draft tersimpan</div>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <h2 className="section-title">About</h2>
        <p>Bore &amp; Barrel adalah katalog demo akademik untuk latihan Progressive Web App.</p>
        <p>Data produk dan alur checkout ditampilkan sebagai simulasi, bukan transaksi nyata.</p>
      </section>

      <section className="profile-section">
        <h2 className="section-title">Contact</h2>
        <p>Alamat demo: 123 Range Road</p>
        <p>Jam layanan demo: Selasa–Sabtu, 10.00–18.00</p>
        <p>Telepon contoh: (555) 010-0100</p>
      </section>

      <section className="profile-section">
        <div className="list-head">
          <h2 className="section-title">Draft</h2>
          <span className="count">{drafts.length} draft</span>
        </div>
        {drafts.length === 0 ? (
          <p className="profile-empty">Belum ada draft tersimpan.</p>
        ) : (
          <ul className="draft-list">
            {drafts.map((draft) => (
              <li className="draft-item" key={`${draft.kind}-${draft.id}`}>
                <div>
                  <strong>{draft.name}</strong>
                  <span>{draft.kind === 'catalog' ? 'Disimpan dari katalog' : draft.id === 'create' ? 'Draft produk baru' : `Draft edit · ID: ${draft.id}`}</span>
                  <small>{draft.timestamp ? formatDraftTime(draft.timestamp) : 'Waktu tidak tersedia'}</small>
                </div>
                <div className="draft-actions">
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => onResumeDraft(draft)}>
                    {draft.kind === 'catalog' ? 'Lihat katalog' : 'Lanjutkan'}
                  </button>
                  <button type="button" className="icon-btn" onClick={() => handleDeleteDraft(draft)} aria-label={`Hapus draft ${draft.name}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
