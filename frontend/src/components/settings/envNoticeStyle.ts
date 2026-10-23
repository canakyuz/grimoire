import type { CSSProperties } from 'react'

/** The note under a setting that an environment variable has pinned. */
export const envNoticeStyle: CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: 6,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  fontSize: 13,
  color: 'var(--text-dim)',
  lineHeight: 1.5,
  maxWidth: '70ch',
}
