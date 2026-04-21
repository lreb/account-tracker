/**
 * Google Drive backup integration — OAuth2 Authorization Code + PKCE flow.
 *
 * Setup (one-time):
 *  1. Go to https://console.cloud.google.com → APIs & Services → Credentials
 *  2. Create an OAuth 2.0 Client ID  →  Application type: Web application
 *  3. Authorized JavaScript origins:  http://localhost:5173  (and your prod URL)
 *  4. Authorized redirect URIs:       http://localhost:5173/oauth-callback
 *                                     https://<your-prod-domain>/oauth-callback
 *  5. Enable the Google Drive API for the project
 *  6. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET in .env
 *     ⚠ The client secret is bundled in the JS bundle. This is acceptable for
 *       personal/private apps. For a public app, proxy the token exchange via a backend.
 *
 * Scope used:
 *  - drive.file: read/write files created by this app
 *  - drive.metadata.readonly: list folders so user can pick destination
 */

const ENV_CLIENT_ID     = (import.meta.env.VITE_GOOGLE_CLIENT_ID     as string | undefined) ?? ''
const ENV_CLIENT_SECRET = (import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined) ?? ''
const ENV_REDIRECT_URI  = (import.meta.env.VITE_GOOGLE_REDIRECT_URI  as string | undefined)?.trim() ?? ''
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]
const SCOPE = REQUIRED_SCOPES.join(' ')
const BACKUP_FILE_PREFIX = 'expense-tracking'
export const APP_BACKUP_FOLDER_NAME = 'ExpenseTracking Backups'

// ── Storage keys ──────────────────────────────────────────────────────────────
// Tokens go in localStorage to survive page reloads and browser restarts.
// Transient OAuth state (verifier, return path) uses sessionStorage — cleared after use.
const ACCESS_TOKEN_KEY  = '__gd_access_token__'
const REFRESH_TOKEN_KEY = '__gd_refresh_token__'
const TOKEN_EXPIRY_KEY  = '__gd_token_expiry__'   // Unix timestamp ms
const RETURN_KEY        = '__oauth_return__'       // sessionStorage
const CODE_VERIFIER_KEY = '__oauth_cv__'           // sessionStorage
const SCOPE_KEY         = '__gd_scope__'
const PROFILE_KEY       = '__gd_profile__'

export interface GoogleDriveAccountProfile {
  name: string
  email: string
  pictureUrl: string
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function getOAuthRedirectUri(): string {
  if (ENV_REDIRECT_URI) {
    try {
      const configured = new URL(ENV_REDIRECT_URI)
      const runtime = new URL(window.location.origin)

      const configuredIsLocal = isLocalHost(configured.hostname)
      const runtimeIsLocal = isLocalHost(runtime.hostname)

      // Ignore localhost redirect URI when app is running on a non-local origin.
      if (!(configuredIsLocal && !runtimeIsLocal)) {
        return configured.toString()
      }
    } catch {
      // Ignore invalid env value and fall back to computed runtime redirect URI.
    }
  }

  const baseUrl = (import.meta.env.BASE_URL as string | undefined) ?? '/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const callbackPath = `${normalizedBase}oauth-callback`
  return new URL(callbackPath, window.location.origin).toString()
}

// ── Configuration ─────────────────────────────────────────────────────────────

/** Returns true only when a Client ID is available (either provided or from env). */
export function isGoogleDriveConfigured(clientId?: string): boolean {
  return (clientId || ENV_CLIENT_ID).length > 0
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function base64UrlEncode(buffer: Uint8Array): string {
  let str = ''
  for (const byte of buffer) str += String.fromCharCode(byte)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier)
  const digest  = await crypto.subtle.digest('SHA-256', encoded)
  return base64UrlEncode(new Uint8Array(digest))
}

// ── Token management ──────────────────────────────────────────────────────────

function storeTokens(accessToken: string, refreshToken: string | null, expiresIn: number): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000))
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

function isAccessTokenExpired(): boolean {
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10)
  if (!expiry) return true
  return Date.now() >= expiry - 60_000 // 60 s buffer so we refresh before actual expiry
}

/**
 * Returns true when a valid session exists: either a refresh token is persisted
 * (allows silent renewal at any time) or a non-expired access token is available.
 */
export function isSignedInToGoogle(): boolean {
  return (
    !!localStorage.getItem(REFRESH_TOKEN_KEY) ||
    (!!localStorage.getItem(ACCESS_TOKEN_KEY) && !isAccessTokenExpired())
  )
}

export function signOutOfGoogle(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(SCOPE_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) throw new Error('No refresh token — please reconnect Google Drive.')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     ENV_CLIENT_ID,
      client_secret: ENV_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; error_description?: string }
    if (err.error === 'invalid_grant') {
      signOutOfGoogle()
      throw new Error('Google session expired — please reconnect.')
    }
    throw new Error(err.error_description ?? err.error ?? `Token refresh failed (${res.status})`)
  }

  const data = await res.json() as {
    access_token:   string
    expires_in:     number
    refresh_token?: string
    scope?:         string
  }

  storeTokens(data.access_token, data.refresh_token ?? null, data.expires_in)
  if (data.scope) localStorage.setItem(SCOPE_KEY, data.scope)
  return data.access_token
}

/**
 * Returns a valid access token. Auto-refreshes using the stored refresh token when
 * the current access token is expired. Returns null if not signed in.
 */
export async function getGoogleToken(): Promise<string | null> {
  if (!localStorage.getItem(REFRESH_TOKEN_KEY) && !localStorage.getItem(ACCESS_TOKEN_KEY)) return null
  if (!isAccessTokenExpired()) return localStorage.getItem(ACCESS_TOKEN_KEY)
  try {
    return await refreshAccessToken()
  } catch {
    return null
  }
}

function getCachedGoogleProfile(): GoogleDriveAccountProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleDriveAccountProfile>
    if (!parsed.name || !parsed.email || !parsed.pictureUrl) return null
    return { name: parsed.name, email: parsed.email, pictureUrl: parsed.pictureUrl }
  } catch {
    return null
  }
}

function setCachedGoogleProfile(profile: GoogleDriveAccountProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

// ── OAuth2 Authorization Code + PKCE flow ─────────────────────────────────────

/**
 * Redirects to Google's OAuth consent screen using Authorization Code + PKCE.
 * `access_type=offline` + `prompt=consent` ensure a refresh token is always issued.
 */
export async function startGoogleSignIn(clientId: string, returnTo = '/settings'): Promise<void> {
  const activeClientId = clientId || ENV_CLIENT_ID
  if (!activeClientId) throw new Error('Missing Google Client ID')

  const verifier  = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem(CODE_VERIFIER_KEY, verifier)
  sessionStorage.setItem(RETURN_KEY, returnTo)

  const params = new URLSearchParams({
    client_id:              activeClientId,
    redirect_uri:           getOAuthRedirectUri(),
    response_type:          'code',
    scope:                  SCOPE,
    access_type:            'offline',
    prompt:                 'consent',
    code_challenge:         challenge,
    code_challenge_method:  'S256',
    include_granted_scopes: 'true',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/**
 * Called by OAuthCallbackPage. Exchanges the authorization code for an access token
 * and refresh token, stores both persistently, and returns the path to navigate to.
 */
export async function handleOAuthCallback(): Promise<string> {
  const queryParams    = new URLSearchParams(window.location.search)
  const fragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  const oauthError = queryParams.get('error') ?? fragmentParams.get('error')
  if (oauthError) {
    const description = queryParams.get('error_description') ?? fragmentParams.get('error_description') ?? ''
    throw new Error(description || oauthError)
  }

  const code = queryParams.get('code') ?? fragmentParams.get('code')
  if (!code) throw new Error('No authorization code found in OAuth redirect.')

  const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY)
  sessionStorage.removeItem(CODE_VERIFIER_KEY)
  if (!verifier) throw new Error('PKCE code verifier missing — the sign-in flow may have been interrupted.')

  if (!ENV_CLIENT_ID || !ENV_CLIENT_SECRET) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_SECRET in environment.')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  getOAuthRedirectUri(),
      client_id:     ENV_CLIENT_ID,
      client_secret: ENV_CLIENT_SECRET,
      code_verifier: verifier,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; error_description?: string }
    throw new Error(err.error_description ?? err.error ?? `Token exchange failed (${res.status})`)
  }

  const data = await res.json() as {
    access_token:   string
    refresh_token?: string
    expires_in:     number
    scope?:         string
  }

  if (!data.access_token) throw new Error('Token exchange did not return an access_token.')
  if (!data.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Ensure prompt=consent is set, then try reconnecting.',
    )
  }

  storeTokens(data.access_token, data.refresh_token, data.expires_in)

  if (data.scope) {
    const granted = new Set(data.scope.split(/[\s,]+/).filter(Boolean))
    const missing = REQUIRED_SCOPES.filter((s) => !granted.has(s))
    if (missing.length > 0) {
      signOutOfGoogle()
      throw new Error('Google permissions are outdated. Please reconnect and grant Drive permissions.')
    }
    localStorage.setItem(SCOPE_KEY, data.scope)
  }

  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '/settings'
  sessionStorage.removeItem(RETURN_KEY)
  return returnTo
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

async function driveRequest(path: string, options: Parameters<typeof fetch>[1] = {}): Promise<Response> {
  const token = await getGoogleToken()
  if (!token) throw new Error('Not connected to Google Drive.')
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    let details = ''
    try {
      const cloned = res.clone()
      const payload = await cloned.json() as {
        error?: {
          message?: string
          status?: string
          errors?: Array<{ reason?: string; message?: string }>
        }
      }
      const err = payload.error
      if (err) {
        const reason = err.errors?.[0]?.reason
        const message = err.message || err.errors?.[0]?.message || err.status
        details = [reason, message].filter(Boolean).join(': ')
      }
    } catch {
      // Ignore JSON parse errors; we'll use status text fallback below.
    }

    if (!details) {
      details = res.statusText || `HTTP ${res.status}`
    }

    if (res.status === 401) {
      signOutOfGoogle()
      throw new Error('Google session expired — please reconnect.')
    }

    if (res.status === 403) {
      if (details.toLowerCase().includes('insufficientscopes')) {
        signOutOfGoogle()
        throw new Error('Google permissions are outdated. Please reconnect Google Drive and try again.')
      }
      throw new Error(`Drive access denied (403): ${details}. Ensure Google Drive API is enabled for this OAuth project and reconnect Google.`)
    }

    throw new Error(`Drive request failed (${res.status}): ${details}`)
  }

  if (res.status === 401) {
    signOutOfGoogle()
    throw new Error('Google session expired — please reconnect.')
  }
  return res
}

export interface DriveFolderOption {
  id: string
  name: string
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/'/g, "\\'")
}

function formatFilenameTimestamp(date: Date): string {
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`
}

function buildBackupFilename(): string {
  return `${BACKUP_FILE_PREFIX}_${formatFilenameTimestamp(new Date())}.json`
}

async function findLatestBackupFileId(folderId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name contains '${escapeDriveQueryValue(`${BACKUP_FILE_PREFIX}_`)}' and trashed=false and '${escapeDriveQueryValue(folderId)}' in parents`,
  )
  const res = await driveRequest(
    `/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=1&orderBy=modifiedTime desc`,
  )
  if (!res.ok) throw new Error(`Could not list Drive files: ${res.statusText}`)
  const json = await res.json() as { files: { id: string }[] }
  return json.files[0]?.id ?? null
}

export async function listDriveFolders(): Promise<DriveFolderOption[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents")
  const res = await driveRequest(
    `/files?q=${q}&fields=files(id,name)&pageSize=200&orderBy=name_natural`,
  )
  if (!res.ok) throw new Error(`Could not list Drive folders: ${res.statusText}`)
  const json = await res.json() as { files: DriveFolderOption[] }
  return json.files
}

async function findRootFolderByName(name: string): Promise<DriveFolderOption | null> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents and name='${escapeDriveQueryValue(name)}'`,
  )
  const res = await driveRequest(`/files?q=${q}&fields=files(id,name)&pageSize=1`)
  if (!res.ok) throw new Error(`Could not find Drive folder: ${res.statusText}`)
  const json = await res.json() as { files: DriveFolderOption[] }
  return json.files[0] ?? null
}

export async function createDriveFolder(name: string): Promise<DriveFolderOption> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Folder name is required.')

  const res = await driveRequest('/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: trimmedName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    }),
  })

  if (!res.ok) throw new Error(`Could not create Drive folder: ${res.statusText}`)
  return await res.json() as DriveFolderOption
}

export async function ensureAppBackupFolder(): Promise<DriveFolderOption> {
  const existing = await findRootFolderByName(APP_BACKUP_FOLDER_NAME)
  if (existing) return existing
  return createDriveFolder(APP_BACKUP_FOLDER_NAME)
}

/** Uploads (creates or overwrites) the backup file in the selected Drive folder. */
export async function uploadBackupToDrive(content: string, folderId = 'root'): Promise<void> {
  const token = await getGoogleToken()
  if (!token) throw new Error('Not connected to Google Drive.')

  const blob = new Blob([content], { type: 'application/json' })
  const backupFilename = buildBackupFilename()

  // Create a timestamped backup file in selected folder.
  const metadata = JSON.stringify({ name: backupFilename, parents: [folderId] })
  const form = new FormData()
  form.append('metadata', new Blob([metadata], { type: 'application/json' }))
  form.append('file', blob)
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  )
  if (res.status === 401) { signOutOfGoogle(); throw new Error('Google session expired — please reconnect.') }
  if (!res.ok) throw new Error(`Drive upload failed: ${res.statusText}`)
}

/** Downloads backup content from the selected Drive folder. Throws if no backup exists. */
export async function downloadBackupFromDrive(folderId = 'root'): Promise<string> {
  const fileId = await findLatestBackupFileId(folderId)
  if (!fileId) throw new Error('No backup found on Google Drive.')
  const res = await driveRequest(`/files/${fileId}?alt=media`)
  if (!res.ok) throw new Error(`Drive download failed: ${res.statusText}`)
  return res.text()
}

/** Returns the authenticated Google account profile used for Drive sync. */
export async function getGoogleDriveAccountProfile(forceRefresh = false): Promise<GoogleDriveAccountProfile | null> {
  if (!isSignedInToGoogle()) return null

  if (!forceRefresh) {
    const cached = getCachedGoogleProfile()
    if (cached) return cached
  }

  const res = await driveRequest('/about?fields=user(displayName,emailAddress,photoLink)')
  if (!res.ok) throw new Error(`Could not load Google account profile: ${res.statusText}`)

  const payload = await res.json() as {
    user?: {
      displayName?: string
      emailAddress?: string
      photoLink?: string
    }
  }

  const name = payload.user?.displayName?.trim() ?? ''
  const email = payload.user?.emailAddress?.trim() ?? ''
  const pictureUrl = payload.user?.photoLink?.trim() ?? ''

  if (!name || !email || !pictureUrl) {
    throw new Error('Google account profile is incomplete.')
  }

  const profile: GoogleDriveAccountProfile = {
    name,
    email,
    pictureUrl,
  }

  setCachedGoogleProfile(profile)
  return profile
}
