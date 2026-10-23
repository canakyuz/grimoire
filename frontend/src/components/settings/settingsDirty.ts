import { createContext, useContext, useEffect } from 'react'

/**
 * Sections with a Save button report whether they hold edits that haven't
 * been saved, so Settings can ask before the person moves to another area and
 * the section unmounts with them.
 */
export interface DirtyRegistry {
  set: (id: string, dirty: boolean) => void
}

export const SettingsDirtyContext = createContext<DirtyRegistry | null>(null)

export function useUnsavedChanges(id: string, dirty: boolean): void {
  const registry = useContext(SettingsDirtyContext)
  useEffect(() => {
    registry?.set(id, dirty)
    return () => registry?.set(id, false)
  }, [registry, id, dirty])
}
