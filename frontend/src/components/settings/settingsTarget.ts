import { createContext, useContext } from 'react'

/**
 * The section a `/settings/<area>#<id>` link points at, shared down the area
 * page so the collapsible group holding it can open itself before the page
 * scrolls there.
 */
export interface SettingsTarget {
  id: string | null
  /** The group the target sits in (from the registry), opened alongside it. */
  group: string | null
  /** Changes on every arrival, so following the same link twice opens it again. */
  nonce: string
}

export const SettingsTargetContext = createContext<SettingsTarget>({
  id: null,
  group: null,
  nonce: '',
})

/** True when the anchor wrapping this component is the deep-link target. */
export const AnchorTargetContext = createContext(false)

export function useSettingsTarget(): SettingsTarget {
  return useContext(SettingsTargetContext)
}

/** Whether a group or section with this id should be open for the current link. */
export function useIsTargeted(id: string | undefined): boolean {
  const target = useSettingsTarget()
  return Boolean(id) && (target.id === id || target.group === id)
}
