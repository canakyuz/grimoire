import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSearch, LuX } from 'react-icons/lu'
import {
  SETTINGS_AREAS,
  SETTINGS_ENTRIES,
  isAreaVisible,
  isEntryVisible,
  searchEntries,
} from './registry'
import type { AreaId, SearchableEntry, SettingsVisibility } from './registry'

export interface SettingsDestination {
  area: AreaId
  /** The section to scroll to; absent for an area itself. */
  hash?: string
}

interface SettingsSearchProps {
  visibility: SettingsVisibility
  onNavigate: (to: SettingsDestination) => void
}

/** True while focus is somewhere typing a `/` should type a `/`. */
function isEditing(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable === true
  )
}

/**
 * Find a setting by name, by what it does, or by the words people use for it
 * ("SSO", "dark mode"), from any area. `/` or Ctrl/⌘K focuses it from anywhere
 * on the settings page; arrows move through the results and Enter goes there.
 */
export default function SettingsSearch({ visibility, onNavigate }: SettingsSearchProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const searchable = useMemo<SearchableEntry[]>(() => {
    const areaTitle = (id: AreaId) => t(`settings.areas.${id}.title`)
    const keywords = (id: string) => t(`settings.keywords.${id}`, { defaultValue: '' })
    const areas = SETTINGS_AREAS.filter((a) => isAreaVisible(a, visibility)).map((a) => ({
      entry: { id: a.id, area: a.id, title: `settings.areas.${a.id}.title` },
      title: areaTitle(a.id),
      description: t(`settings.areas.${a.id}.description`),
      areaTitle: t(`settings.scopes.${a.scope}`),
      keywords: keywords(a.id),
    }))
    const entries = SETTINGS_ENTRIES.filter((e) => isEntryVisible(e, visibility)).map((e) => ({
      entry: e,
      title: t(e.title),
      description: e.description ? t(e.description) : '',
      areaTitle: areaTitle(e.area),
      keywords: keywords(e.id),
    }))
    return [...areas, ...entries]
  }, [t, visibility])

  const results = useMemo(() => searchEntries(query, searchable), [query, searchable])
  const showList = open && query.trim().length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
      if (shortcut || (slash && !isEditing(document.activeElement))) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (index: number) => {
    const hit = results[index]
    if (!hit) return
    const { entry } = hit
    const isArea = entry.id === entry.area
    onNavigate(isArea ? { area: entry.area } : { area: entry.area, hash: entry.id })
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(active)
    } else if (e.key === 'Escape') {
      if (query) setQuery('')
      else inputRef.current?.blur()
      setOpen(false)
    }
  }

  const optionId = (i: number) => `${listId}-option-${i}`

  return (
    <div className="settings-search">
      <LuSearch size={15} aria-hidden="true" className="settings-search-icon" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label={t('settings.search.label')}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results.length ? optionId(active) : undefined}
        placeholder={t('settings.search.placeholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        // Delayed so a click on a result lands before the list goes away.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {query ? (
        <button
          type="button"
          className="settings-search-clear"
          aria-label={t('settings.search.clear')}
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
        >
          <LuX size={14} aria-hidden="true" />
        </button>
      ) : (
        <kbd className="settings-search-hint" aria-hidden="true">
          /
        </kbd>
      )}
      <ul id={listId} role="listbox" className="settings-search-results" hidden={!showList}>
        {showList && results.length === 0 && (
          <li className="settings-search-empty" role="presentation">
            {t('settings.search.noResults', { query: query.trim() })}
          </li>
        )}
        {showList &&
          results.map((hit, i) => (
            <li
              key={hit.entry.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className="settings-search-option"
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(i)}
            >
              <span className="settings-search-option-title">{hit.title}</span>
              <span className="settings-search-option-path">
                {hit.entry.id === hit.entry.area
                  ? hit.areaTitle
                  : `${t(`settings.scopes.${scopeOf(hit.entry.area)}`)} › ${hit.areaTitle}`}
              </span>
            </li>
          ))}
      </ul>
      <p className="visually-hidden" role="status" aria-live="polite">
        {showList ? t('settings.search.resultCount', { count: results.length }) : ''}
      </p>
    </div>
  )
}

function scopeOf(area: AreaId) {
  return SETTINGS_AREAS.find((a) => a.id === area)?.scope ?? 'you'
}
