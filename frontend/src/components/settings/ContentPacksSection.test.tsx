import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContentPacksSection from './ContentPacksSection'

const mockPacks = vi.fn()
const mockReload = vi.fn()
const mockUninstall = vi.fn()
vi.mock('../../api', () => ({
  content: { packs: (...a: unknown[]) => mockPacks(...a) },
  contentAdmin: { reloadPacks: (...a: unknown[]) => mockReload(...a) },
  rulesets: { uninstallPack: (...a: unknown[]) => mockUninstall(...a) },
}))

const PACK = {
  pack_id: 'dnd-5e-srd',
  schema_id: 'dnd-5e',
  name: 'D&D 5e SRD',
  version: '1.0.0',
  description: 'The open content.',
  license: 'CC-BY-4.0',
  license_url: 'https://example.com/licence',
  attribution: 'SRD 5.2 © Wizards, CC BY 4.0.',
  entry_count: 320,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPacks.mockResolvedValue({ packs: [PACK] })
})

describe('ContentPacksSection', () => {
  it('lists installed packs with their versions and counts', async () => {
    render(<ContentPacksSection />)
    expect(await screen.findByText('D&D 5e SRD')).toBeInTheDocument()
    expect(screen.getByText(/320 entries/)).toBeInTheDocument()
  })

  it('renders the attribution verbatim', async () => {
    // Several open licences mandate exact wording, so this must not be
    // paraphrased or truncated.
    render(<ContentPacksSection />)
    expect(await screen.findByText(/SRD 5\.2 © Wizards, CC BY 4\.0\./)).toBeInTheDocument()
  })

  it('links to the licence', async () => {
    render(<ContentPacksSection />)
    const link = await screen.findByRole('link', { name: /CC-BY-4.0/ })
    expect(link).toHaveAttribute('href', 'https://example.com/licence')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('reloads from disk', async () => {
    mockReload.mockResolvedValue({ packs: [{ ...PACK, entry_count: 400 }] })
    render(<ContentPacksSection />)
    await screen.findByText('D&D 5e SRD')
    await userEvent.click(screen.getByText(/Reload from disk/i))
    await waitFor(() => expect(mockReload).toHaveBeenCalled())
    expect(await screen.findByText(/400 entries/)).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    mockPacks.mockResolvedValue({ packs: [] })
    render(<ContentPacksSection />)
    expect(await screen.findByText(/No content packs installed/i)).toBeInTheDocument()
  })

  it('surfaces a load failure', async () => {
    mockPacks.mockRejectedValue(new Error('packs broke'))
    render(<ContentPacksSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent('packs broke')
  })

  it('surfaces a reload failure', async () => {
    mockReload.mockRejectedValue(new Error('reload broke'))
    render(<ContentPacksSection />)
    await screen.findByText('D&D 5e SRD')
    await userEvent.click(screen.getByText(/Reload from disk/i))
    expect(await screen.findByRole('alert')).toHaveTextContent('reload broke')
  })
})

describe('ContentPacksSection — uninstalling', () => {
  async function askToUninstall() {
    render(<ContentPacksSection />)
    await userEvent.click(await screen.findByLabelText('Uninstall D&D 5e SRD'))
    return screen.findByRole('dialog')
  }

  it('asks in a dialog that names the pack', async () => {
    const dialog = await askToUninstall()
    expect(dialog).toHaveTextContent('Uninstall "D&D 5e SRD" from this server?')
    expect(mockUninstall).not.toHaveBeenCalled()
  })

  it('removes a pack after confirming', async () => {
    mockUninstall.mockResolvedValue({ deleted: true })
    await askToUninstall()
    await userEvent.click(screen.getByRole('button', { name: 'Uninstall' }))
    await waitFor(() => expect(mockUninstall).toHaveBeenCalledWith('dnd-5e-srd'))
    await waitFor(() => expect(screen.queryByText('D&D 5e SRD')).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps it when the confirmation is declined', async () => {
    await askToUninstall()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockUninstall).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('D&D 5e SRD')).toBeInTheDocument()
  })

  it('surfaces a failure', async () => {
    mockUninstall.mockRejectedValue(new Error('Only an admin can uninstall a content pack'))
    await askToUninstall()
    await userEvent.click(screen.getByRole('button', { name: 'Uninstall' }))
    expect(await screen.findByText(/Only an admin/)).toBeInTheDocument()
    expect(screen.getByText('D&D 5e SRD')).toBeInTheDocument()
  })
})

describe('ContentPacksSection — layout', () => {
  // The Add-ons page's group heading names it; a second heading would repeat it.
  it('draws no heading of its own', async () => {
    render(<ContentPacksSection />)
    await screen.findByText('D&D 5e SRD')
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText(/Packs are installed by placing a directory/)).toBeInTheDocument()
  })
})
