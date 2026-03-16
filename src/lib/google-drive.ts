/**
 * Google Drive backup integration — OAuth2 implicit flow (public client, no client secret).
 *
 * Setup (one-time):
 *  1. Go to https://console.cloud.google.com → APIs & Services → Credentials
 *  2. Create an OAuth 2.0 Client ID (Web application type)
 *  3. Add your app's origin to "Authorized JavaScript origins"
 *  4. Add <origin>/oauth-callback to "Authorized redirect URIs"
 *  5. Enable the Google Drive API for the project
 *  6. Set VITE_GOOGLE_CLIENT_ID=<your-client-id> in .env
 *
 * Scope used: drive.appdata — writes to a hidden app-specific folder,
 * never touches the user's My Drive files.
 */

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
const ENV_REDIRECT_URI = (import.meta.env.VITE_GOOGLE_REDIRECT_URI as string | undefined)?.trim() ?? ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const BACKUP_FILENAME = 'expense-tracking-backup.json'
const TOKEN_KEY = '__gd_token__'
const RETURN_KEY = '__oauth_return__'

function getOAuthRedirectUri(): string {
  return ENV_REDIRECT_URI || `${window.location.origin}/oauth-callback`
}

// ── Configuration ─────────────────────────────────────────────────────────────

/** Returns true only when a Client ID is available (either provided or from env). */
export function isGoogleDriveConfigured(clientId?: string): boolean {
  return (clientId || ENV_CLIENT_ID).length > 0
}

// ── Token management ──────────────────────────────────────────────────────────

export function getGoogleToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function isSignedInToGoogle(): boolean {
  return !!getGoogleToken()
}

export function signOutOfGoogle(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

// ── OAuth2 implicit flow ──────────────────────────────────────────────────────

/**
 * Redirects the main window to Google's OAuth consent screen.
 * After the user grants permission, Google redirects to /oauth-callback,
 * which captures the token and navigates back to `returnTo`.
 */
export function startGoogleSignIn(clientId: string, returnTo = '/settings'): void {
  const activeClientId = clientId || ENV_CLIENT_ID
  if (!activeClientId) throw new Error('Missing Google Client ID')

  sessionStorage.setItem(RETURN_KEY, returnTo)
  const params = new URLSearchParams({
    client_id: activeClientId,
    redirect_uri: getOAuthRedirectUri(),
    response_type: 'token',
    response_mode: 'fragment',
    scope: SCOPE,
    include_granted_scopes: 'true',
    // Force consent so Drive appDataFolder scope is explicitly granted.
    prompt: 'consent select_account',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/**
 * Called by OAuthCallbackPage. Parses the access token from the URL hash,
 * stores it in sessionStorage, and returns the path to navigate back to.
 */
export function handleOAuthCallback(hash: string): string {
  const fragmentParams = new URLSearchParams(hash.replace(/^#/, ''))
  const queryParams = new URLSearchParams(window.location.search)

  const oauthError = fragmentParams.get('error') || queryParams.get('error')
  if (oauthError) {
    const description = fragmentParams.get('error_description') || queryParams.get('error_description') || ''
    throw new Error(description || oauthError)
  }

  const token = fragmentParams.get('access_token') || queryParams.get('access_token')
  if (!token) {
    const code = fragmentParams.get('code') || queryParams.get('code')
    if (code) {
      throw new Error('OAuth returned an authorization code instead of an access token.')
    }
    throw new Error('No access_token found in OAuth redirect.')
  }

  sessionStorage.setItem(TOKEN_KEY, token)
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '/settings'
  sessionStorage.removeItem(RETURN_KEY)
  return returnTo
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

async function driveRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getGoogleToken()
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

async function findBackupFileId(): Promise<string | null> {
  const q = encodeURIComponent(`name='${BACKUP_FILENAME}'`)
  const res = await driveRequest(
    `/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)&pageSize=1`,
  )
  if (!res.ok) throw new Error(`Could not list Drive files: ${res.statusText}`)
  const json = await res.json() as { files: { id: string }[] }
  return json.files[0]?.id ?? null
}

/** Uploads (creates or overwrites) the backup file in the app's Drive appDataFolder. */
export async function uploadBackupToDrive(content: string): Promise<void> {
  const token = getGoogleToken()
  if (!token) throw new Error('Not connected to Google Drive.')

  const existingId = await findBackupFileId()
  const blob = new Blob([content], { type: 'application/json' })

  if (existingId) {
    // Overwrite existing file with media-only upload
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: blob,
      },
    )
    if (res.status === 401) { signOutOfGoogle(); throw new Error('Google session expired — please reconnect.') }
    if (!res.ok) throw new Error(`Drive upload failed: ${res.statusText}`)
  } else {
    // Create new file in appDataFolder via multipart upload
    const metadata = JSON.stringify({ name: BACKUP_FILENAME, parents: ['appDataFolder'] })
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
}

/** Downloads the latest backup file content from Drive. Throws if no backup exists. */
export async function downloadBackupFromDrive(): Promise<string> {
  const fileId = await findBackupFileId()
  if (!fileId) throw new Error('No backup found on Google Drive.')
  const res = await driveRequest(`/files/${fileId}?alt=media`)
  if (!res.ok) throw new Error(`Drive download failed: ${res.statusText}`)
  return res.text()
}
