import SettingsSection from '../SettingsSection'
import SidebarVisibilitySection from '../SidebarVisibilitySection'
import StatsDisplaySection from '../StatsDisplaySection'

/** What the sidebar shows everyone. */
export default function SidebarArea() {
  return (
    <div className="settings-stack">
      <SettingsSection id="sidebar-visibility">
        <SidebarVisibilitySection />
      </SettingsSection>
      <SettingsSection id="sidebar-stats">
        <StatsDisplaySection />
      </SettingsSection>
    </div>
  )
}
