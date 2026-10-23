import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../CollapsibleSection'
import SettingsSection from '../SettingsSection'
import DangerZone from '../DangerZone'
import DisplayNameSection from '../DisplayNameSection'
import EmailSection from '../EmailSection'
import ChangePasswordSection from '../ChangePasswordSection'
import ActiveSessionsSection from '../ActiveSessionsSection'
import DeleteAccountSection from '../DeleteAccountSection'
import type { SettingsUser } from './types'

interface AccountAreaProps {
  user: SettingsUser
  onLogout?: () => void
}

/** Who you are to other people, how you sign in, and leaving. */
export default function AccountArea({ user, onLogout }: AccountAreaProps) {
  const { t } = useTranslation()
  return (
    <>
      <CollapsibleSection
        id="profile"
        title={t('settings.groups.profile')}
        description={t('userSettings.groups.profileDesc')}
        storageKey="grimoire:settings:account:profile"
      >
        <div className="settings-stack">
          <SettingsSection id="display-name" title={t('userSettings.displayName.title')}>
            <DisplayNameSection />
          </SettingsSection>
          <SettingsSection id="email" title={t('userSettings.email.title')}>
            <EmailSection />
          </SettingsSection>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="security"
        title={t('settings.groups.security')}
        description={t('settings.groups.securityDesc')}
        storageKey="grimoire:settings:account:security"
      >
        <div className="settings-stack">
          <SettingsSection id="change-password">
            <ChangePasswordSection />
          </SettingsSection>
          <SettingsSection id="sessions">
            <ActiveSessionsSection />
          </SettingsSection>
        </div>
      </CollapsibleSection>

      <DangerZone id="account-danger">
        <SettingsSection id="delete-account">
          <DeleteAccountSection user={user} onLogout={onLogout} />
        </SettingsSection>
      </DangerZone>
    </>
  )
}
