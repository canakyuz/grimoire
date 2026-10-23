import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../CollapsibleSection'
import SettingsSection from '../SettingsSection'
import CodexSection from '../CodexSection'
import GenreManagerSection from '../GenreManagerSection'
import SystemFamilyManagerSection from '../SystemFamilyManagerSection'
import ParentSystemManagerSection from '../ParentSystemManagerSection'
import LicenseManagerSection from '../LicenseManagerSection'
import DiceMaterialManagerSection from '../DiceMaterialManagerSection'
import SidecarExportSection from '../SidecarExportSection'
import type { SettingsVisibility } from '../registry'

interface CatalogueAreaProps {
  visibility: SettingsVisibility
}

// The lookup lists run long (thirty-odd genres out of the box), so they start
// closed and show what they are for instead. Each remembers being opened.
const LISTS = [
  {
    id: 'genres',
    title: 'lookupSettings.genresTitle',
    desc: 'lookupSettings.genresDesc',
    Body: GenreManagerSection,
  },
  {
    id: 'system-families',
    title: 'lookupSettings.familiesTitle',
    desc: 'lookupSettings.familiesDesc',
    Body: SystemFamilyManagerSection,
  },
  {
    id: 'parent-systems',
    title: 'lookupSettings.parentSystemsTitle',
    desc: 'lookupSettings.parentSystemsDesc',
    Body: ParentSystemManagerSection,
  },
  {
    id: 'licenses',
    title: 'lookupSettings.licensesTitle',
    desc: 'lookupSettings.licensesDesc',
    Body: LicenseManagerSection,
  },
  {
    id: 'dice-materials',
    title: 'lookupSettings.diceTitle',
    desc: 'lookupSettings.diceDesc',
    Body: DiceMaterialManagerSection,
  },
] as const

/**
 * Where book and system details come from and what they may say: Grimoire
 * Codex DB, the lookup lists the editors offer, and the sidecar files written
 * back into the library.
 */
export default function CatalogueArea({ visibility }: CatalogueAreaProps) {
  const { t } = useTranslation()
  return (
    <>
      {visibility.codex && (
        <SettingsSection id="codex">
          <CodexSection />
        </SettingsSection>
      )}

      {LISTS.map(({ id, title, desc, Body }) => (
        <CollapsibleSection
          key={id}
          id={id}
          title={t(title)}
          description={t(desc)}
          summary={t(desc)}
          defaultOpen={false}
          storageKey={`grimoire:settings:metadata:${id}`}
        >
          <Body />
        </CollapsibleSection>
      ))}

      <CollapsibleSection
        id="sidecar-files"
        title={t('settings.groups.sidecars')}
        description={t('maintenance.groups.metadataDesc')}
        summary={t('maintenance.groups.metadataDesc')}
        defaultOpen={false}
        storageKey="grimoire:settings:maintenance:metadata"
      >
        <SettingsSection id="sidecars">
          <SidecarExportSection />
        </SettingsSection>
      </CollapsibleSection>
    </>
  )
}
