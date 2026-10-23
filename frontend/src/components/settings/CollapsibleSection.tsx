import { useContext, useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { LuChevronDown, LuChevronRight } from 'react-icons/lu'
import { AnchorTargetContext, useIsTargeted, useSettingsTarget } from './settingsTarget'

interface CollapsibleSectionProps {
  /** DOM id and deep-link hash; a link to it, or to a section inside it, opens it. */
  id?: string
  title: ReactNode
  description?: ReactNode
  /** One line shown in place of the body while closed - a count, a status. */
  summary?: ReactNode
  storageKey?: string
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}

function readStored(storageKey: string | undefined, fallback: boolean): boolean {
  if (!storageKey) return fallback
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === null ? fallback : saved === '1'
  } catch {
    return fallback
  }
}

/**
 * A group of settings under a heading that opens and closes it. The open or
 * closed state is remembered per browser under `storageKey` when given.
 *
 * The heading is a real `<h2>` wrapping the toggle, so screen-reader heading
 * navigation walks the groups, and the sections inside (each an `<h3>`) sit
 * one level below them - in the outline and on screen.
 *
 * Grouping is deliberately one level deep: a group holds settings directly,
 * never further groups.
 */
export default function CollapsibleSection({
  id,
  title,
  description,
  summary,
  storageKey,
  defaultOpen = true,
  onOpenChange,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() => readStored(storageKey, defaultOpen))
  const autoId = useId()
  const headingId = `${id ?? autoId}-heading`
  const bodyId = `${id ?? autoId}-body`
  const linkedHere = useIsTargeted(id)
  const insideLinkedSection = useContext(AnchorTargetContext)
  const targeted = linkedHere || insideLinkedSection
  const { nonce } = useSettingsTarget()

  // A deep link into this group opens it without touching the remembered
  // state: arriving by link shouldn't change how the person left the page.
  useEffect(() => {
    if (targeted) {
      setOpen(true)
      onOpenChange?.(true)
    }
    // onOpenChange is a callback prop; re-running for a new identity would
    // reopen a group the person has just closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targeted, nonce])

  const toggle = () => {
    const next = !open
    setOpen(next)
    onOpenChange?.(next)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        // Private mode or blocked storage: the group still toggles, it just
        // won't be remembered.
      }
    }
  }

  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      className="settings-group"
      data-open={open}
      aria-labelledby={headingId}
    >
      <h2 className="settings-group-heading">
        <button
          type="button"
          id={headingId}
          onClick={toggle}
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
        >
          {open ? (
            <LuChevronDown size={18} aria-hidden="true" />
          ) : (
            <LuChevronRight size={18} aria-hidden="true" />
          )}
          <span>{title}</span>
        </button>
      </h2>
      {!open && summary && <p className="settings-group-summary">{summary}</p>}
      {open && (
        <div id={bodyId} className="settings-group-body">
          {description && <p className="settings-group-description">{description}</p>}
          {children}
        </div>
      )}
    </section>
  )
}
