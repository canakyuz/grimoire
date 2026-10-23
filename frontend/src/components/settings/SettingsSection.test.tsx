import { describe, it, expect } from 'vitest'
import { useContext } from 'react'
import { render, screen } from '@testing-library/react'
import SettingsSection from './SettingsSection'
import { AnchorTargetContext, SettingsTargetContext } from './settingsTarget'

function Probe() {
  return <span>{useContext(AnchorTargetContext) ? 'targeted' : 'not targeted'}</span>
}

describe('SettingsSection', () => {
  it('is a focusable anchor with the given id', () => {
    render(
      <SettingsSection id="watch">
        <p>body</p>
      </SettingsSection>
    )
    const section = document.getElementById('watch')!
    expect(section).toHaveAttribute('tabindex', '-1')
    expect(section).toContainElement(screen.getByText('body'))
    expect(section).not.toHaveAttribute('aria-labelledby')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('adds an h3 heading that labels it, and a description, when given', () => {
    render(
      <SettingsSection id="email" title="Email" description="Where we write to you">
        <p>body</p>
      </SettingsSection>
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Email' })).toHaveAttribute(
      'id',
      'email-title'
    )
    expect(screen.getByRole('region', { name: 'Email' })).toHaveAttribute('id', 'email')
    expect(screen.getByText('Where we write to you')).toBeInTheDocument()
  })

  it('tells what it holds whether it is the deep-link target', () => {
    const { rerender } = render(
      <SettingsTargetContext.Provider value={{ id: 'watch', group: null, nonce: '' }}>
        <SettingsSection id="watch">
          <Probe />
        </SettingsSection>
      </SettingsTargetContext.Provider>
    )
    expect(screen.getByText('targeted')).toBeInTheDocument()

    rerender(
      <SettingsTargetContext.Provider value={{ id: 'other', group: null, nonce: '' }}>
        <SettingsSection id="watch">
          <Probe />
        </SettingsSection>
      </SettingsTargetContext.Provider>
    )
    expect(screen.getByText('not targeted')).toBeInTheDocument()
  })
})
