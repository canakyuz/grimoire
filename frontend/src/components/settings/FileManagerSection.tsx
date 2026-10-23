import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LuArrowRight, LuFolderTree } from 'react-icons/lu'

/**
 * Entry point to the library file manager (issue #302).
 *
 * A link rather than an embedded panel: the manager is a two-pane view that
 * wants the full window, and keeping it off the settings page means an
 * accidental drag while changing an unrelated setting cannot move library
 * files. A router link, so opening it stays inside the app.
 */
export default function FileManagerSection() {
  const { t } = useTranslation()

  return (
    <div>
      <h3 style={{ marginBottom: 6 }}>{t('files.title')}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.6 }}>
        {t('files.sectionDescription')}
      </p>
      <Link
        to="/settings/files"
        style={linkStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-card-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-card)'
        }}
      >
        <LuFolderTree size={15} aria-hidden="true" />
        {t('files.open')}
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
