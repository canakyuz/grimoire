import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuDatabase, LuExternalLink, LuSend, LuUnlink } from 'react-icons/lu'
import api, { type Schema } from '../../api'
import useCodexStatus from './useCodexStatus'
import CodexSendForm from './CodexSendForm'
import { COMPACT, REGULAR, actionRow, button, link } from './codexPanelStyles'

type SubmitResult = Schema<'CodexSubmitResponse'>

interface CodexPanelProps {
  kind: 'books' | 'systems'
  resourceId: string
  codexId: string | null
  onLinkChange?: (codexId: string | null) => void
  compact?: boolean
}

/**
 * Where a book or system stands in Grimoire Codex DB (issue #35), shown in its
 * editor: linked or not, a link to the Grimoire Codex DB record, and the two outbound
 * actions — send it (a new record, or the fields that differ as a correction)
 * and unlink.
 *
 * Finding and linking a record is not here: that is "Fetch metadata", where
 * Grimoire Codex DB is a built-in source and applying a result links the record.
 *
 * Like the editor's other act-immediately sections (versions, cover upload) it
 * is an unframed block above the Save row, styled at its host's scale rather
 * than as a card of its own — `compact` matches the book editor's denser type.
 *
 * `codexId` is owned by the editor, which also learns of links made through
 * Fetch metadata; `onLinkChange` reports changes made here.
 */
export default function CodexPanel({
  kind,
  resourceId,
  codexId,
  onLinkChange,
  compact = false,
}: CodexPanelProps) {
  const { t } = useTranslation()
  const status = useCodexStatus()
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)

  if (!status?.enabled) return null

  const linked = !!codexId
  const recordUrl = linked ? `${status.url}/${kind}/${codexId}` : undefined
  const s = compact ? COMPACT : REGULAR

  const sent = (r: SubmitResult) => {
    setResult(r)
    setSending(false)
    if (r.linked && r.codex_id !== codexId) onLinkChange?.(r.codex_id ?? null)
  }

  const unlink = () => {
    setBusy(true)
    setError('')
    setResult(null)
    api
      .delete(`/codex/${kind}/${resourceId}/link`)
      .then(() => onLinkChange?.(null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }

  const resultText = (r: SubmitResult) => {
    if (r.status === 'waiting_for_system') return t('codex.send.waitingForSystem')
    return r.status === 'applied' ? t('codex.panel.applied') : t('codex.panel.pending')
  }

  return (
    <section aria-labelledby={`codex-${resourceId}`} style={s.section}>
      <h4 id={`codex-${resourceId}`} style={s.heading}>
        <LuDatabase size={14} aria-hidden="true" />
        {t('codex.panel.title')}
      </h4>
      <p style={{ ...s.text, color: 'var(--text-muted)', margin: 0 }}>
        {linked ? (
          <a href={recordUrl} target="_blank" rel="noreferrer" style={link}>
            {t('codex.panel.linked')} <LuExternalLink size={11} aria-hidden="true" />
          </a>
        ) : (
          t('codex.panel.notLinked')
        )}
      </p>

      {!sending && (
        <div style={actionRow}>
          <button
            type="button"
            onClick={() => {
              setResult(null)
              setSending(true)
            }}
            disabled={busy}
            style={button(s, busy)}
          >
            <LuSend size={13} aria-hidden="true" />
            {linked ? t('codex.panel.sendCorrection') : t('codex.panel.add')}
          </button>
          {linked && (
            <button type="button" onClick={unlink} disabled={busy} style={button(s, busy)}>
              <LuUnlink size={13} aria-hidden="true" />
              {t('codex.panel.unlink')}
            </button>
          )}
        </div>
      )}

      {sending && (
        <CodexSendForm
          kind={kind}
          resourceId={resourceId}
          linked={linked}
          scale={s}
          onSent={sent}
          onCancel={() => setSending(false)}
        />
      )}

      {result && (
        <p role="status" style={{ ...s.text, color: 'var(--text-dim)', margin: '10px 0 0' }}>
          {resultText(result)}{' '}
          <a href={result.edit_url} target="_blank" rel="noreferrer" style={link}>
            {t('codex.panel.viewEdit')}
          </a>
        </p>
      )}
      {error && (
        <p role="alert" style={{ ...s.text, color: 'var(--danger)', margin: '10px 0 0' }}>
          {error}
        </p>
      )}
    </section>
  )
}
