import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConnectionsArea from './ConnectionsArea'
import type { SettingsVisibility } from '../registry'

// Who may see each section is decided once, in SettingsView, from the user
// and the instance (SettingsView.test covers those rules); this page only
// follows the answer it is handed.
vi.mock('../OPDSSection', () => ({ default: () => <div>opds</div> }))
vi.mock('../ApiKeySection', () => ({
  default: ({ scope }: { scope?: string }) => <div>api-keys:{scope ?? 'mine'}</div>,
}))
vi.mock('../ShareLinksSection', () => ({
  default: ({ canShare }: { canShare: boolean }) => (
    <div>{canShare ? 'share-links:can' : 'share-links:cannot'}</div>
  ),
}))

const ALL: SettingsVisibility = {
  isAdmin: false,
  apiKeys: true,
  apiKeysOnInstance: true,
  shareLinks: true,
  codex: false,
}

describe('ConnectionsArea', () => {
  it('always offers the OPDS feed', () => {
    render(<ConnectionsArea user={{}} visibility={{ ...ALL, apiKeys: false, shareLinks: false }} />)
    expect(screen.getByText('opds')).toBeInTheDocument()
    expect(screen.queryByText(/api-keys/)).toBeNull()
    expect(screen.queryByText(/share-links/)).toBeNull()
  })

  it("offers the person's own API keys when they may hold some", () => {
    render(<ConnectionsArea user={{}} visibility={ALL} />)
    expect(screen.getByText('api-keys:mine')).toBeInTheDocument()
  })

  it('lists share links, saying whether the person may still make them', () => {
    const { unmount } = render(
      <ConnectionsArea user={{ share_links_allowed: true }} visibility={ALL} />
    )
    expect(screen.getByText('share-links:can')).toBeInTheDocument()
    unmount()
    render(<ConnectionsArea user={{ share_links_allowed: false }} visibility={ALL} />)
    expect(screen.getByText('share-links:cannot')).toBeInTheDocument()
  })
})
