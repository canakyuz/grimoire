import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import CollapsibleSection from './CollapsibleSection'
import { AnchorTargetContext, SettingsTargetContext } from './settingsTarget'

const toggle = () => screen.getByRole('button', { name: /genres/i })

function linkedTo(id: string | null, group: string | null, children: ReactNode, nonce = 'n1') {
  return (
    <SettingsTargetContext.Provider value={{ id, group, nonce }}>
      {children}
    </SettingsTargetContext.Provider>
  )
}

describe('CollapsibleSection', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('renders open by default with title, description, and children', () => {
    render(
      <CollapsibleSection id="genres" title="Genres" description="Manage genres">
        <div>body</div>
      </CollapsibleSection>
    )
    expect(screen.getByText('Manage genres')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('genres')).toHaveAttribute('data-open', 'true')
  })

  // The toggle sits inside a real heading, so heading navigation walks the
  // groups and the sections inside them (h3) sit one level below.
  it('puts the toggle inside an h2 that labels the group', () => {
    render(
      <CollapsibleSection id="genres" title="Genres">
        <div>body</div>
      </CollapsibleSection>
    )
    const heading = screen.getByRole('heading', { level: 2, name: 'Genres' })
    expect(heading).toContainElement(toggle())
    expect(screen.getByRole('region', { name: 'Genres' })).toHaveAttribute('id', 'genres')
  })

  it('points the toggle at the body only while there is one', async () => {
    render(
      <CollapsibleSection id="genres" title="Genres">
        <div>body</div>
      </CollapsibleSection>
    )
    expect(toggle()).toHaveAttribute('aria-controls', 'genres-body')
    expect(document.getElementById('genres-body')).toContainElement(screen.getByText('body'))

    await userEvent.click(toggle())
    expect(toggle()).not.toHaveAttribute('aria-controls')
    expect(document.getElementById('genres-body')).toBeNull()
  })

  it('works without an id', () => {
    render(
      <CollapsibleSection title="Genres">
        <div>body</div>
      </CollapsibleSection>
    )
    const controls = toggle().getAttribute('aria-controls')
    expect(controls).toMatch(/-body$/)
    expect(document.getElementById(controls!)).toContainElement(screen.getByText('body'))
  })

  it('toggles the body when the header is clicked, and reports it', async () => {
    const onOpenChange = vi.fn()
    render(
      <CollapsibleSection title="Genres" onOpenChange={onOpenChange}>
        <div>body</div>
      </CollapsibleSection>
    )
    await userEvent.click(toggle())
    expect(screen.queryByText('body')).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await userEvent.click(toggle())
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('shows the summary in place of the body only while closed', async () => {
    render(
      <CollapsibleSection title="Genres" summary="31 genres" defaultOpen={false}>
        <div>body</div>
      </CollapsibleSection>
    )
    expect(screen.getByText('31 genres')).toBeInTheDocument()
    expect(screen.queryByText('body')).not.toBeInTheDocument()
    await userEvent.click(toggle())
    expect(screen.queryByText('31 genres')).not.toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('remembers collapsed state via storageKey', async () => {
    const { unmount } = render(
      <CollapsibleSection title="Genres" storageKey="k1">
        <div>body</div>
      </CollapsibleSection>
    )
    await userEvent.click(toggle())
    expect(localStorage.getItem('k1')).toBe('0')
    unmount()

    render(
      <CollapsibleSection title="Genres" storageKey="k1">
        <div>body</div>
      </CollapsibleSection>
    )
    expect(screen.queryByText('body')).not.toBeInTheDocument()
  })

  it('remembers an opened group over defaultOpen=false', () => {
    localStorage.setItem('k2', '1')
    render(
      <CollapsibleSection title="Genres" storageKey="k2" defaultOpen={false}>
        <div>body</div>
      </CollapsibleSection>
    )
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('honors defaultOpen=false when no stored state', () => {
    render(
      <CollapsibleSection title="Genres" defaultOpen={false}>
        <div>body</div>
      </CollapsibleSection>
    )
    expect(screen.queryByText('body')).not.toBeInTheDocument()
  })

  it('still toggles when storage is blocked', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(
      <CollapsibleSection title="Genres" storageKey="k3">
        <div>body</div>
      </CollapsibleSection>
    )
    expect(screen.getByText('body')).toBeInTheDocument()
    await userEvent.click(toggle())
    expect(screen.queryByText('body')).not.toBeInTheDocument()
  })

  describe('deep links', () => {
    it('opens when the link points at the group itself', () => {
      const onOpenChange = vi.fn()
      render(
        linkedTo(
          'genres',
          null,
          <CollapsibleSection
            id="genres"
            title="Genres"
            defaultOpen={false}
            onOpenChange={onOpenChange}
          >
            <div>body</div>
          </CollapsibleSection>
        )
      )
      expect(screen.getByText('body')).toBeInTheDocument()
      expect(onOpenChange).toHaveBeenCalledWith(true)
    })

    it('opens when the link points at a section inside it, without remembering', () => {
      localStorage.setItem('k4', '0')
      render(
        linkedTo(
          'watch',
          'genres',
          <CollapsibleSection id="genres" title="Genres" storageKey="k4">
            <div>body</div>
          </CollapsibleSection>
        )
      )
      expect(screen.getByText('body')).toBeInTheDocument()
      expect(localStorage.getItem('k4')).toBe('0')
    })

    it('opens when it sits inside the linked section', () => {
      render(
        <AnchorTargetContext.Provider value={true}>
          <CollapsibleSection title="Genres" defaultOpen={false}>
            <div>body</div>
          </CollapsibleSection>
        </AnchorTargetContext.Provider>
      )
      expect(screen.getByText('body')).toBeInTheDocument()
    })

    it('stays as it is for a link elsewhere', () => {
      render(
        linkedTo(
          'other',
          'other-group',
          <CollapsibleSection id="genres" title="Genres" defaultOpen={false}>
            <div>body</div>
          </CollapsibleSection>
        )
      )
      expect(screen.queryByText('body')).not.toBeInTheDocument()
    })

    it('opens again when the same link is followed after closing it', async () => {
      const tree = (nonce: string) =>
        linkedTo(
          'genres',
          null,
          <CollapsibleSection id="genres" title="Genres">
            <div>body</div>
          </CollapsibleSection>,
          nonce
        )
      const { rerender } = render(tree('first'))
      await userEvent.click(toggle())
      expect(screen.queryByText('body')).not.toBeInTheDocument()
      rerender(tree('second'))
      expect(screen.getByText('body')).toBeInTheDocument()
    })
  })
})
