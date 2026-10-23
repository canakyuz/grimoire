import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PeopleArea from './PeopleArea'

vi.mock('../UsersTab', () => ({ default: () => <div>users-roster</div> }))

describe('PeopleArea', () => {
  it('holds the users roster under its deep-link anchor', () => {
    render(<PeopleArea />)
    expect(document.getElementById('users')).toContainElement(screen.getByText('users-roster'))
  })
})
