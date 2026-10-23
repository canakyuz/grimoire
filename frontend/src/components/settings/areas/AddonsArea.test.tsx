import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddonsArea from './AddonsArea'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

// Content packs has its own tests (and is being reworked alongside this page).
vi.mock('../ContentPacksSection', () => ({ default: () => <div>content-packs</div> }))

vi.mock('../../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from '../../../api'

const ADDONS = {
  installed: [],
  available: [],
  index_urls: ['https://example.com/index.json'],
  default_index_url: 'https://example.com/index.json',
  allow_scripts: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue(ADDONS)
})

describe('AddonsArea', () => {
  it('renders the add-ons manager', async () => {
    render(<AddonsArea />)
    expect((await screen.findAllByText('addons.installedHeading')).length).toBeGreaterThan(0)
  })

  it('groups add-ons under their category heading', async () => {
    render(<AddonsArea />)
    expect(await screen.findByText('addons.categories.metadata')).toBeInTheDocument()
    expect(await screen.findByText('addons.categories.metadataDesc')).toBeInTheDocument()
  })

  // Grimoire Codex DB moved to the Metadata area.
  it('no longer holds Grimoire Codex DB', async () => {
    render(<AddonsArea />)
    await screen.findByText('addons.categories.metadata')
    expect(screen.queryByText('codex.settings.title')).toBeNull()
    expect(api.get).not.toHaveBeenCalledWith('/codex/settings')
  })

  it('keeps content packs in a group that remembers being closed', async () => {
    render(<AddonsArea />)
    expect(screen.getByText('content-packs')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'contentPacks.title' }))
    expect(screen.queryByText('content-packs')).toBeNull()
    expect(localStorage.getItem('grimoire:settings:addons:content-packs')).toBe('0')
  })
})
