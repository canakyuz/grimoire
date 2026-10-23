import SettingsSection from '../SettingsSection'
import UsersTab from '../UsersTab'

/** Everyone with an account here, and the guests GMs have invited. */
export default function PeopleArea() {
  return (
    <SettingsSection id="users">
      <UsersTab />
    </SettingsSection>
  )
}
