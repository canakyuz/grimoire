import { useEffect, useState } from 'react'

/** A request's answer: `undefined` while it is out, `null` when it failed. */
export type Loaded<T> = T | null | undefined

/** Run one request when the overview mounts. */
export function useLoad<T>(load: () => Promise<unknown>): Loaded<T> {
  const [value, setValue] = useState<Loaded<T>>(undefined)
  useEffect(() => {
    let live = true
    load()
      .then((v) => live && setValue(v as T))
      .catch(() => live && setValue(null))
    return () => {
      live = false
    }
    // Loaded once per visit to the overview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return value
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/** "2 hours ago", in the interface language. */
export function timeAgo(iso: string, language: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return rtf.format(0, 'minute')
}

/** A time of day ("3:00 AM", "03:00") in the interface language. */
export function clock(hour: number, minute: number, language: string): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' })
}
