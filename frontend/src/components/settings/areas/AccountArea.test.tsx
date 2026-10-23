import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountArea from './AccountArea'

// Each section is covered by its own test file; stub them so this one asserts
// the page's composition and grouping rather than re-testing their internals.
vi.mock('../DisplayNameSection', () => ({ default: () => <div>display-name</div> }))
vi.mock('../EmailSection', () => ({ default: () => <div>email</div> }))
vi.mock('../ChangePasswordSection', () => ({ default: () => <div>password</div> }))
vi.mock('../ActiveSessionsSection', () => ({ default: () => <div>sessions</div> }))
vi.mock('../DeleteAccountSection', () => ({
  default: ({ user, onLogout }: { user: { username?: string }; onLogout?: () => void }) => (
    <button onClick={onLogout}>delete:{user?.username}</button>
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

describe('AccountArea', () => {
  it('renders every account section', () => {
    render(<AccountArea user={{ username: 'ada' }} />)
    for (const label of ['display-name', 'email', 'password', 'sessions']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('heads the profile sections, which draw no heading of their own', () => {
    render(<AccountArea user={{}} />)
    expect(screen.getByRole('heading', { level: 3, name: 'userSettings.displayName.title' }))
    expect(screen.getByRole('heading', { level: 3, name: 'userSettings.email.title' }))
  })

  it('passes the user and sign-out through to deleting the account', async () => {
    const onLogout = vi.fn()
    render(<AccountArea user={{ username: 'ada' }} onLogout={onLogout} />)
    await userEvent.click(screen.getByText('delete:ada'))
    expect(onLogout).toHaveBeenCalled()
  })

  it('keeps deleting the account in the danger zone, outside any group', () => {
    render(<AccountArea user={{ username: 'ada' }} />)
    const zone = screen.getByRole('region', { name: 'settings.dangerZone' })
    expect(within(zone).getByText('delete:ada')).toBeInTheDocument()
    expect(zone.closest('.settings-group')).toBeNull()
  })

  it('groups the sections under collapsible headings', () => {
    render(<AccountArea user={{}} />)
    for (const group of ['settings.groups.profile', 'settings.groups.security']) {
      expect(screen.getByRole('button', { name: group, expanded: true })).toBeInTheDocument()
    }
  })

  // Collapsing a group hides only its own settings - the groups sit side by
  // side rather than nesting inside one another.
  it('collapses a group without affecting the others', async () => {
    render(<AccountArea user={{}} />)
    await userEvent.click(screen.getByRole('button', { name: 'settings.groups.profile' }))
    expect(screen.queryByText('display-name')).not.toBeInTheDocument()
    expect(screen.queryByText('email')).not.toBeInTheDocument()
    expect(screen.getByText('password')).toBeInTheDocument()
    expect(localStorage.getItem('grimoire:settings:account:profile')).toBe('0')
  })
})
