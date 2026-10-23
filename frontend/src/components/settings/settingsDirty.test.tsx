import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { SettingsDirtyContext, useUnsavedChanges } from './settingsDirty'
import type { DirtyRegistry } from './settingsDirty'

function Section({ id, dirty }: { id: string; dirty: boolean }) {
  useUnsavedChanges(id, dirty)
  return null
}

describe('useUnsavedChanges', () => {
  it('reports edits as they come and go, and clears them on unmount', () => {
    const registry: DirtyRegistry = { set: vi.fn() }
    const tree = (dirty: boolean) => (
      <SettingsDirtyContext.Provider value={registry}>
        <Section id="schedule" dirty={dirty} />
      </SettingsDirtyContext.Provider>
    )
    const { rerender, unmount } = render(tree(false))
    expect(registry.set).toHaveBeenLastCalledWith('schedule', false)

    rerender(tree(true))
    expect(registry.set).toHaveBeenLastCalledWith('schedule', true)

    unmount()
    expect(registry.set).toHaveBeenLastCalledWith('schedule', false)
  })

  it('does nothing outside Settings', () => {
    expect(() => render(<Section id="schedule" dirty />).unmount()).not.toThrow()
  })
})
