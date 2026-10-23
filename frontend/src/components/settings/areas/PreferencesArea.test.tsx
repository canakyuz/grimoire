import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreferencesArea from './PreferencesArea'

vi.mock('../UserPreferenceSections', () => ({
  ReaderSection: () => <div>reader</div>,
  LibrarySection: () => <div>library</div>,
  LanguageSection: () => <div>language</div>,
}))
vi.mock('../AppearanceSection', () => ({ default: () => <div>appearance</div> }))
vi.mock('../ExplicitContentSection', () => ({ default: () => <div>explicit</div> }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

describe('PreferencesArea', () => {
  it('renders every preference section', () => {
    render(<PreferencesArea />)
    for (const label of ['language', 'appearance', 'reader', 'library', 'explicit']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  // Appearance belongs with the other presentation preferences, straight
  // after Language, then the reading ones.
  it('places the theme directly after the language, before reading', () => {
    render(<PreferencesArea />)
    const [language, appearance, reader] = ['language', 'appearance', 'reader'].map((label) =>
      screen.getByText(label)
    )
    expect(language.compareDocumentPosition(appearance)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(appearance.compareDocumentPosition(reader)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('groups them under look and reading', async () => {
    render(<PreferencesArea />)
    expect(screen.getByRole('button', { name: 'settings.groups.look' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'settings.groups.reading' }))
    expect(screen.queryByText('reader')).not.toBeInTheDocument()
    expect(screen.queryByText('explicit')).not.toBeInTheDocument()
    expect(screen.getByText('language')).toBeInTheDocument()
  })
})
