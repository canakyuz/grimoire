import SettingsSection from '../SettingsSection'
import OPDSSection from '../OPDSSection'
import ApiKeySection from '../ApiKeySection'
import ShareLinksSection from '../ShareLinksSection'
import type { SettingsVisibility } from '../registry'
import type { SettingsUser } from './types'

interface ConnectionsAreaProps {
  user: SettingsUser
  visibility: SettingsVisibility
}

/** Everything that reaches your library from outside Grimoire. */
export default function ConnectionsArea({ user, visibility }: ConnectionsAreaProps) {
  return (
    <div className="settings-stack">
      <SettingsSection id="opds">
        <OPDSSection />
      </SettingsSection>
      {visibility.apiKeys && (
        <SettingsSection id="api-keys">
          <ApiKeySection />
        </SettingsSection>
      )}
      {visibility.shareLinks && (
        <SettingsSection id="share-links">
          <ShareLinksSection canShare={Boolean(user?.share_links_allowed)} />
        </SettingsSection>
      )}
    </div>
  )
}
