import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../CollapsibleSection'
import SettingsSection from '../SettingsSection'
import AddonsSection from '../AddonsSection'
import ContentPacksSection from '../ContentPacksSection'

/** Community add-ons and the character content packs installed from them. */
export default function AddonsArea() {
  const { t } = useTranslation()
  return (
    <>
      <SettingsSection id="community-addons">
        <AddonsSection />
      </SettingsSection>
      <CollapsibleSection
        id="content-packs"
        title={t('contentPacks.title')}
        description={t('settings.entries.contentPacksDesc')}
        storageKey="grimoire:settings:addons:content-packs"
      >
        <ContentPacksSection />
      </CollapsibleSection>
    </>
  )
}
