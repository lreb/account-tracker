import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { handleOAuthCallback, signOutOfGoogle } from '@/lib/google-drive'

/**
 * Handles the Google OAuth2 redirect.
 * Google sends the user here after they grant/deny permissions.
 * This page is intentionally outside the Shell layout (no nav/header).
 */
export default function OAuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    let returnTo = '/settings'
    try {
      returnTo = handleOAuthCallback(window.location.hash)
      toast.success('Connected to Google Drive.')
    } catch (err) {
      console.error('OAuth callback error:', err)
      signOutOfGoogle()
      toast.error('Google sign-in failed. Please try again.')
    }
    navigate(returnTo, { replace: true })
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-gray-400">Connecting to Google Drive…</p>
      </div>
    </div>
  )
}
