import { useState } from 'react'
import { ArrowLeft, Camera, Save, Shield } from 'lucide-react'
import userService from '../services/userService'

export default function ProfileEditPage({ onBack, onSuccess }) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [error, setError] = useState('')

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setError('Pilih gambar dengan ukuran maksimal 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setProfile((current) => ({ ...current, avatar: reader.result }))
    reader.onerror = () => setError('Gambar gagal dibaca.')
    reader.readAsDataURL(file)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const result = userService.saveUserProfile({
      ...profile,
      username: profile.username.trim() || 'Shooter',
      bio: profile.bio.trim(),
    })
    if (!result.success) {
      setError(result.message || 'Profil gagal disimpan.')
      return
    }
    onSuccess?.()
  }

  return (
    <div className="form-page">
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}><ArrowLeft size={18} /> Kembali ke profil</button>
      </div>
      <div className="form-title-group">
        <h1 className="display">Edit Profil</h1>
        <p className="lede">Perbarui nama tampilan, bio, dan avatar.</p>
      </div>
      {error && <div className="toast toast--error" role="alert">{error}</div>}
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-edit-avatar">
          {profile.avatar
            ? <img src={profile.avatar} alt="Avatar profil" className="avatar-img" />
            : <div className="avatar-placeholder"><Shield size={36} stroke="var(--brass)" /></div>}
          <label htmlFor="profile-avatar" className="btn btn--outline btn--sm">
            <Camera size={14} /> Pilih avatar
            <input id="profile-avatar" className="hidden-file-input" type="file" accept="image/*" onChange={handleAvatarChange} />
          </label>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-name">Nama tampilan</label>
          <input id="profile-name" className="form-input" value={profile.username || ''} maxLength={60} onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-bio">About / bio</label>
          <textarea id="profile-bio" className="form-textarea" rows={4} maxLength={500} value={profile.bio || ''} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} />
        </div>
        <div className="form-actions-bar">
          <button type="button" className="btn btn--outline" onClick={onBack}>Batal</button>
          <button type="submit" className="btn btn--primary"><Save size={16} /> Simpan profil</button>
        </div>
      </form>
    </div>
  )
}
