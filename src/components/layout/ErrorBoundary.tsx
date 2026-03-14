import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

// ─── Fallback UI ──────────────────────────────────────────────────────────────

interface FallbackProps {
  onReset: () => void
}

function ErrorFallback({ onReset }: FallbackProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  function handleGoHome() {
    onReset()
    navigate('/')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
      <div className="text-5xl">⚠️</div>
      <h2 className="text-lg font-semibold text-gray-800">{t('common.error')}</h2>
      <p className="text-sm text-gray-500 max-w-xs">{t('common.errorBoundaryDescription')}</p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={onReset}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          {t('common.tryAgain')}
        </button>
        <button
          onClick={handleGoHome}
          className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          {t('common.goToDashboard')}
        </button>
      </div>
    </div>
  )
}

// ─── Error Boundary class (React requires a class for componentDidCatch) ─────

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.reset} />
    }
    return this.props.children
  }
}
