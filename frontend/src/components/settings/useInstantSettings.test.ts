import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { failureMessage } from './useInstantSettings'

vi.mock('../../api', () => ({ settings: { get: vi.fn(), patch: vi.fn() } }))

const t = ((key: string, opts?: { message?: string }) =>
  opts?.message ? `${key}|${opts.message}` : key) as unknown as TFunction

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status })

describe('failureMessage', () => {
  it("passes on the server's reason for a refused save", () => {
    expect(failureMessage(apiError(400, 'Too long'), t)).toBe('settings.save.failed|Too long')
  })

  it("passes on the server's reason for a failed load", () => {
    expect(failureMessage(apiError(500, 'Locked'), t, 'load')).toBe(
      'settings.save.loadFailed|Locked'
    )
  })

  it('reads a rejection without a status as the server being unreachable', () => {
    expect(failureMessage(new TypeError('Failed to fetch'), t)).toBe('settings.save.offline')
    expect(failureMessage(new TypeError('Failed to fetch'), t, 'load')).toBe(
      'settings.save.loadOffline'
    )
    expect(failureMessage(undefined, t)).toBe('settings.save.offline')
  })
})
