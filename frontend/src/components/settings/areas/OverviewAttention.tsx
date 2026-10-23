import type { ReactNode } from 'react'
import { LuCircleAlert } from 'react-icons/lu'

/** A part of an overview line that wants the admin to do something. */
export default function OverviewAttention({ children }: { children: ReactNode }) {
  return (
    <span className="settings-ledger-attention">
      <LuCircleAlert size={14} aria-hidden="true" />
      {children}
    </span>
  )
}
