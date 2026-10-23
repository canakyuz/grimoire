import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { clock, timeAgo, useLoad } from './overviewData'

describe('timeAgo', () => {
  const now = Date.parse('2026-10-23T12:00:00Z')

  it('picks the largest unit that fits', () => {
    expect(timeAgo('2026-10-21T12:00:00Z', 'en-US', now)).toBe('2 days ago')
    expect(timeAgo('2026-10-23T09:00:00Z', 'en-US', now)).toBe('3 hours ago')
    expect(timeAgo('2026-10-23T11:55:00Z', 'en-US', now)).toBe('5 minutes ago')
  })

  it('says "now" for anything under a minute', () => {
    expect(timeAgo('2026-10-23T11:59:30Z', 'en-US', now)).toBe('this minute')
  })

  it('speaks the interface language', () => {
    expect(timeAgo('2026-10-22T12:00:00Z', 'de', now)).toBe('gestern')
  })

  it('defaults to the current time', () => {
    expect(timeAgo(new Date(Date.now() - 3_600_000).toISOString(), 'en-US')).toBe('1 hour ago')
  })
})

describe('clock', () => {
  it('formats a time of day for the language', () => {
    expect(clock(15, 5, 'en-US')).toBe('3:05 PM')
    expect(clock(15, 5, 'de-DE')).toBe('15:05')
  })
})

describe('useLoad', () => {
  it('is undefined while loading, then the answer', async () => {
    let resolve!: (v: unknown) => void
    const load = vi.fn(() => new Promise((r) => (resolve = r)))
    const { result, rerender } = renderHook(() => useLoad<number>(load))
    expect(result.current).toBeUndefined()
    resolve(42)
    await waitFor(() => expect(result.current).toBe(42))
    rerender()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('is null when the request fails', async () => {
    const { result } = renderHook(() => useLoad(() => Promise.reject(new Error('down'))))
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('ignores an answer that arrives after unmount', async () => {
    let resolve!: (v: unknown) => void
    const { result, unmount } = renderHook(() => useLoad(() => new Promise((r) => (resolve = r))))
    unmount()
    resolve(1)
    await Promise.resolve()
    expect(result.current).toBeUndefined()
  })
})
