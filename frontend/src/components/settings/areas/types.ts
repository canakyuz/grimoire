/** The fields of the signed-in user the settings pages read. */
export interface SettingsUser {
  id?: string
  username?: string
  role?: string | null
  api_keys_allowed?: boolean
  share_links_allowed?: boolean
}
