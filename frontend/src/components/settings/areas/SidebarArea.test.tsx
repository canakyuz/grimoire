import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SidebarArea from './SidebarArea'

vi.mock('../../../api', () => ({
  settings: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

import { settings as settingsApi } from '../../../api'

const defaultSettings = {
  hide_maps: false,
  hide_tokens: false,
  hide_campaigns: false,
  show_stat_systems: true,
  show_stat_books: false,
  show_stat_pages: true,
  show_stat_maps: false,
  show_stat_tokens: false,
  show_stat_size: true,
  show_stat_library_size: false,
}

const get = vi.mocked(settingsApi.get)
const patch = vi.mocked(settingsApi.patch)

beforeEach(() => {
  vi.resetAllMocks()
  get.mockResolvedValue(defaultSettings as never)
  patch.mockResolvedValue({} as never)
})

describe('SidebarArea - stats', () => {
  it('renders every stat toggle label', async () => {
    render(<SidebarArea />)
    expect(await screen.findByLabelText('Systems')).toBeInTheDocument()
    for (const label of ['Books', 'Pages', 'Maps', 'Tokens', 'Books Size', 'Library Size']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  // Version is no longer a configurable stat; it is always shown in the sidebar.
  it('does not render a Version toggle', async () => {
    render(<SidebarArea />)
    await screen.findByLabelText('Systems')
    expect(screen.queryByLabelText('Version')).toBeNull()
  })

  it('reflects checked state from settings', async () => {
    render(<SidebarArea />)
    await waitFor(() => expect(screen.getByLabelText('Systems')).toBeChecked())
    expect(screen.getByLabelText('Books')).not.toBeChecked()
    expect(screen.getByLabelText('Pages')).toBeChecked()
  })

  it('saves the toggled value when a box is clicked', async () => {
    render(<SidebarArea />)
    fireEvent.click(await screen.findByLabelText('Books'))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ show_stat_books: true }))
  })

  it('dispatches grimoire:settings-changed after a successful save', async () => {
    const handler = vi.fn()
    window.addEventListener('grimoire:settings-changed', handler)
    render(<SidebarArea />)
    fireEvent.click(await screen.findByLabelText('Systems'))
    await waitFor(() => expect(handler).toHaveBeenCalledOnce())
    window.removeEventListener('grimoire:settings-changed', handler)
  })
})

describe('SidebarArea - visibility', () => {
  it('renders Hide Maps, Hide Tokens, and Hide Campaigns checkboxes', async () => {
    render(<SidebarArea />)
    expect(await screen.findByLabelText('Hide Maps')).not.toBeChecked()
    expect(screen.getByLabelText('Hide Tokens')).toBeInTheDocument()
    expect(screen.getByLabelText('Hide Campaigns')).toBeInTheDocument()
  })

  it('reflects checked state when hide_campaigns is true', async () => {
    get.mockResolvedValue({ ...defaultSettings, hide_campaigns: true } as never)
    render(<SidebarArea />)
    await waitFor(() => expect(screen.getByLabelText('Hide Campaigns')).toBeChecked())
  })

  it('saves hide_maps: true when Hide Maps is turned on', async () => {
    render(<SidebarArea />)
    fireEvent.click(await screen.findByLabelText('Hide Maps'))
    await waitFor(() => expect(patch).toHaveBeenCalledWith({ hide_maps: true }))
  })
})
