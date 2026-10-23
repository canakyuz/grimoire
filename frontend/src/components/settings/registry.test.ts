import { describe, it, expect } from 'vitest'
import {
  LEGACY_AREAS,
  SETTINGS_AREAS,
  SETTINGS_ENTRIES,
  defaultArea,
  findArea,
  findEntry,
  isAreaVisible,
  isEntryVisible,
  normalize,
  resolveArea,
  searchEntries,
} from './registry'
import type { SearchableEntry, SettingsEntry, SettingsVisibility } from './registry'

const ADMIN: SettingsVisibility = {
  isAdmin: true,
  apiKeys: true,
  apiKeysOnInstance: true,
  shareLinks: true,
  codex: true,
}
const PLAYER: SettingsVisibility = { ...ADMIN, isAdmin: false }

// Groups the area pages render that are not themselves search entries: the
// two danger zones, the preference groups and the sidecar group. A `group` on
// an entry must name one of these or another entry, or a deep link would try
// to open a group no page has.
const NON_ENTRY_GROUPS = ['look', 'reading', 'account-danger', 'library-danger', 'sidecar-files']

describe('registry shape', () => {
  it('gives every area and entry a unique id, and no entry shares an area id', () => {
    const areaIds = SETTINGS_AREAS.map((a) => a.id)
    const entryIds = SETTINGS_ENTRIES.map((e) => e.id)
    expect(new Set(areaIds).size).toBe(areaIds.length)
    expect(new Set(entryIds).size).toBe(entryIds.length)
    for (const id of entryIds) expect(areaIds).not.toContain(id)
  })

  it('puts every entry in an area that exists', () => {
    for (const entry of SETTINGS_ENTRIES) expect(findArea(entry.area), entry.id).toBeDefined()
  })

  it('only names groups that some area renders', () => {
    const entryIds = new Set(SETTINGS_ENTRIES.map((e) => e.id))
    for (const entry of SETTINGS_ENTRIES) {
      if (!entry.group) continue
      expect(
        entryIds.has(entry.group) || NON_ENTRY_GROUPS.includes(entry.group),
        `${entry.id} -> ${entry.group}`
      ).toBe(true)
    }
  })

  it('keeps a group in the same area as the entries inside it', () => {
    for (const entry of SETTINGS_ENTRIES) {
      const group = findEntry(entry.group)
      if (group) expect(group.area, entry.id).toBe(entry.area)
    }
  })

  it('sends every legacy key to a real area', () => {
    for (const [key, area] of Object.entries(LEGACY_AREAS)) {
      expect(findArea(area), key).toBeDefined()
      expect(findArea(key), key).toBeUndefined()
    }
  })

  it('finds areas and entries by id, and nothing for no id', () => {
    expect(findArea('library')?.scope).toBe('server')
    expect(findArea(undefined)).toBeUndefined()
    expect(findEntry('watch')?.group).toBe('scanning')
    expect(findEntry(undefined)).toBeUndefined()
    expect(findEntry('nope')).toBeUndefined()
  })
})

describe('resolveArea', () => {
  it('keeps a known, visible area', () => {
    expect(resolveArea('library', ADMIN)).toBe('library')
    expect(resolveArea('preferences', PLAYER)).toBe('preferences')
  })

  it('moves old tab keys to where their contents went', () => {
    expect(resolveArea('maintenance', ADMIN)).toBe('library')
    expect(resolveArea('users', ADMIN)).toBe('people')
    expect(resolveArea('authentication', ADMIN)).toBe('sign-in')
    expect(resolveArea('application', ADMIN)).toBe('access')
    expect(resolveArea('metadata', ADMIN)).toBe('catalogue')
  })

  it('falls back to the default area for an unknown or missing key', () => {
    expect(resolveArea('nope', ADMIN)).toBe('overview')
    expect(resolveArea(undefined, ADMIN)).toBe('overview')
    expect(resolveArea(undefined, PLAYER)).toBe('account')
  })

  it("doesn't let a non-admin into a server area, old key or new", () => {
    expect(resolveArea('library', PLAYER)).toBe('account')
    expect(resolveArea('maintenance', PLAYER)).toBe('account')
    expect(resolveArea('overview', PLAYER)).toBe('account')
  })

  it('lands admins on the overview and everyone else on their account', () => {
    expect(defaultArea(true)).toBe('overview')
    expect(defaultArea(false)).toBe('account')
  })
})

describe('visibility', () => {
  const entry = (id: string) => findEntry(id) as SettingsEntry

  it('shows "you" areas to everyone and "server" areas to admins only', () => {
    expect(isAreaVisible(findArea('account')!, PLAYER)).toBe(true)
    expect(isAreaVisible(findArea('logs')!, PLAYER)).toBe(false)
    expect(isAreaVisible(findArea('logs')!, ADMIN)).toBe(true)
  })

  it('hides every entry in an area the person cannot see', () => {
    expect(isEntryVisible(entry('watch'), PLAYER)).toBe(false)
    expect(isEntryVisible(entry('watch'), ADMIN)).toBe(true)
    expect(isEntryVisible({ id: 'x', area: 'nope' as never, title: 'x' }, ADMIN)).toBe(false)
  })

  it('offers personal API keys only to someone allowed them', () => {
    expect(isEntryVisible(entry('api-keys'), { ...PLAYER, apiKeys: false })).toBe(false)
    expect(isEntryVisible(entry('api-keys'), PLAYER)).toBe(true)
  })

  it('shows the all-keys audit whenever the instance has keys, whatever the admin may hold', () => {
    const noOwnKeys = { ...ADMIN, apiKeys: false }
    expect(isEntryVisible(entry('all-api-keys'), noOwnKeys)).toBe(true)
    expect(isEntryVisible(entry('all-api-keys'), { ...noOwnKeys, apiKeysOnInstance: false })).toBe(
      false
    )
  })

  it('follows the share link and Codex switches', () => {
    expect(isEntryVisible(entry('share-links'), { ...PLAYER, shareLinks: false })).toBe(false)
    expect(isEntryVisible(entry('share-link-roles'), { ...ADMIN, shareLinks: false })).toBe(false)
    expect(isEntryVisible(entry('share-link-roles'), ADMIN)).toBe(true)
    expect(isEntryVisible(entry('codex'), { ...ADMIN, codex: false })).toBe(false)
    expect(isEntryVisible(entry('codex'), ADMIN)).toBe(true)
  })
})

describe('searchEntries', () => {
  const item = (
    id: string,
    title: string,
    description = '',
    keywords = '',
    areaTitle = 'Area'
  ): SearchableEntry => ({
    entry: { id, area: 'library', title: id },
    title,
    description,
    areaTitle,
    keywords,
  })

  it('returns nothing for an empty query', () => {
    expect(searchEntries('   ', [item('a', 'Anything')])).toEqual([])
  })

  it('ranks a title prefix above a description hit', () => {
    const results = searchEntries('scan', [
      item('desc', 'Duplicates', 'Run a scan for copies'),
      item('title', 'Scanning'),
    ])
    expect(results.map((r) => r.entry.id)).toEqual(['title', 'desc'])
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('ranks title start > later title word > keywords > area > description', () => {
    const results = searchEntries('dark', [
      item('desc', 'E', 'dark'),
      item('area', 'D', '', '', 'Darkness'),
      item('keyword', 'C', '', 'dark mode'),
      item('later', 'Light or dark'),
      item('prefix', 'Dark theme'),
    ])
    expect(results.map((r) => r.entry.id)).toEqual(['prefix', 'later', 'keyword', 'area', 'desc'])
  })

  it('matches the start of a word, never the middle', () => {
    // "sso" must find SSO, not "associated" in a description.
    const entries = [
      item('oidc', 'OpenID Connect', '', 'sso, single sign-on'),
      item('delete', 'Delete Account', 'Removes everything associated with you'),
      item('inside', 'Bedarken'),
    ]
    expect(searchEntries('sso', entries).map((r) => r.entry.id)).toEqual(['oidc'])
    expect(searchEntries('dark', entries)).toEqual([])
  })

  it('counts a word that starts later in the title as a prefix', () => {
    const [hit] = searchEntries('sign', [item('a', 'Single sign-on')])
    expect(hit.score).toBe(8)
  })

  it('needs every word to match somewhere', () => {
    const entries = [item('both', 'Watch library', 'for changes'), item('one', 'Watch')]
    expect(searchEntries('watch changes', entries).map((r) => r.entry.id)).toEqual(['both'])
  })

  it('ignores accents and case', () => {
    expect(normalize('Thème Été')).toBe('theme ete')
    expect(searchEntries('THEME', [item('a', 'Thème')])).toHaveLength(1)
    expect(searchEntries('thème', [item('a', 'Theme')])).toHaveLength(1)
  })

  it('breaks ties alphabetically and stops at the limit', () => {
    const entries = ['Charlie', 'Alpha', 'Bravo', 'Delta'].map((t) => item(t, `${t} x`))
    expect(searchEntries('x', entries, 2).map((r) => r.title)).toEqual(['Alpha x', 'Bravo x'])
    expect(searchEntries('x', entries)).toHaveLength(4)
  })
})
