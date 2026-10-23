import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CatalogueArea from './CatalogueArea'
import type { SettingsVisibility } from '../registry'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('../GenreManagerSection', () => ({ default: () => <div>genre-manager</div> }))
vi.mock('../SystemFamilyManagerSection', () => ({ default: () => <div>family-manager</div> }))
vi.mock('../ParentSystemManagerSection', () => ({ default: () => <div>parent-manager</div> }))
vi.mock('../LicenseManagerSection', () => ({ default: () => <div>license-manager</div> }))
vi.mock('../DiceMaterialManagerSection', () => ({ default: () => <div>dice-manager</div> }))
vi.mock('../SidecarExportSection', () => ({ default: () => <div>sidecars</div> }))

// Grimoire Codex DB's own settings section runs for real.
vi.mock('../../../api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}))

import api from '../../../api'

const VIS: SettingsVisibility = {
  isAdmin: true,
  apiKeys: true,
  apiKeysOnInstance: true,
  shareLinks: true,
  codex: false,
}

const MANAGERS = [
  ['lookupSettings.genresTitle', 'genre-manager'],
  ['lookupSettings.familiesTitle', 'family-manager'],
  ['lookupSettings.parentSystemsTitle', 'parent-manager'],
  ['lookupSettings.licensesTitle', 'license-manager'],
  ['lookupSettings.diceTitle', 'dice-manager'],
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({
    enabled: true,
    url: 'https://db.grimoirecodex.org',
    send_hashes: false,
    locked: [],
  })
})

describe('CatalogueArea', () => {
  // The lookup lists run long, so they start closed and say what they are for.
  it('starts every lookup list closed, showing what it is for', () => {
    render(<CatalogueArea visibility={VIS} />)
    for (const [title, body] of MANAGERS) {
      expect(screen.getByRole('button', { name: title, expanded: false })).toBeInTheDocument()
      expect(screen.queryByText(body)).toBeNull()
    }
    expect(screen.getByText('lookupSettings.genresDesc')).toBeInTheDocument()
  })

  it('opens a list from its heading, and remembers it', async () => {
    const { unmount } = render(<CatalogueArea visibility={VIS} />)
    await userEvent.click(screen.getByRole('button', { name: 'lookupSettings.genresTitle' }))
    expect(screen.getByText('genre-manager')).toBeInTheDocument()
    expect(screen.queryByText('family-manager')).toBeNull()
    unmount()

    render(<CatalogueArea visibility={VIS} />)
    expect(screen.getByText('genre-manager')).toBeInTheDocument()
  })

  it('keeps the sidecar files in a group of their own', async () => {
    render(<CatalogueArea visibility={VIS} />)
    expect(screen.queryByText('sidecars')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'settings.groups.sidecars' }))
    expect(screen.getByText('sidecars')).toBeInTheDocument()
  })

  it('does not host the add-ons manager (it has its own area)', () => {
    render(<CatalogueArea visibility={VIS} />)
    expect(screen.queryByRole('button', { name: /addons.title/i })).toBeNull()
  })

  it('hides Grimoire Codex DB when the server has no GRIMOIRE_CODEX_DB_API_TOKEN', () => {
    render(<CatalogueArea visibility={VIS} />)
    expect(screen.queryByText('codex.settings.title')).toBeNull()
    expect(api.get).not.toHaveBeenCalledWith('/codex/settings')
  })

  it('shows Grimoire Codex DB settings once it is configured', async () => {
    render(<CatalogueArea visibility={{ ...VIS, codex: true }} />)
    expect(await screen.findByText('codex.settings.title')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/codex/settings')
  })
})
