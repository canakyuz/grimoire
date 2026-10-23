import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../CollapsibleSection'
import SettingsSection from '../SettingsSection'
import DangerZone from '../DangerZone'
import RescanSection from '../RescanSection'
import WatchLibrarySection from '../WatchLibrarySection'
import ScheduledRescanSection from '../ScheduledRescanSection'
import FolderCategorySection from '../FolderCategorySection'
import FolderNamingSection from '../FolderNamingSection'
import VariantRulesSection from '../VariantRulesSection'
import FileManagerSection from '../FileManagerSection'
import DuplicatesSection from '../DuplicatesSection'
import DatabaseCleanupSection from '../DatabaseCleanupSection'

/**
 * Keeping the library folder and Grimoire in step: scanning, how files and
 * folders are read, the tools for reorganising them - and, set apart at the
 * bottom, removing the records of files that are gone.
 */
export default function LibraryArea() {
  const { t } = useTranslation()
  return (
    <>
      <CollapsibleSection
        id="scanning"
        title={t('settings.groups.scanning')}
        description={t('maintenance.groups.scanningDesc')}
        storageKey="grimoire:settings:maintenance:scanning"
      >
        <div className="settings-stack">
          <SettingsSection id="rescan">
            <RescanSection />
          </SettingsSection>
          <SettingsSection id="watch">
            <WatchLibrarySection />
          </SettingsSection>
          <SettingsSection id="scheduled-rescan">
            <ScheduledRescanSection />
          </SettingsSection>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="files-and-folders"
        title={t('settings.groups.filesAndFolders')}
        description={t('settings.groups.filesAndFoldersDesc')}
        storageKey="grimoire:settings:library:files-and-folders"
      >
        <div className="settings-stack">
          <SettingsSection id="folder-category">
            <FolderCategorySection />
          </SettingsSection>
          <SettingsSection
            id="folder-naming"
            title={t('filenameRules.folderTitle')}
            description={t('filenameRules.folderDesc')}
          >
            <FolderNamingSection />
          </SettingsSection>
          <SettingsSection
            id="variant-rules"
            title={t('filenameRules.variantTitle')}
            description={t('filenameRules.variantDesc')}
          >
            <VariantRulesSection />
          </SettingsSection>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="library-tools"
        title={t('settings.groups.tools')}
        description={t('maintenance.groups.libraryDesc')}
        storageKey="grimoire:settings:maintenance:library"
      >
        <div className="settings-stack">
          <SettingsSection id="file-manager">
            <FileManagerSection />
          </SettingsSection>
          <SettingsSection id="duplicates">
            <DuplicatesSection />
          </SettingsSection>
        </div>
      </CollapsibleSection>

      <DangerZone id="library-danger">
        <SettingsSection id="cleanup">
          <DatabaseCleanupSection />
        </SettingsSection>
      </DangerZone>
    </>
  )
}
