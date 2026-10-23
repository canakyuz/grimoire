import { useTranslation } from 'react-i18next'

interface SettingsLoadErrorProps {
  message: string
  onRetry: () => void
}

/**
 * In place of a setting whose current value couldn't be fetched. Showing a
 * guessed default instead would let someone "change" a value they never saw.
 */
export default function SettingsLoadError({ message, onRetry }: SettingsLoadErrorProps) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px 16px',
        fontSize: 14,
        lineHeight: 1.5,
        color: 'var(--danger)',
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 13,
          background: 'var(--bg-card)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
        }}
      >
        {t('settings.save.retry')}
      </button>
    </div>
  )
}
