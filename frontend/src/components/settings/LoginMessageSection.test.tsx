import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginMessageSection from './LoginMessageSection'
import { settings as settingsApi } from '../../api'
import { SettingsDirtyContext } from './settingsDirty'
import type { SettingsData } from './useInstantSettings'

vi.mock('../../api', () => ({
  settings: { get: vi.fn(), patch: vi.fn() },
}))

vi.mock('./RichTextEditor', () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string
    onChange: (v: string) => void
    ariaLabel: string
  }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

function mockSettings(overrides: Record<string, unknown> = {}) {
  vi.mocked(settingsApi.get).mockResolvedValue({
    custom_login_message_enabled: false,
    custom_login_message: '',
    ...overrides,
  } as unknown as SettingsData)
  vi.mocked(settingsApi.patch).mockResolvedValue({} as SettingsData)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginMessageSection', () => {
  it('renders its heading and hides the editor while the message is off', async () => {
    mockSettings()
    render(<LoginMessageSection />)
    expect(screen.getByText('Custom Login Message')).toBeInTheDocument()
    expect(await screen.findByLabelText('Show custom message on login')).not.toBeChecked()
    expect(screen.queryByLabelText('Custom login message')).toBeNull()
  })

  it('enabling the custom message toggle persists the flag and shows the editor', async () => {
    mockSettings()
    render(<LoginMessageSection />)
    fireEvent.click(await screen.findByLabelText('Show custom message on login'))
    await waitFor(() =>
      expect(settingsApi.patch).toHaveBeenCalledWith({ custom_login_message_enabled: true })
    )
    expect(await screen.findByLabelText('Custom login message')).toBeInTheDocument()
  })

  it('reveals the editor when the custom message is enabled and saves edits', async () => {
    mockSettings({ custom_login_message_enabled: true, custom_login_message: 'Welcome' })
    render(<LoginMessageSection />)

    const editor = await screen.findByLabelText('Custom login message')
    expect(editor).toHaveValue('Welcome')

    // Save is disabled until the draft becomes dirty.
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).toBeDisabled()

    fireEvent.change(editor, { target: { value: 'Welcome, adventurers' } })
    expect(saveBtn).not.toBeDisabled()
    fireEvent.click(saveBtn)

    await waitFor(() =>
      expect(settingsApi.patch).toHaveBeenCalledWith({
        custom_login_message: 'Welcome, adventurers',
      })
    )
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByLabelText('Custom login message')).toHaveValue('Welcome, adventurers')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('editing back to the saved text is not an unsaved change', async () => {
    mockSettings({ custom_login_message_enabled: true, custom_login_message: 'Welcome' })
    render(<LoginMessageSection />)
    const editor = await screen.findByLabelText('Custom login message')
    fireEvent.change(editor, { target: { value: 'Welcome!' } })
    fireEvent.change(editor, { target: { value: 'Welcome' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('keeps the draft and says why when saving the text fails', async () => {
    mockSettings({ custom_login_message_enabled: true, custom_login_message: 'Welcome' })
    vi.mocked(settingsApi.patch).mockRejectedValue(
      Object.assign(new Error('Message too long'), { status: 422 })
    )
    render(<LoginMessageSection />)
    const editor = await screen.findByLabelText('Custom login message')
    fireEvent.change(editor, { target: { value: 'A very long message' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Not saved - /)
    expect(screen.getByLabelText('Custom login message')).toHaveValue('A very long message')
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('reports unsaved text so Settings can ask before leaving', async () => {
    mockSettings({ custom_login_message_enabled: true, custom_login_message: 'Welcome' })
    const set = vi.fn()
    render(
      <SettingsDirtyContext.Provider value={{ set }}>
        <LoginMessageSection />
      </SettingsDirtyContext.Provider>
    )
    const editor = await screen.findByLabelText('Custom login message')
    expect(set).toHaveBeenLastCalledWith('login-message', false)

    fireEvent.change(editor, { target: { value: 'Hello' } })
    await waitFor(() => expect(set).toHaveBeenLastCalledWith('login-message', true))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(set).toHaveBeenLastCalledWith('login-message', false))
  })

  it('puts the switch back when it fails to save', async () => {
    mockSettings()
    vi.mocked(settingsApi.patch).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<LoginMessageSection />)
    const checkbox = await screen.findByLabelText('Show custom message on login')
    fireEvent.click(checkbox)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Not saved - the server couldn't be reached. Check your connection and try again."
    )
    expect(checkbox).not.toBeChecked()
    expect(screen.queryByLabelText('Custom login message')).toBeNull()
  })

  it('offers a retry when the settings fail to load', async () => {
    vi.mocked(settingsApi.get).mockRejectedValue(new Error('boom'))
    render(<LoginMessageSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load these settings - the server couldn't be reached. Check your connection and try again."
    )
  })
})
