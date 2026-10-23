import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsNav from './SettingsNav'
import type { Mock } from 'vitest'
import type { AreaId, SettingsVisibility } from './registry'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const ADMIN: SettingsVisibility = {
  isAdmin: true,
  apiKeys: true,
  apiKeysOnInstance: true,
  shareLinks: true,
  codex: false,
}

let onNavigate: Mock<(area: AreaId) => void>

function setup(current: AreaId = 'library', visibility = ADMIN) {
  render(
    // The rail renders at the area's own URL, which is what marks it current.
    <MemoryRouter initialEntries={[`/settings/${current}`]}>
      <SettingsNav current={current} visibility={visibility} onNavigate={onNavigate} />
    </MemoryRouter>
  )
}

const link = (area: string) => screen.getByRole('link', { name: `settings.areas.${area}.title` })

// Record whether a click was left to the browser, then stop jsdom trying to
// follow it (it can't navigate, and says so on the console).
let leftToBrowser: boolean | null
const settle = (e: Event) => {
  leftToBrowser = !e.defaultPrevented
  e.preventDefault()
}

beforeEach(() => {
  onNavigate = vi.fn()
  leftToBrowser = null
  document.addEventListener('click', settle)
})

afterEach(() => document.removeEventListener('click', settle))

describe('SettingsNav', () => {
  it('marks only the current area', () => {
    setup('library')
    expect(link('library')).toHaveAttribute('aria-current', 'page')
    expect(link('account')).not.toHaveAttribute('aria-current')
    expect(link('library')).toHaveAttribute('href', '/settings/library')
  })

  it('labels the two scopes for an admin', () => {
    setup()
    const you = screen.getByRole('list', { name: 'settings.scopes.you' })
    const server = screen.getByRole('list', { name: 'settings.scopes.server' })
    expect(within(you).getByRole('link', { name: 'settings.areas.account.title' })).toBeTruthy()
    expect(within(server).getByRole('link', { name: 'settings.areas.logs.title' })).toBeTruthy()
    expect(screen.getAllByRole('group')).toHaveLength(2)
  })

  it('shows a non-admin their own areas, unlabelled', () => {
    setup('account', { ...ADMIN, isAdmin: false })
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByText('settings.scopes.you')).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('hands a plain click to onNavigate instead of following the link', () => {
    setup()
    fireEvent.click(link('backups'))
    expect(leftToBrowser).toBe(false)
    expect(onNavigate).toHaveBeenCalledWith('backups')
  })

  it('lets a modified or middle click open a new tab as usual', () => {
    setup()
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      fireEvent.click(link('backups'), init)
      expect(leftToBrowser).toBe(true)
    }
    fireEvent.click(link('backups'), { button: 1 })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('navigates from the narrow-screen picker', () => {
    setup()
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('library')
    fireEvent.change(select, { target: { value: 'logs' } })
    expect(onNavigate).toHaveBeenCalledWith('logs')
  })
})
