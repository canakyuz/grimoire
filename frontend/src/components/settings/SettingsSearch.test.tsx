import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SettingsSearch from './SettingsSearch'
import type { Mock } from 'vitest'
import type { SettingsDestination } from './SettingsSearch'
import type { SettingsVisibility } from './registry'

const WORDS: Record<string, string> = {
  'settings.search.label': 'Search settings',
  'settings.scopes.you': 'You',
  'settings.scopes.server': 'Server',
  'settings.areas.library.title': 'Library',
  'settings.areas.sign-in.title': 'Sign-in',
  'settings.areas.preferences.title': 'Preferences',
  'maintenance.watch.title': 'Watch for changes',
  'maintenance.scheduledRescan.title': 'Scheduled rescan',
  'maintenance.rescan.title': 'Rescan library',
  'authSettings.oidc.title': 'Single sign-on (OIDC)',
  'codex.settings.title': 'Grimoire Codex DB',
  'settings.entries.theme': 'Theme',
  'settings.keywords.oidc': 'sso, keycloak',
  'settings.keywords.theme': 'dark mode',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { defaultValue?: string; query?: string; count?: number }) => {
      if (k in WORDS) return WORDS[k]
      if (k === 'settings.search.noResults') return `no results for ${opts?.query}`
      if (k === 'settings.search.resultCount') return `${opts?.count} found`
      if (opts && 'defaultValue' in opts) return opts.defaultValue
      return k
    },
  }),
}))

const ADMIN: SettingsVisibility = {
  isAdmin: true,
  apiKeys: true,
  apiKeysOnInstance: true,
  shareLinks: true,
  codex: true,
}

let onNavigate: Mock<(to: SettingsDestination) => void>

function setup(visibility: SettingsVisibility = ADMIN) {
  render(
    <>
      <input aria-label="elsewhere" />
      <SettingsSearch visibility={visibility} onNavigate={onNavigate} />
    </>
  )
  return screen.getByRole('combobox', { name: 'Search settings' }) as HTMLInputElement
}

function type(input: HTMLInputElement, value: string) {
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
}

const titles = () => screen.queryAllByRole('option').map((o) => o.firstChild?.textContent)

beforeEach(() => {
  onNavigate = vi.fn()
})

describe('SettingsSearch', () => {
  it('lists matching settings with where they live', () => {
    const input = setup()
    type(input, 'watch')
    const option = screen.getByRole('option', { name: /Watch for changes/ })
    expect(option).toHaveTextContent('Server › Library')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('1 found')
  })

  it('goes to the highlighted result on Enter and clears itself', () => {
    const input = setup()
    type(input, 'watch')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledWith({ area: 'library', hash: 'watch' })
    expect(input.value).toBe('')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('moves through the results with the arrow keys, wrapping at the ends', () => {
    const input = setup()
    type(input, 'rescan')
    expect(titles()).toEqual(['Rescan library', 'Scheduled rescan'])
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledWith({ area: 'library', hash: 'scheduled-rescan' })
  })

  it('goes to an area itself without a section', () => {
    const input = setup()
    type(input, 'library')
    const [first] = screen.getAllByRole('option')
    expect(first).toHaveTextContent('Library')
    expect(first).toHaveTextContent('Server')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledWith({ area: 'library' })
  })

  it('goes to a result that is clicked, and highlights the one under the pointer', () => {
    const input = setup()
    type(input, 'rescan')
    const second = screen.getAllByRole('option')[1]
    fireEvent.mouseEnter(second)
    expect(second).toHaveAttribute('aria-selected', 'true')
    fireEvent.mouseDown(second)
    fireEvent.click(second)
    expect(onNavigate).toHaveBeenCalledWith({ area: 'library', hash: 'scheduled-rescan' })
  })

  it('finds a setting by the other words people use for it', () => {
    const input = setup()
    type(input, 'keycloak')
    expect(titles()).toEqual(['Single sign-on (OIDC)'])
    type(input, 'dark mode')
    expect(titles()).toEqual(['Theme'])
  })

  it('says so when nothing matches', () => {
    const input = setup()
    type(input, 'zzzz ')
    expect(screen.getByText('no results for zzzz')).toBeInTheDocument()
    // Arrows and Enter have nothing to act on.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('never offers what the person cannot see', () => {
    const input = setup({ ...ADMIN, isAdmin: false, codex: false })
    type(input, 'watch')
    expect(titles()).toEqual([])
    type(input, 'oidc')
    expect(titles()).toEqual([])
    type(input, 'theme')
    expect(titles()).toEqual(['Theme'])
  })

  it('hides Grimoire Codex DB while it is off', () => {
    const input = setup({ ...ADMIN, codex: false })
    type(input, 'codex')
    expect(titles()).toEqual([])
  })

  it('clears on the first Escape and lets go of focus on the second', () => {
    const input = setup()
    input.focus()
    type(input, 'watch')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(document.activeElement).not.toBe(input)
  })

  it('clears from the clear button and keeps focus', () => {
    const input = setup()
    type(input, 'watch')
    fireEvent.click(screen.getByRole('button', { name: 'settings.search.clear' }))
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })

  it('closes the list a moment after focus leaves', async () => {
    const input = setup()
    type(input, 'watch')
    fireEvent.blur(input)
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0))
    expect(input.value).toBe('watch')
  })

  it('focuses on / from the page', () => {
    const input = setup()
    const slash = new KeyboardEvent('keydown', { key: '/', cancelable: true })
    window.dispatchEvent(slash)
    expect(document.activeElement).toBe(input)
    expect(slash.defaultPrevented).toBe(true)
  })

  it('leaves / alone while typing in another field', () => {
    const input = setup()
    const other = screen.getByRole('textbox', { name: 'elsewhere' })
    other.focus()
    const slash = new KeyboardEvent('keydown', { key: '/', cancelable: true })
    window.dispatchEvent(slash)
    expect(document.activeElement).toBe(other)
    expect(slash.defaultPrevented).toBe(false)
    expect(document.activeElement).not.toBe(input)
  })

  it('focuses on Ctrl+K or Cmd+K even from another field', () => {
    const input = setup()
    screen.getByRole('textbox', { name: 'elsewhere' }).focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(document.activeElement).toBe(input)
    input.blur()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }))
    expect(document.activeElement).toBe(input)
  })

  it('ignores other keys', () => {
    setup()
    const key = new KeyboardEvent('keydown', { key: 'k', cancelable: true })
    window.dispatchEvent(key)
    expect(key.defaultPrevented).toBe(false)
  })
})
