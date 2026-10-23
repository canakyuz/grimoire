import type { CSSProperties } from 'react'

// The two hosts' own section idioms: the book editor's Versions heading and
// 12px field labels, and the system editor's 14px muted section labels. A
// hairline above sets it apart from the fields, as the Versions rows do.
//
// The heading is an h4 for the outline but must not look like one: the global
// h1-h4 rule makes headings gold Cinzel, which no neighbouring section uses.
const headingReset: CSSProperties = { fontFamily: 'inherit', letterSpacing: 'normal' }
const divider: CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 14 }

export interface PanelScale {
  section: CSSProperties
  heading: CSSProperties
  text: CSSProperties
  label: CSSProperties
  radius: number
}

export const COMPACT: PanelScale = {
  section: { ...divider, marginTop: 20 },
  heading: {
    ...headingReset,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '0 0 4px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  },
  text: { fontSize: 12 },
  label: { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 3 },
  radius: 5,
}

export const REGULAR: PanelScale = {
  section: { ...divider, marginTop: 16, marginBottom: 8 },
  heading: {
    ...headingReset,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '0 0 6px',
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  text: { fontSize: 13 },
  label: { fontSize: 14, color: 'var(--text-muted)', display: 'block', marginBottom: 4 },
  radius: 6,
}

export const link: CSSProperties = {
  color: 'var(--gold)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

export const actionRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
  marginTop: 10,
}

export const button = (s: PanelScale, busy: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  borderRadius: s.radius,
  background: 'none',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 13,
  cursor: busy ? 'default' : 'pointer',
  opacity: busy ? 0.6 : 1,
})

// Outlined rather than filled: the editor's Save sits just below, and it stays
// the one filled gold button so the two forms never read as one. Dimmed, not
// recoloured, while it cannot send.
export const primary = (s: PanelScale, enabled: boolean): CSSProperties => ({
  padding: '6px 14px',
  borderRadius: s.radius,
  background: 'none',
  border: '1px solid var(--gold-dim)',
  color: 'var(--gold)',
  fontSize: 13,
  fontWeight: 600,
  cursor: enabled ? 'pointer' : 'default',
  opacity: enabled ? 1 : 0.5,
})

export const checkRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
}

export const accent: CSSProperties = { accentColor: 'var(--gold)', marginTop: 3 }
