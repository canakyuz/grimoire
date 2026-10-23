import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { settings as settingsApi } from '../../api'
import type { ApiError, BodyOf, Schema } from '../../api'

export type SettingsData = Schema<'SettingsResponse'>
type Values<K extends string> = Record<K, boolean>

export interface ToggleError<K extends string> {
  key: K
  message: string
}

export interface InstantSettings<K extends string> {
  /** The server's settings, or null until they have loaded. */
  data: SettingsData | null
  /** Each toggle's current value, or null until loaded. */
  values: Values<K> | null
  /** Why loading failed, if it did. `reload` tries again. */
  loadError: string | null
  reload: () => void
  saving: K | null
  /** The key that was just saved, for a moment, so its row can say so. */
  saved: K | null
  /** The last toggle that failed to save; its value has been put back. */
  error: ToggleError<K> | null
  toggle: (key: K) => Promise<void>
}

/**
 * What to tell someone when a request failed: the server's own words when it
 * answered, or a plain "couldn't reach it" when it never did (a fetch that
 * rejects without a status is a network failure, not a refusal).
 */
export function failureMessage(e: unknown, t: TFunction, when: 'save' | 'load' = 'save'): string {
  const err = e as ApiError | undefined
  if (err?.status && err.message) {
    return when === 'save'
      ? t('settings.save.failed', { message: err.message })
      : t('settings.save.loadFailed', { message: err.message })
  }
  return when === 'save' ? t('settings.save.offline') : t('settings.save.loadOffline')
}

/**
 * Checkboxes that save the moment they change. The box flips straight away;
 * if the server refuses, it flips back and the row says why, so the page never
 * shows a value that isn't the one in force.
 */
export function useInstantSettings<K extends string>(
  keys: readonly K[],
  { onSaved }: { onSaved?: () => void } = {}
): InstantSettings<K> {
  const { t } = useTranslation()
  const [data, setData] = useState<SettingsData | null>(null)
  const [values, setValues] = useState<Values<K> | null>(null)
  const [loadFailure, setLoadFailure] = useState<unknown>(null)
  const [saving, setSaving] = useState<K | null>(null)
  const [saved, setSaved] = useState<K | null>(null)
  const [failure, setFailure] = useState<{ key: K; cause: unknown } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // The keys are a constant per section; holding them in a ref keeps the
  // load effect from re-running when a caller passes a fresh array literal.
  const keysRef = useRef(keys)

  useEffect(() => {
    let live = true
    settingsApi
      .get()
      .then((d) => {
        if (!live) return
        setData(d)
        const record = d as unknown as Record<string, unknown>
        setValues(Object.fromEntries(keysRef.current.map((k) => [k, !!record[k]])) as Values<K>)
        setLoadFailure(null)
      })
      .catch((e: unknown) => {
        if (live) setLoadFailure(e ?? new Error())
      })
    return () => {
      live = false
    }
  }, [attempt])

  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const reload = useCallback(() => {
    setLoadFailure(null)
    setAttempt((n) => n + 1)
  }, [])

  const toggle = async (key: K) => {
    if (!values) return
    const previous = values[key]
    const next = !previous
    setValues((v) => (v ? { ...v, [key]: next } : v))
    setSaving(key)
    setSaved(null)
    setFailure(null)
    try {
      await settingsApi.patch({ [key]: next } as BodyOf<'/settings', 'patch'>)
      setSaved(key)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(null), 2500)
      onSaved?.()
    } catch (e) {
      setValues((v) => (v ? { ...v, [key]: previous } : v))
      setFailure({ key, cause: e })
    } finally {
      // Another row may have started saving meanwhile; leave its spinner be.
      setSaving((current) => (current === key ? null : current))
    }
  }

  // Messages are worded at render time, so a language switch rewords them.
  const loadError = loadFailure ? failureMessage(loadFailure, t, 'load') : null
  const error = failure ? { key: failure.key, message: failureMessage(failure.cause, t) } : null
  return { data, values, loadError, reload, saving, saved, error, toggle }
}
