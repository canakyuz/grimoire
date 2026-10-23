import SettingsSection from '../SettingsSection'
import PasswordAuthSection from '../PasswordAuthSection'
import OIDCSettingsSection from '../OIDCSettingsSection'
import GuestAccessSection from '../GuestAccessSection'
import LoginMessageSection from '../LoginMessageSection'

/** How people get in: passwords, single sign-on, guest codes, the login page. */
export default function SignInArea() {
  return (
    <div className="settings-stack">
      <SettingsSection id="password-sign-in">
        <PasswordAuthSection />
      </SettingsSection>
      <SettingsSection id="oidc">
        <OIDCSettingsSection />
      </SettingsSection>
      <SettingsSection id="guest-access">
        <GuestAccessSection />
      </SettingsSection>
      <SettingsSection id="login-message">
        <LoginMessageSection />
      </SettingsSection>
    </div>
  )
}
