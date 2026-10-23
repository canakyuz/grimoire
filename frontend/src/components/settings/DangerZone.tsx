import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LuTriangleAlert } from 'react-icons/lu'

interface DangerZoneProps {
  id: string
  children?: ReactNode
}

/**
 * The bottom of an area page, set apart for what cannot be undone. Never
 * collapsible: an action this costly should always be seen for what it is
 * before it is reached, not discovered inside a group that happened to be open.
 */
export default function DangerZone({ id, children }: DangerZoneProps) {
  const { t } = useTranslation()
  return (
    <section id={id} tabIndex={-1} className="settings-danger" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="settings-danger-heading">
        <LuTriangleAlert size={16} aria-hidden="true" />
        {t('settings.dangerZone')}
      </h2>
      <div className="settings-stack">{children}</div>
    </section>
  )
}
