import { useTranslation } from 'react-i18next'
import api, { backups as backupsApi, settings as settingsApi } from '../../../api'
import type { Schema } from '../../../api'
import useScanStatus from '../../../hooks/useScanStatus'
import useCodexStatus from '../../codex/useCodexStatus'
import scanPhaseLabel from '../scanPhaseLabel'
import OverviewRow from './OverviewRow'
import OverviewAttention from './OverviewAttention'
import OverviewPending from './OverviewPending'
import { clock, timeAgo, useLoad } from './overviewData'

type Settings = Schema<'SettingsResponse'>
type BackupList = Schema<'BackupListResponse'>
type BackupSettings = Schema<'BackupSettingsResponse'>
type AddonList = Schema<'AddonListResponse'>

/**
 * The admin's landing page: one line on each part of the server that can need
 * attention, each linked to the settings behind it.
 */
export default function OverviewArea() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { status: scan } = useScanStatus()
  const codex = useCodexStatus()
  const settings = useLoad<Settings>(() => settingsApi.get())
  const backupList = useLoad<BackupList>(() => backupsApi.list())
  const backupSettings = useLoad<BackupSettings>(() => backupsApi.getSettings())
  const users = useLoad<unknown[]>(() => api.get('/users'))
  const guests = useLoad<unknown[]>(() => api.get('/users/guests'))
  const addons = useLoad<AddonList>(() => api.get('/addons'))

  const scanLine = (s: Settings) => {
    const watching = s.library_watch_enabled && s.library_watch_state?.state !== 'unavailable'
    const schedule = s.rescan_schedule_enabled
      ? t('settings.overview.library.schedule', {
          interval: t(`maintenance.scheduledRescan.${s.rescan_schedule_interval}`),
          time: clock(s.rescan_schedule_hour, s.rescan_schedule_minute, lang),
        })
      : t('settings.overview.library.noSchedule')
    return (
      <>
        <span>
          {scan.running
            ? scanPhaseLabel(t, scan)
            : watching
              ? t('settings.overview.library.watching')
              : t('settings.overview.library.notWatching')}
        </span>
        <span className="settings-ledger-detail">{schedule}</span>
        {s.library_watch_state?.state === 'unavailable' && (
          <OverviewAttention>{t('settings.overview.library.watchUnavailable')}</OverviewAttention>
        )}
      </>
    )
  }

  const backupLine = (list: BackupList) => {
    const latest = [...list.backups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const schedule = backupSettings?.backup_schedule
    const scheduled = schedule && schedule !== 'off'
    return (
      <>
        {latest ? (
          <span>
            {t('settings.overview.backups.last', { when: timeAgo(latest.created_at, lang) })}
          </span>
        ) : (
          <OverviewAttention>{t('settings.overview.backups.none')}</OverviewAttention>
        )}
        <span className="settings-ledger-detail">
          {t('settings.overview.backups.kept', { count: list.backups.length })}
          {' · '}
          {scheduled
            ? t('settings.overview.backups.scheduled', {
                interval: t(`backups.schedule.${schedule}`),
              })
            : t('settings.overview.backups.manual')}
        </span>
      </>
    )
  }

  const signInLine = (s: Settings) => {
    const sso = s.oidc_enabled
    const password = s.password_auth_enabled
    const mode =
      password && sso
        ? t('settings.overview.signIn.both')
        : sso
          ? t('settings.overview.signIn.ssoOnly')
          : t('settings.overview.signIn.passwordOnly')
    return (
      <>
        <span>{mode}</span>
        <span className="settings-ledger-detail">
          {s.guest_access_enabled
            ? t('settings.overview.signIn.guestsOn')
            : t('settings.overview.signIn.guestsOff')}
        </span>
        {sso && s.oidc_configured === false && (
          <OverviewAttention>{t('settings.overview.signIn.ssoIncomplete')}</OverviewAttention>
        )}
      </>
    )
  }

  const addonLine = (list: AddonList) => {
    const updates = list.installed.filter((a) => a.update_available).length
    return (
      <>
        <span>{t('settings.overview.addons.installed', { count: list.installed.length })}</span>
        {updates > 0 && (
          <OverviewAttention>
            {t('settings.overview.addons.updates', { count: updates })}
          </OverviewAttention>
        )}
      </>
    )
  }

  return (
    <dl className="settings-ledger">
      <OverviewRow
        label={t('settings.areas.library.title')}
        to="/settings/library#scanning"
        linkLabel={t('settings.overview.open')}
      >
        <OverviewPending value={settings}>{scanLine}</OverviewPending>
      </OverviewRow>
      <OverviewRow
        label={t('settings.areas.backups.title')}
        to="/settings/backups"
        linkLabel={t('settings.overview.open')}
      >
        <OverviewPending value={backupList}>{backupLine}</OverviewPending>
      </OverviewRow>
      <OverviewRow
        label={t('settings.areas.sign-in.title')}
        to="/settings/sign-in"
        linkLabel={t('settings.overview.open')}
      >
        <OverviewPending value={settings}>{signInLine}</OverviewPending>
      </OverviewRow>
      <OverviewRow
        label={t('settings.areas.people.title')}
        to="/settings/people"
        linkLabel={t('settings.overview.open')}
      >
        <OverviewPending value={users}>
          {(list) => (
            <>
              <span>{t('settings.overview.people.users', { count: list.length })}</span>
              {Array.isArray(guests) && (
                <span className="settings-ledger-detail">
                  {t('settings.overview.people.guests', { count: guests.length })}
                </span>
              )}
            </>
          )}
        </OverviewPending>
      </OverviewRow>
      <OverviewRow
        label={t('settings.areas.addons.title')}
        to="/settings/addons"
        linkLabel={t('settings.overview.open')}
      >
        <OverviewPending value={addons}>{addonLine}</OverviewPending>
      </OverviewRow>
      {codex?.enabled && (
        <OverviewRow
          label={t('codex.settings.title')}
          to="/settings/catalogue#codex"
          linkLabel={t('settings.overview.open')}
        >
          <span>{t('settings.overview.codex.connected')}</span>
          <span className="settings-ledger-detail">{codex.url}</span>
        </OverviewRow>
      )}
    </dl>
  )
}
