import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DatabaseCleanupSection from './DatabaseCleanupSection'
import api from '../../api'

// Keys come back as themselves, with the one interpolated value appended.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      if (!o) return k
      const value = o.count ?? o.total ?? o.message
      return value === undefined ? k : `${k}:${value}`
    },
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}))
vi.mock('../Spinner', () => ({ default: () => <span data-testid="spinner" /> }))
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const get = vi.mocked(api.get) as unknown as ReturnType<typeof vi.fn>
const post = vi.mocked(api.post) as unknown as ReturnType<typeof vi.fn>

const counts = (c: Partial<Record<string, number>> = {}) => ({
  books: 0,
  maps: 0,
  tokens: 0,
  audio: 0,
  models: 0,
  ...c,
})

const preview = (
  missing: Partial<Record<string, number>>,
  total: Partial<Record<string, number>> = {
    books: 1200,
    maps: 40,
    tokens: 300,
    audio: 9,
    models: 4,
  },
  library_unavailable = false
) => ({ missing: counts(missing), total: counts(total), library_unavailable })

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status })

const findButton = () => screen.getByRole('button', { name: /maintenance.cleanup.find/ })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DatabaseCleanupSection', () => {
  it('renders its heading, description and a button that only looks first', () => {
    render(<DatabaseCleanupSection />)
    expect(screen.getByText('maintenance.cleanup.title')).toBeInTheDocument()
    expect(screen.getByText('maintenance.cleanup.description')).toBeInTheDocument()
    expect(findButton()).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })

  it('lists what it found and removes nothing until confirmed', async () => {
    get.mockResolvedValue(preview({ books: 3, maps: 1 }))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    expect(get).toHaveBeenCalledWith('/maintenance/cleanup-missing/preview')

    const dialog = await screen.findByRole('dialog', { name: 'maintenance.cleanup.confirmTitle' })
    expect(dialog).toHaveTextContent('maintenance.cleanup.confirmMessage')
    const items = within(dialog).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('maintenance.cleanup.books:3')
    expect(items[0]).toHaveTextContent('maintenance.cleanup.ofTotal:1,200')
    expect(items[1]).toHaveTextContent('maintenance.cleanup.maps:1')
    expect(
      within(dialog).getByRole('button', { name: 'maintenance.cleanup.confirmButton:4' })
    ).toBeInTheDocument()
    // Nothing looks unmounted, so no extra warning.
    expect(within(dialog).queryByText('maintenance.cleanup.wholeKindWarning')).toBeNull()
    expect(post).not.toHaveBeenCalled()
  })

  it('removes the records once confirmed and reports the outcome', async () => {
    get.mockResolvedValue(preview({ books: 2, maps: 1, audio: 1 }))
    post.mockResolvedValue({ removed: { books: 2, maps: 1, tokens: 0, audio: 1, systems: 0 } })
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    await userEvent.click(
      await screen.findByRole('button', { name: 'maintenance.cleanup.confirmButton:4' })
    )

    expect(post).toHaveBeenCalledWith('/maintenance/cleanup-missing')
    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('maintenance.cleanup.removed:4'))
    expect(status).toHaveTextContent('maintenance.cleanup.books:2')
    expect(status).toHaveTextContent('maintenance.cleanup.maps:1')
    expect(status).toHaveTextContent('maintenance.cleanup.audio:1')
    expect(status).not.toHaveTextContent('maintenance.cleanup.tokens')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reports when the removal found nothing left to remove', async () => {
    get.mockResolvedValue(preview({ tokens: 1 }))
    post.mockResolvedValue({ removed: counts() })
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    await userEvent.click(
      await screen.findByRole('button', { name: 'maintenance.cleanup.confirmButton:1' })
    )
    expect(await screen.findByText('maintenance.cleanup.nothingToRemove')).toBeInTheDocument()
  })

  it('backs out without removing anything when cancelled', async () => {
    get.mockResolvedValue(preview({ books: 3 }))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    await userEvent.click(await screen.findByRole('button', { name: 'common.cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(post).not.toHaveBeenCalled()
    expect(findButton()).not.toBeDisabled()
  })

  it('warns when every record of a kind is missing', async () => {
    get.mockResolvedValue(preview({ maps: 40 }))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('maintenance.cleanup.wholeKindWarning')).toBeInTheDocument()
  })

  it('says so when every record still has its file', async () => {
    get.mockResolvedValue(preview({}))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    expect(await screen.findByText('maintenance.cleanup.allPresent')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(post).not.toHaveBeenCalled()
  })

  it('refuses to offer removal when the library looks unmounted', async () => {
    get.mockResolvedValue(preview({ books: 1200 }, undefined, true))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('maintenance.cleanup.unavailableTitle')
    expect(alert).toHaveTextContent('maintenance.cleanup.unavailableBody')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(post).not.toHaveBeenCalled()
  })

  it("shows the server's reason when it refuses with a conflict", async () => {
    get.mockRejectedValue(apiError(409, 'A library scan is running. Try again when it finishes.'))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A library scan is running. Try again when it finishes.'
    )
  })

  it('shows a conflict raised at removal time too', async () => {
    get.mockResolvedValue(preview({ books: 1 }))
    post.mockRejectedValue(apiError(409, 'The library folder is missing.'))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    await userEvent.click(
      await screen.findByRole('button', { name: 'maintenance.cleanup.confirmButton:1' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('The library folder is missing.')
  })

  it('says the server could not be reached on a network failure', async () => {
    get.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('maintenance.cleanup.offline')
    // The error text uses the theme's danger colour, not a hardcoded red.
    expect(alert.style.color).toBe('var(--danger)')
  })

  it('passes on any other server error', async () => {
    get.mockRejectedValue(apiError(500, 'Database locked'))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'maintenance.cleanup.failedWithReason:Database locked'
    )
  })

  it('falls back to a generic failure when the server gives no reason', async () => {
    get.mockRejectedValue(apiError(500, ''))
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('maintenance.cleanup.failed')
  })

  it('disables the button while it is looking', async () => {
    let resolve: (v: unknown) => void = () => {}
    get.mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    const busy = screen.getByRole('button', { name: /maintenance.cleanup.checking/ })
    expect(busy).toBeDisabled()

    resolve(preview({}))
    await waitFor(() => expect(findButton()).not.toBeDisabled())
  })

  it('disables the button while it is removing', async () => {
    let resolve: (v: unknown) => void = () => {}
    get.mockResolvedValue(preview({ books: 1 }))
    post.mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    render(<DatabaseCleanupSection />)

    await userEvent.click(findButton())
    await userEvent.click(
      await screen.findByRole('button', { name: 'maintenance.cleanup.confirmButton:1' })
    )
    expect(screen.getByRole('button', { name: /maintenance.cleanup.cleaning/ })).toBeDisabled()

    resolve({ removed: counts({ books: 1 }) })
    await waitFor(() => expect(findButton()).not.toBeDisabled())
  })

  it('lightens on hover only while idle', async () => {
    render(<DatabaseCleanupSection />)
    const button = findButton()
    await userEvent.hover(button)
    expect(button.style.background).toContain('25%')
    await userEvent.unhover(button)
    expect(button.style.background).toContain('15%')
  })
})
