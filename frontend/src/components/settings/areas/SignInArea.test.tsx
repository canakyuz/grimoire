import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignInArea from './SignInArea'

// Each sign-in section has its own tests; this page only places them.
vi.mock('../PasswordAuthSection', () => ({ default: () => <div>password</div> }))
vi.mock('../OIDCSettingsSection', () => ({ default: () => <div>oidc</div> }))
vi.mock('../GuestAccessSection', () => ({ default: () => <div>guest-access</div> }))
vi.mock('../LoginMessageSection', () => ({ default: () => <div>login-message</div> }))

describe('SignInArea', () => {
  it('puts each way in under its own anchor, passwords first', () => {
    render(<SignInArea />)
    const order = [
      ['password-sign-in', 'password'],
      ['oidc', 'oidc'],
      ['guest-access', 'guest-access'],
      ['login-message', 'login-message'],
    ].map(([id, text]) => {
      const section = document.getElementById(id)!
      expect(section).toContainElement(screen.getByText(text))
      return section
    })
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i])).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    }
  })
})
