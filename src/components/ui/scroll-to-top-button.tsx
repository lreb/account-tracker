import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp } from 'lucide-react'

interface ScrollToTopButtonProps {
  /** Scroll distance (px) at which the button becomes visible. Default: 300 */
  threshold?: number
  /** Optional scroll container ref. When provided, tracks that element instead of #main-scroll. */
  scrollRef?: React.RefObject<HTMLElement | null>
}

export function ScrollToTopButton({ threshold = 300, scrollRef }: ScrollToTopButtonProps) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const containerRef = useRef<Element | null>(null)

  useEffect(() => {
    const container: Element | null =
      scrollRef?.current ?? document.getElementById('main-scroll') ?? document.querySelector('main')
    if (!container) return
    containerRef.current = container
    const onScroll = () => setShow(container.scrollTop > threshold)
    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [threshold, scrollRef])

  const handleClick = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!show) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t('common.scrollToTop')}
      title={t('common.scrollToTop')}
      className="fixed bottom-24 right-4 z-50 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg transition-opacity hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <ArrowUp size={14} />
      <span>{t('common.scrollToTop')}</span>
    </button>
  )
}
