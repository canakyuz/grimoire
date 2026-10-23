import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LuArrowRight, LuCopy } from 'react-icons/lu'

/**
 * Entry point to duplicate detection.
 *
 * A link rather than an embedded panel, for the same reasons as
 * {@link FileManagerSection}: reviewing duplicate groups wants the full window,
 * and keeping the delete/merge actions off the settings page means an
 * accidental click while changing an unrelated setting cannot remove a file.
 */
export default function DuplicatesSection() {
  const { t } = useTranslation()

  return (
    <div>
      <h3 style={{ marginBottom: 6 }}>{t('maintenance.dupes.title')}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
        {t('maintenance.dupes.description')}
      </p>
      <Link
        to="/settings/duplicates"
        style={linkStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-card-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-card)'
        }}
      >
        <LuCopy size={15} aria-hidden="true" />
        {t('maintenance.dupes.open')}
        <LuArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  )
}

const linkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 18px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  textDecoration: 'none',
  transition: 'background 0.15s',
}
