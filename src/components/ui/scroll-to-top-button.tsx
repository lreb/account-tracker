import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp } from 'lucide-react'

interface ScrollToTopButtonProps {
  /** Scroll distance (px) at which the button becomes visible. Default: 500 */
  threshold?: number
  /** Optional scroll container ref. When provided, tracks container.scrollTop instead of window.scrollY. */
  scrollRef?: { current: HTMLElement | null }
}

export function ScrollToTopButton({ threshold = 500, scrollRef }: ScrollToTopButtonProps) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    // When no explicit scrollRef is provided, fall back to the Shell <main> element
    // (which has overflow-y-auto), not window — window.scrollY is always 0 in this layout.
    const container = scrollRef?.current ?? document.querySelector('main')
    if (!container) return
    const onScroll = () => setShow(container.scrollTop > threshold)
    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [threshold, scrollRef])

  const handleClick = () => {
    const container = scrollRef?.current ?? document.querySelector('main')
    container?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('common.scrollToTop')}
      title={t('common.scrollToTop')}
      className={`fixed bottom-24 right-4 z-30 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg transition-all duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp size={14} />
      <span>{t('common.scrollToTop')}</span>
    </button>
  )
}
