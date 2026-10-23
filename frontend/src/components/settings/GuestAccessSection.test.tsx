import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GuestAccessSection from './GuestAccessSection'
import { settings as settingsApi } from '../../api'
import type { SettingsData } from './useInstantSettings'

vi.mock('../../api', () => ({
  settings: { get: vi.fn(), patch: vi.fn() },
}))

function mockSettings(overrides: Record<string, unknown> = {}) {
  vi.mocked(settingsApi.get).mockResolvedValue({
    guest_access_enabled: false,
    guest_access_env_locked: false,
    ...overrides,
  } as unknown as SettingsData)
  vi.mocked(settingsApi.patch).mockResolvedValue({} as SettingsData)
}

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GuestAccessSection', () => {
  it('renders its heading and description', async () => {
    mockSettings()
    render(<GuestAccessSection />)
    expect(screen.getByText('Guest Access')).toBeInTheDocument()
    expect(await screen.findByLabelText('Enable guest invite codes')).not.toBeChecked()
  })

  it('toggles guest access and says it saved', async () => {
    mockSettings()
    render(<GuestAccessSection />)
    fireEvent.click(await screen.findByLabelText('Enable guest invite codes'))
    await waitFor(() =>
      expect(settingsApi.patch).toHaveBeenCalledWith({ guest_access_enabled: true })
    )
    // The tick alone is silent to a screen reader; the status region says it.
    expect(await screen.findByRole('status')).toHaveTextContent('Saved')
    expect(screen.getByLabelText('Enable guest invite codes')).toBeChecked()
  })

  it('disables the guest toggle when guest access is env-locked', async () => {
    mockSettings({ guest_access_env_locked: true })
    render(<GuestAccessSection />)
    const checkbox = await screen.findByLabelText('Enable guest invite codes')
    expect(checkbox).toBeDisabled()
    expect(screen.getByText(/GUEST_ACCESS_ENABLED/)).toBeInTheDocument()
  })

  it('puts the box back and says why when the server refuses', async () => {
    mockSettings()
    vi.mocked(settingsApi.patch).mockRejectedValue(apiError(403, 'Admins only'))
    render(<GuestAccessSection />)
    const checkbox = await screen.findByLabelText('Enable guest invite codes')
    fireEvent.click(checkbox)

    // The wording (with the server's reason) is covered in useInstantSettings.test.
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Not saved - /)
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toHaveAccessibleDescription(/^Not saved - /)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('reports a network failure in plain words', async () => {
    mockSettings()
    vi.mocked(settingsApi.patch).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<GuestAccessSection />)
    const checkbox = await screen.findByLabelText('Enable guest invite codes')
    fireEvent.click(checkbox)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Not saved - the server couldn't be reached. Check your connection and try again."
    )
    expect(checkbox).not.toBeChecked()
  })

  it('offers a retry instead of guessing when the settings fail to load', async () => {
    vi.mocked(settingsApi.get).mockRejectedValueOnce(apiError(500, 'Database locked'))
    render(<GuestAccessSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Couldn't load these settings - /)
    expect(screen.queryByLabelText('Enable guest invite codes')).toBeNull()

    mockSettings({ guest_access_enabled: true })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Enable guest invite codes')).toBeChecked()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says the server could not be reached when loading fails offline', async () => {
    vi.mocked(settingsApi.get).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<GuestAccessSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load these settings - the server couldn't be reached. Check your connection and try again."
    )
  })
})
