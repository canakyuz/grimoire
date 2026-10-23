import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OverviewArea from './OverviewArea'

// Interpolated values are spelled out after the key, so each line can be
// checked for both what it says and what it was given.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts
        ? `${k}(${Object.entries(opts)
            .map(([a, b]) => `${a}=${b}`)
            .join(',')})`
        : k,
    i18n: { language: 'en-US' },
  }),
}))

const scan = vi.hoisted(() => ({ status: { running: false } as Record<string, unknown> }))
vi.mock('../../../hooks/useScanStatus', () => ({ default: () => ({ status: scan.status }) }))

const codex = vi.hoisted(() => ({ status: null as unknown }))
vi.mock('../../codex/useCodexStatus', () => ({ default: () => codex.status }))

vi.mock('../../../api', () => ({
  default: { get: vi.fn() },
  settings: { get: vi.fn() },
  backups: { list: vi.fn(), getSettings: vi.fn() },
}))

import api, { backups as backupsApi, settings as settingsApi } from '../../../api'

const SETTINGS = {
  library_watch_enabled: true,
  library_watch_state: { state: 'watching' },
  rescan_schedule_enabled: true,
  rescan_schedule_interval: 'daily',
  rescan_schedule_hour: 3,
  rescan_schedule_minute: 0,
  password_auth_enabled: true,
  oidc_enabled: false,
  oidc_configured: true,
  guest_access_enabled: false,
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

let paths: Record<string, unknown>

function mockApi(overrides: Record<string, unknown> = {}) {
  paths = {
    '/users': [{ id: 1 }, { id: 2 }, { id: 3 }],
    '/users/guests': [{ id: 9 }],
    '/addons': { installed: [{ id: 'a' }, { id: 'b', update_available: true }] },
    ...overrides,
  }
  vi.mocked(api.get).mockImplementation((path: string) => {
    const value = paths[path]
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value)
  })
}

function renderOverview() {
  return render(
    <MemoryRouter>
      <OverviewArea />
    </MemoryRouter>
  )
}

/** The status cell of the row labelled `label`, once it has loaded. */
async function row(label: string, text: string | RegExp) {
  const term = screen.getByText(label, { selector: 'dt' })
  const rowEl = term.parentElement as HTMLElement
  await within(rowEl).findByText(text)
  return rowEl
}

beforeEach(() => {
  vi.clearAllMocks()
  scan.status = { running: false }
  codex.status = { enabled: false, url: '' }
  vi.mocked(settingsApi.get).mockResolvedValue(SETTINGS as never)
  vi.mocked(backupsApi.list).mockResolvedValue({
    backups: [
      { created_at: hoursAgo(30) },
      { created_at: hoursAgo(2) },
      { created_at: hoursAgo(50) },
    ],
  } as never)
  vi.mocked(backupsApi.getSettings).mockResolvedValue({ backup_schedule: 'weekly' } as never)
  mockApi()
})

describe('OverviewArea', () => {
  it('links each line to the settings behind it', async () => {
    renderOverview()
    await row('settings.areas.library.title', 'settings.overview.library.watching')
    const link = screen.getByRole('link', {
      name: 'settings.overview.open: settings.areas.library.title',
    })
    expect(link).toHaveAttribute('href', '/settings/library#scanning')
    expect(
      screen.getByRole('link', { name: 'settings.overview.open: settings.areas.backups.title' })
    ).toHaveAttribute('href', '/settings/backups')
  })

  describe('library', () => {
    it('says it is watching, and when the scheduled rescan runs', async () => {
      renderOverview()
      const el = await row('settings.areas.library.title', 'settings.overview.library.watching')
      expect(el).toHaveTextContent(
        'settings.overview.library.schedule(interval=maintenance.scheduledRescan.daily,time=3:00 AM)'
      )
    })

    it('says when it is not watching and nothing is scheduled', async () => {
      vi.mocked(settingsApi.get).mockResolvedValue({
        ...SETTINGS,
        library_watch_enabled: false,
        rescan_schedule_enabled: false,
      } as never)
      renderOverview()
      const el = await row('settings.areas.library.title', 'settings.overview.library.notWatching')
      expect(el).toHaveTextContent('settings.overview.library.noSchedule')
      expect(el).not.toHaveTextContent('watchUnavailable')
    })

    it('flags a watcher that is switched on but not working', async () => {
      vi.mocked(settingsApi.get).mockResolvedValue({
        ...SETTINGS,
        library_watch_state: { state: 'unavailable' },
      } as never)
      renderOverview()
      const el = await row('settings.areas.library.title', 'settings.overview.library.notWatching')
      expect(el).toHaveTextContent('settings.overview.library.watchUnavailable')
    })

    it('shows the scan phase while a scan runs', async () => {
      scan.status = { running: true, phase: 'indexing', indexed: 2, to_index: 9 }
      renderOverview()
      await row('settings.areas.library.title', 'maintenance.rescan.indexing(indexed=2,total=9)')
    })

    it("says so when the settings can't be loaded", async () => {
      vi.mocked(settingsApi.get).mockRejectedValue(new Error('down'))
      renderOverview()
      const el = await row('settings.areas.library.title', 'settings.overview.unavailable')
      expect(el).not.toHaveTextContent('watching')
    })
  })

  describe('backups', () => {
    it('gives the newest backup, how many are kept and the schedule', async () => {
      renderOverview()
      const el = await row('settings.areas.backups.title', /settings\.overview\.backups\.last/)
      expect(el).toHaveTextContent('settings.overview.backups.last(when=2 hours ago)')
      expect(el).toHaveTextContent('settings.overview.backups.kept(count=3)')
      expect(el).toHaveTextContent(
        'settings.overview.backups.scheduled(interval=backups.schedule.weekly)'
      )
    })

    it('flags having no backups, made by hand only', async () => {
      vi.mocked(backupsApi.list).mockResolvedValue({ backups: [] } as never)
      vi.mocked(backupsApi.getSettings).mockResolvedValue({ backup_schedule: 'off' } as never)
      renderOverview()
      const el = await row('settings.areas.backups.title', 'settings.overview.backups.none')
      expect(el.querySelector('.settings-ledger-attention')).toHaveTextContent(
        'settings.overview.backups.none'
      )
      expect(el).toHaveTextContent('settings.overview.backups.manual')
    })

    it('treats a schedule it could not load as manual', async () => {
      vi.mocked(backupsApi.getSettings).mockRejectedValue(new Error('down'))
      renderOverview()
      await row('settings.areas.backups.title', /settings\.overview\.backups\.manual/)
    })
  })

  describe('sign-in', () => {
    const signIn = async (patch: Record<string, unknown>, text: string) => {
      vi.mocked(settingsApi.get).mockResolvedValue({ ...SETTINGS, ...patch } as never)
      renderOverview()
      return row('settings.areas.sign-in.title', text)
    }

    it('says password only, guest codes off', async () => {
      const el = await signIn({}, 'settings.overview.signIn.passwordOnly')
      expect(el).toHaveTextContent('settings.overview.signIn.guestsOff')
    })

    it('says both, guest codes on', async () => {
      const el = await signIn(
        { oidc_enabled: true, guest_access_enabled: true },
        'settings.overview.signIn.both'
      )
      expect(el).toHaveTextContent('settings.overview.signIn.guestsOn')
      expect(el).not.toHaveTextContent('ssoIncomplete')
    })

    it('flags single sign-on that is on but not set up', async () => {
      const el = await signIn(
        { oidc_enabled: true, password_auth_enabled: false, oidc_configured: false },
        'settings.overview.signIn.ssoOnly'
      )
      expect(el).toHaveTextContent('settings.overview.signIn.ssoIncomplete')
    })
  })

  describe('people', () => {
    it('counts users and guests', async () => {
      renderOverview()
      const el = await row('settings.areas.people.title', 'settings.overview.people.users(count=3)')
      expect(el).toHaveTextContent('settings.overview.people.guests(count=1)')
    })

    it('leaves the guest count off when it cannot be loaded', async () => {
      mockApi({ '/users/guests': new Error('down') })
      renderOverview()
      const el = await row('settings.areas.people.title', 'settings.overview.people.users(count=3)')
      expect(el).not.toHaveTextContent('guests')
    })
  })

  describe('add-ons', () => {
    it('counts what is installed and flags updates', async () => {
      renderOverview()
      const el = await row(
        'settings.areas.addons.title',
        'settings.overview.addons.installed(count=2)'
      )
      expect(el.querySelector('.settings-ledger-attention')).toHaveTextContent(
        'settings.overview.addons.updates(count=1)'
      )
    })

    it('flags nothing when all are up to date', async () => {
      mockApi({ '/addons': { installed: [{ id: 'a' }] } })
      renderOverview()
      const el = await row(
        'settings.areas.addons.title',
        'settings.overview.addons.installed(count=1)'
      )
      expect(el.querySelector('.settings-ledger-attention')).toBeNull()
    })
  })

  describe('Grimoire Codex DB', () => {
    it('is left off while it is not on', async () => {
      renderOverview()
      await row('settings.areas.people.title', /users/)
      expect(screen.queryByText('codex.settings.title')).toBeNull()
    })

    it('shows where it is connected once it is on', async () => {
      codex.status = { enabled: true, url: 'https://db.example' }
      renderOverview()
      const el = await row('codex.settings.title', 'settings.overview.codex.connected')
      expect(el).toHaveTextContent('https://db.example')
      expect(within(el).getByRole('link')).toHaveAttribute('href', '/settings/catalogue#codex')
    })
  })

  it('shows a spinner on each line until it loads', () => {
    vi.mocked(settingsApi.get).mockReturnValue(new Promise(() => {}))
    renderOverview()
    const term = screen.getByText('settings.areas.sign-in.title', { selector: 'dt' })
    expect(within(term.parentElement as HTMLElement).getByRole('status')).toBeInTheDocument()
  })
})
