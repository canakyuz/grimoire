import type { MouseEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SETTINGS_AREAS, isAreaVisible } from './registry'
import type { AreaId, SettingsScope, SettingsVisibility } from './registry'

interface SettingsNavProps {
  current: AreaId
  visibility: SettingsVisibility
  /** Called instead of following a link, so unsaved edits can be asked about first. */
  onNavigate: (area: AreaId) => void
}

const SCOPES: SettingsScope[] = ['you', 'server']

/**
 * The list of settings areas: a rail beside the page on wide screens, a
 * select above it on narrow ones (where a sideways-scrolling strip would hide
 * the current area off the edge).
 *
 * "You" holds everyone's own settings and "Server" the admin's. A player or GM
 * only has the first, so the scope labels are left off for them.
 */
export default function SettingsNav({ current, visibility, onNavigate }: SettingsNavProps) {
  const { t } = useTranslation()
  const areas = SETTINGS_AREAS.filter((a) => isAreaVisible(a, visibility))
  const scoped = SCOPES.map((scope) => ({
    scope,
    areas: areas.filter((a) => a.scope === scope),
  })).filter((g) => g.areas.length > 0)
  const labelled = scoped.length > 1

  const follow = (e: MouseEvent<HTMLAnchorElement>, area: AreaId) => {
    // Let modified clicks open a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onNavigate(area)
  }

  return (
    <nav className="settings-nav" aria-label={t('settings.nav.label')}>
      <div className="settings-nav-rail">
        {scoped.map(({ scope, areas: list }) => (
          <div key={scope} className="settings-nav-scope">
            {labelled && (
              <p className="settings-nav-scope-label" id={`settings-scope-${scope}`}>
                {t(`settings.scopes.${scope}`)}
              </p>
            )}
            <ul aria-labelledby={labelled ? `settings-scope-${scope}` : undefined}>
              {list.map((area) => (
                <li key={area.id}>
                  <NavLink
                    to={`/settings/${area.id}`}
                    className="settings-nav-link"
                    aria-current={area.id === current ? 'page' : undefined}
                    onClick={(e) => follow(e, area.id)}
                  >
                    {t(`settings.areas.${area.id}.title`)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <label className="settings-nav-select">
        <span className="visually-hidden">{t('settings.nav.label')}</span>
        <select value={current} onChange={(e) => onNavigate(e.target.value as AreaId)}>
          {scoped.map(({ scope, areas: list }) =>
            labelled ? (
              <optgroup key={scope} label={t(`settings.scopes.${scope}`)}>
                {list.map((area) => (
                  <option key={area.id} value={area.id}>
                    {t(`settings.areas.${area.id}.title`)}
                  </option>
                ))}
              </optgroup>
            ) : (
              list.map((area) => (
                <option key={area.id} value={area.id}>
                  {t(`settings.areas.${area.id}.title`)}
                </option>
              ))
            )
          )}
        </select>
      </label>
    </nav>
  )
}
