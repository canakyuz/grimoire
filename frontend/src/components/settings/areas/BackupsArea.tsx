import { useState } from 'react'
import SettingsSection from '../SettingsSection'
import BackupListSection from '../BackupListSection'
import BackupScheduleSection from '../BackupScheduleSection'

/** Backing up the database and Grimoire's own files, by hand or on a schedule. */
export default function BackupsArea() {
  // Saving the schedule can change the storage directory, which changes which
  // backups the list should be showing - so a save re-fetches the list.
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div className="settings-stack">
      <SettingsSection id="backup-list">
        <BackupListSection refreshKey={refreshKey} />
      </SettingsSection>
      <SettingsSection id="backup-schedule">
        <BackupScheduleSection onSaved={() => setRefreshKey((k) => k + 1)} />
      </SettingsSection>
    </div>
  )
}
