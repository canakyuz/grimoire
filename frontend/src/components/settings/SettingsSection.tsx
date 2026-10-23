import type { ReactNode } from 'react'
import { AnchorTargetContext, useSettingsTarget } from './settingsTarget'

interface SettingsSectionProps {
  /** DOM id and deep-link hash - the registry entry's id. */
  id: string
  /** Given for sections that have no heading of their own. */
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
}

/**
 * One setting on an area page: the place a deep link scrolls to and flashes.
 *
 * Most section components draw their own heading, so this only adds one (as
 * an `<h3>`, below the group's `<h2>`) when `title` is given.
 */
export default function SettingsSection({
  id,
  title,
  description,
  children,
}: SettingsSectionProps) {
  const target = useSettingsTarget()
  return (
    <AnchorTargetContext.Provider value={target.id === id}>
      <section
        id={id}
        tabIndex={-1}
        className="settings-section"
        aria-labelledby={title ? `${id}-title` : undefined}
      >
        {title && (
          <h3 id={`${id}-title`} className="settings-section-title">
            {title}
          </h3>
        )}
        {description && <p className="settings-section-description">{description}</p>}
        {children}
      </section>
    </AnchorTargetContext.Provider>
  )
}
