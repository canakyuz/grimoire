import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface OverviewRowProps {
  label: string
  to: string
  linkLabel: string
  children: ReactNode
}

/** One line of the overview: what it is, how it stands, and where to change it. */
export default function OverviewRow({ label, to, linkLabel, children }: OverviewRowProps) {
  return (
    <div className="settings-ledger-row">
      <dt>{label}</dt>
      <dd className="settings-ledger-status">{children}</dd>
      <dd>
        <Link to={to} className="settings-ledger-link" aria-label={`${linkLabel}: ${label}`}>
          {linkLabel}
        </Link>
      </dd>
    </div>
  )
}
