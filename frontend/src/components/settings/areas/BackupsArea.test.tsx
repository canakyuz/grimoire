import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BackupsArea from './BackupsArea'
import { backups } from '../../../api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en-US' } }),
}))
vi.mock('../../Spinner', () => ({ default: () => <span data-testid="spinner" /> }))
vi.mock('../../../api', () => ({
  backups: {
    list: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    download: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
  },
}))

const SETTINGS = {
  backup_schedule: 'off',
  backup_schedule_hour: 3,
  backup_schedule_minute: 0,
  backup_schedule_weekday: 0,
  backup_retention_count: 0,
  backup_retention_gb: 0,
  backup_dir: '/data/backups',
  schedule_env_locked: false,
  retention_count_env_locked: false,
  retention_gb_env_locked: false,
  dir_env_locked: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(backups.list).mockResolvedValue({
    backups: [],
    directory: '/data/backups',
    total_bytes: 0,
  } as never)
  vi.mocked(backups.getSettings).mockResolvedValue(SETTINGS as never)
  vi.mocked(backups.saveSettings).mockResolvedValue(SETTINGS as never)
})

describe('BackupsArea', () => {
  it('renders both the list and the schedule', async () => {
    render(<BackupsArea />)
    expect(await screen.findByText('backups.list.title')).toBeInTheDocument()
    expect(await screen.findByText('backups.schedule.title')).toBeInTheDocument()
  })

  it('reloads the list after settings are saved, since the directory may have moved', async () => {
    render(<BackupsArea />)
    await screen.findByText('backups.schedule.title')
    await waitFor(() => expect(backups.list).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /schedule\.save$/ }))

    await waitFor(() => expect(backups.list).toHaveBeenCalledTimes(2))
  })
})
