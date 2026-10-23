import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DuplicatesSection from './DuplicatesSection'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const renderSection = () =>
  render(
    <MemoryRouter initialEntries={['/settings/library']}>
      <Routes>
        <Route path="/settings/library" element={<DuplicatesSection />} />
        <Route path="/settings/duplicates" element={<p>arrived</p>} />
      </Routes>
    </MemoryRouter>
  )

describe('DuplicatesSection', () => {
  it('describes the feature under its own heading', () => {
    renderSection()
    expect(
      screen.getByRole('heading', { level: 3, name: 'maintenance.dupes.title' })
    ).toBeInTheDocument()
    expect(screen.getByText('maintenance.dupes.description')).toBeInTheDocument()
  })

  it('links to the full page inside the app', () => {
    renderSection()
    const link = screen.getByRole('link', { name: 'maintenance.dupes.open' })
    expect(link).toHaveAttribute('href', '/settings/duplicates')
    fireEvent.click(link)
    expect(screen.getByText('arrived')).toBeInTheDocument()
  })

  it('highlights on hover and restores on leave', () => {
    renderSection()
    const link = screen.getByRole('link')

    fireEvent.mouseEnter(link)
    expect(link.style.background).toBe('var(--bg-card-hover)')

    fireEvent.mouseLeave(link)
    expect(link.style.background).toBe('var(--bg-card)')
  })
})
