import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StatsDisplaySection from './StatsDisplaySection'
import { settings as settingsApi } from '../../api'
import type { SettingsData } from './useInstantSettings'

vi.mock('../../api', () => ({
  settings: { get: vi.fn(), patch: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(settingsApi.get).mockResolvedValue({
    show_stat_systems: true,
    show_stat_books: false,
  } as unknown as SettingsData)
  vi.mocked(settingsApi.patch).mockResolvedValue({} as SettingsData)
})

describe('StatsDisplaySection', () => {
  it('shows every stat with its stored value, missing ones as off', async () => {
    render(<StatsDisplaySection />)
    expect(await screen.findByLabelText('Systems')).toBeChecked()
    expect(screen.getByLabelText('Books')).not.toBeChecked()
    expect(screen.getByLabelText('Library Size')).not.toBeChecked()
  })

  it('saves a change and tells the sidebar', async () => {
    const handler = vi.fn()
    window.addEventListener('grimoire:settings-changed', handler)
    render(<StatsDisplaySection />)
    fireEvent.click(await screen.findByLabelText('Books'))
    await waitFor(() => expect(settingsApi.patch).toHaveBeenCalledWith({ show_stat_books: true }))
    await waitFor(() => expect(handler).toHaveBeenCalledOnce())
    window.removeEventListener('grimoire:settings-changed', handler)
  })

  it('puts the box back when saving fails', async () => {
    vi.mocked(settingsApi.patch).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<StatsDisplaySection />)
    const box = await screen.findByLabelText('Systems')
    fireEvent.click(box)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Not saved - the server couldn't be reached. Check your connection and try again."
    )
    expect(box).toBeChecked()
  })

  it('offers a retry when the settings fail to load', async () => {
    vi.mocked(settingsApi.get).mockRejectedValue(new Error('boom'))
    render(<StatsDisplaySection />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load these settings - the server couldn't be reached. Check your connection and try again."
    )
  })
})
