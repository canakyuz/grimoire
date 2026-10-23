import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodexSendForm from './CodexSendForm'
import { REGULAR } from './codexPanelStyles'

vi.mock('../../api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  bookPageUrl: (id: string, page: number, width: number) =>
    `/api/books/${id}/page/${page}?w=${width}`,
}))

const api = vi.mocked((await import('../../api')).default)

const LINKED = {
  linked: true,
  codex_id: 'sy_cairn01',
  codex_url: 'https://codex.test/systems/sy_cairn01',
  revision: 3,
  fields: [
    { field: 'edition', local: '2e', remote: '1e', status: 'differs' },
    { field: 'license', local: 'CC-BY-SA', remote: null, status: 'only_local' },
    { field: 'description', local: 'A tidy OSR game.', remote: 'A tidy OSR game.', status: 'same' },
    { field: 'is_explicit', local: false, remote: false, status: 'same' },
    { field: 'publishers', local: null, remote: [{ name: 'Yochai' }], status: 'only_remote' },
  ],
  cover: { local: true, remote_url: 'https://codex.test/covers/ab.webp', status: 'differs' },
  attributions: [],
  attribution_sources: [
    { id: 'ttrpg-wiki', name: 'TTRPG Wiki', url: 'https://ttrpgwiki.com/Cairn' },
    { id: 'rpggeek', name: 'RPGGeek', url: '' },
  ],
  system: null,
}

const NEW_BOOK = {
  linked: false,
  revision: null,
  fields: [
    { field: 'title', local: 'Cairn Core', remote: null, status: 'only_local' },
    { field: 'tags', local: ['osr', 'nsr'], remote: null, status: 'only_local' },
    {
      field: 'urls',
      local: [{ label: 'Shop', url: 'https://shop.test/cairn' }],
      remote: null,
      status: 'only_local',
    },
  ],
  cover: { local: true, remote_url: null, status: 'only_local' },
  attributions: [],
  attribution_sources: [{ id: 'dtrpg', name: 'DriveThruRPG', url: '' }],
  system: {
    id: 's1',
    name: 'Cairn',
    codex_id: null,
    candidates: [
      { codex_id: 'sy_other1', name: 'Cairn 2e', label: 'Cairn 2e · 2024', url: 'https://c/1' },
      { codex_id: 'sy_cairn01', name: 'cairn', label: 'Cairn · 2020', url: 'https://c/2' },
    ],
  },
}

function renderForm(kind: 'books' | 'systems', linked: boolean) {
  const onSent = vi.fn()
  const onCancel = vi.fn()
  render(
    <CodexSendForm
      kind={kind}
      resourceId="r1"
      linked={linked}
      scale={REGULAR}
      onSent={onSent}
      onCancel={onCancel}
    />
  )
  return { onSent, onCancel }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.post.mockResolvedValue({ status: 'applied', linked: true, edit_url: 'https://c/e' })
})

describe('CodexSendForm', () => {
  it('pre-selects what differs and sends it with the cover and the credited scraper', async () => {
    api.get.mockResolvedValue(LINKED)
    const { onSent } = renderForm('systems', true)
    expect(screen.getByText(/Comparing with Grimoire Codex DB/)).toBeInTheDocument()

    const edition = await screen.findByRole('checkbox', { name: /Edition/ })
    expect(api.get).toHaveBeenCalledWith('/codex/systems/r1/compare')
    expect(edition).toBeChecked()
    expect(screen.getByText('This library: 2e')).toBeInTheDocument()
    expect(screen.getByText('Grimoire Codex DB: 1e')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /License/ })).toBeChecked()
    // A cover that differs is offered but not chosen: theirs may be the better scan.
    expect(screen.getByRole('checkbox', { name: /Cover/ })).not.toBeChecked()
    expect(screen.getByRole('link', { name: 'View theirs' })).toHaveAttribute(
      'href',
      'https://codex.test/covers/ab.webp'
    )
    expect(screen.getByText('Already the same (2)')).toBeInTheDocument()
    expect(screen.queryByText(/Yochai/)).not.toBeInTheDocument()

    // The scraper whose site the record links to is picked, with that page.
    expect(screen.getByLabelText('Source')).toHaveValue('ttrpg-wiki')
    expect(screen.getByLabelText('Link to the page this came from')).toHaveValue(
      'https://ttrpgwiki.com/Cairn'
    )
    expect(screen.getByRole('checkbox', { name: /Credit Description to TTRPG Wiki/ })).toBeChecked()

    await userEvent.click(screen.getByRole('checkbox', { name: /Cover/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /License/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(api.post).toHaveBeenCalledWith('/codex/systems/r1/submit', {
      fields: ['edition'],
      note: '',
      cover: true,
      sources: ['https://ttrpgwiki.com/Cairn'],
      attribution: {
        source: 'TTRPG Wiki',
        url: 'https://ttrpgwiki.com/Cairn',
        fields: ['description'],
      },
      base_revision: 3,
    })
    await waitFor(() =>
      expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ linked: true }))
    )
  })

  it('needs something to send, and a valid link', async () => {
    api.get.mockResolvedValue(LINKED)
    renderForm('systems', true)
    await userEvent.click(await screen.findByRole('checkbox', { name: /Edition/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /License/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Credit Description/ }))
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    // A credit alone is worth sending to a linked record.
    await userEvent.click(screen.getByRole('checkbox', { name: /Credit Description/ }))
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()

    await userEvent.selectOptions(screen.getByLabelText('Source'), 'rpggeek')
    const url = screen.getByLabelText('Link to the page this came from')
    expect(url).toHaveValue('')
    await userEvent.type(url, 'not a link')
    expect(screen.getByText('Enter an http(s) link.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    await userEvent.selectOptions(screen.getByLabelText('Source'), '')
    expect(screen.queryByLabelText('Link to the page this came from')).not.toBeInTheDocument()
  })

  it('sends a new book with the system it joins, its cover and a plain source link', async () => {
    api.get.mockResolvedValue(NEW_BOOK)
    const { onSent } = renderForm('books', false)
    expect(await screen.findByText(/This creates the book/)).toBeInTheDocument()
    expect(screen.getByText(/Cairn is not linked to Grimoire Codex DB/)).toBeInTheDocument()
    // The exact name match is chosen, ignoring case.
    expect(screen.getByRole('radio', { name: /Cairn · 2020/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Title/ })).toBeChecked()
    expect(screen.getByText('osr, nsr')).toBeInTheDocument()
    expect(screen.getByText('https://shop.test/cairn')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Cover/ })).toBeChecked()
    expect(screen.getByText('Grimoire Codex DB has no cover yet.')).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('src', '/api/books/r1/page/1?w=240')
    expect(screen.getByLabelText('Source')).toHaveValue('')

    await userEvent.selectOptions(screen.getByLabelText('Source'), 'other')
    await userEvent.type(
      screen.getByLabelText('Link to the page this came from'),
      'https://shop.test/cairn'
    )
    expect(screen.queryByRole('checkbox', { name: /Credit/ })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Note for reviewers (optional)'), 'My shelf')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(api.post).toHaveBeenCalledWith('/codex/books/r1/submit', {
      fields: ['title', 'tags', 'urls'],
      note: 'My shelf',
      cover: true,
      sources: ['https://shop.test/cairn'],
      system: { codex_id: 'sy_cairn01' },
    })
    await waitFor(() => expect(onSent).toHaveBeenCalled())
  })

  it('makes a new book choose its system when no candidate is an exact match', async () => {
    api.get.mockResolvedValue({
      ...NEW_BOOK,
      system: { ...NEW_BOOK.system, candidates: [NEW_BOOK.system.candidates[0]] },
    })
    renderForm('books', false)
    await screen.findByRole('radio', { name: /Cairn 2e/ })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /Add Cairn to Grimoire Codex DB/ }))
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    // A new record cannot be just a cover.
    for (const name of [/Title/, /Tags/, /Links/]) {
      await userEvent.click(screen.getByRole('checkbox', { name }))
    }
    expect(screen.getByRole('checkbox', { name: /Cover/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Tags/ }))
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'dtrpg')
    await userEvent.type(
      screen.getByLabelText('Link to the page this came from'),
      'https://www.drivethrurpg.com/p/1'
    )
    // Tags are text, so a scraped list is credited too.
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(api.post).toHaveBeenCalledWith(
      '/codex/books/r1/submit',
      expect.objectContaining({
        system: { create: true },
        attribution: {
          source: 'DriveThruRPG',
          url: 'https://www.drivethrurpg.com/p/1',
          fields: ['tags'],
        },
      })
    )
  })

  it('picks a new system when Grimoire Codex DB has nothing like it', async () => {
    api.get.mockResolvedValue({ ...NEW_BOOK, system: { ...NEW_BOOK.system, candidates: [] } })
    renderForm('books', false)
    expect(
      await screen.findByRole('radio', { name: /Add Cairn to Grimoire Codex DB/ })
    ).toBeChecked()
  })

  it('says when nothing differs, and shows a send error', async () => {
    api.get.mockResolvedValue({
      ...LINKED,
      fields: [{ field: 'name', local: 'Cairn', remote: 'Cairn', status: 'same' }],
      cover: { local: true, remote_url: 'x', status: 'same' },
      attribution_sources: [],
    })
    api.post.mockRejectedValue(new Error('Name is required'))
    const { onSent, onCancel } = renderForm('systems', true)
    expect(await screen.findByText('Nothing differs from Grimoire Codex DB.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.click(screen.getByText('Already the same (1)'))
    await userEvent.click(screen.getByRole('checkbox', { name: /Name/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required')
    expect(onSent).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows a compare failure', async () => {
    api.get.mockRejectedValue(new Error('That record is not in Grimoire Codex DB'))
    const { onCancel } = renderForm('books', true)
    expect(await screen.findByRole('alert')).toHaveTextContent('not in Grimoire Codex DB')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
