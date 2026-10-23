import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PasswordAuthSection from './PasswordAuthSection'
import { settings as settingsApi } from '../../api'
import type { SettingsData } from './useInstantSettings'

vi.mock('../../api', () => ({
  settings: { get: vi.fn(), patch: vi.fn() },
}))

function mockSettings(overrides: Record<string, unknown> = {}) {
  vi.mocked(settingsApi.get).mockResolvedValue({
    password_auth_enabled: true,
    password_auth_env_locked: false,
    ...overrides,
  } as unknown as SettingsData)
  vi.mocked(settingsApi.patch).mockResolvedValue({} as SettingsData)
}

const LABEL = 'Enable password authentication'

function renderSection() {
  render(
    <MemoryRouter>
      <PasswordAuthSection />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PasswordAuthSection', () => {
  it('renders its heading and the current value', async () => {
    mockSettings()
    renderSection()
    expect(screen.getByText('Password Authentication')).toBeInTheDocument()
    expect(await screen.findByLabelText(LABEL)).toBeChecked()
  })

  it('asks before turning password sign-in off', async () => {
    mockSettings()
    renderSection()
    fireEvent.click(await screen.findByLabelText(LABEL))

    const dialog = await screen.findByRole('dialog', {
      name: 'Turn off password sign-in?',
    })
    expect(dialog).toHaveTextContent(
      'Everyone, admins included, will have to sign in with single sign-on. If single sign-on stops working, set the ALLOW_PASSWORD_AUTHENTICATION environment variable to true and restart Grimoire to turn password sign-in back on.'
    )
    expect(settingsApi.patch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(LABEL)).toBeChecked()
  })

  it('turns it off once confirmed', async () => {
    mockSettings()
    renderSection()
    fireEvent.click(await screen.findByLabelText(LABEL))
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off password sign-in' }))
    await waitFor(() =>
      expect(settingsApi.patch).toHaveBeenCalledWith({ password_auth_enabled: false })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('status')).toHaveTextContent('Saved')
    expect(screen.getByLabelText(LABEL)).not.toBeChecked()
    // The box was disabled while saving; focus comes back to it afterwards.
    await waitFor(() => expect(screen.getByLabelText(LABEL)).toHaveFocus())
  })

  it('leaves it on when the confirmation is cancelled', async () => {
    mockSettings()
    renderSection()
    fireEvent.click(await screen.findByLabelText(LABEL))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(settingsApi.patch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(LABEL)).toBeChecked()
  })

  it('turns it back on without asking', async () => {
    mockSettings({ password_auth_enabled: false })
    renderSection()
    fireEvent.click(await screen.findByLabelText(LABEL))
    await waitFor(() =>
      expect(settingsApi.patch).toHaveBeenCalledWith({ password_auth_enabled: true })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('puts it back on when turning it off fails', async () => {
    mockSettings()
    vi.mocked(settingsApi.patch).mockRejectedValue(
      Object.assign(new Error('Set up single sign-on first'), { status: 400 })
    )
    renderSection()
    fireEvent.click(await screen.findByLabelText(LABEL))
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off password sign-in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Not saved - /)
    expect(screen.getByLabelText(LABEL)).toBeChecked()
  })

  it('will not turn it off while single sign-on is not set up', async () => {
    mockSettings({ oidc_configured: false })
    renderSection()
    const checkbox = await screen.findByLabelText(LABEL)
    expect(checkbox).toBeDisabled()
    expect(
      screen.getByText(
        /Password\ sign\-in\ can't\ be\ turned\ off\ until\ single\ sign\-on\ is\ set\ up\ \-\ otherwise\ nobody\ could\ sign\ in\./
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up single sign-on first' })).toHaveAttribute(
      'href',
      '/settings/sign-in#oidc'
    )
  })

  it('can still turn it on while single sign-on is not set up', async () => {
    mockSettings({ password_auth_enabled: false, oidc_configured: false })
    renderSection()
    const checkbox = await screen.findByLabelText(LABEL)
    expect(checkbox).not.toBeDisabled()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('allows turning it off when single sign-on is set up', async () => {
    mockSettings({ oidc_configured: true })
    renderSection()
    expect(await screen.findByLabelText(LABEL)).not.toBeDisabled()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('disables the password toggle and shows a notice when env-locked', async () => {
    mockSettings({ password_auth_env_locked: true, oidc_configured: false })
    renderSection()
    const checkbox = await screen.findByLabelText(LABEL)
    expect(checkbox).toBeDisabled()
    expect(screen.getByText(/ALLOW_PASSWORD_AUTHENTICATION/)).toBeInTheDocument()
    // The env notice already explains why; no second note on top of it.
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('offers a retry when the settings fail to load', async () => {
    vi.mocked(settingsApi.get).mockRejectedValue(new Error('boom'))
    renderSection()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load these settings - the server couldn't be reached. Check your connection and try again."
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
