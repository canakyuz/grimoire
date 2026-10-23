import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DangerZone from './DangerZone'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

describe('DangerZone', () => {
  it('sets its contents apart under a heading that is always shown', () => {
    render(
      <DangerZone id="library-danger">
        <p>cleanup</p>
      </DangerZone>
    )
    const zone = screen.getByRole('region', { name: 'settings.dangerZone' })
    expect(zone).toHaveAttribute('id', 'library-danger')
    expect(zone).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'library-danger-heading'
    )
    expect(zone).toContainElement(screen.getByText('cleanup'))
    // Never collapsible.
    expect(screen.queryByRole('button')).toBeNull()
  })
})
