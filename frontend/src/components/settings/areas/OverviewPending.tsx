import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Spinner from '../../Spinner'
import type { Loaded } from './overviewData'

interface OverviewPendingProps<T> {
  value: Loaded<T>
  children: (value: T) => ReactNode
}

/** A spinner while the line's request is out, a quiet note if it failed. */
export default function OverviewPending<T>({ value, children }: OverviewPendingProps<T>) {
  const { t } = useTranslation()
  if (value === undefined) return <Spinner size={14} />
  if (value === null) {
    return <span className="settings-ledger-detail">{t('settings.overview.unavailable')}</span>
  }
  return <>{children(value)}</>
}
