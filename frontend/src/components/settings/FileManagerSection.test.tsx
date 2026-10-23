import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FileManagerSection from './FileManagerSection'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const renderSection = () =>
  render(
    <MemoryRouter initialEntries={['/settings/library']}>
      <Routes>
        <Route path="/settings/library" element={<FileManagerSection />} />
        <Route path="/settings/files" element={<p>arrived</p>} />
      </Routes>
    </MemoryRouter>
  )

describe('FileManagerSection', () => {
  it('describes the feature under its own heading', () => {
    renderSection()
    expect(screen.getByRole('heading', { level: 3, name: 'files.title' })).toBeInTheDocument()
    expect(screen.getByText('files.sectionDescription')).toBeInTheDocument()
  })

  it('links to the full page inside the app', () => {
    renderSection()
    const link = screen.getByRole('link', { name: 'files.open' })
    expect(link).toHaveAttribute('href', '/settings/files')
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
