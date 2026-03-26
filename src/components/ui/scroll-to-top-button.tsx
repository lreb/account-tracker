import { useState, useEffect, useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp } from 'lucide-react'

interface ScrollToTopButtonProps {
  /** Scroll distance (px) at which the button becomes visible. Default: 300 */
  threshold?: number
  /** Optional scroll container ref. When provided, tracks that element instead of #main-scroll. */
  scrollRef?: RefObject<HTMLElement | null>
}

export function ScrollToTopButton({ threshold = 300, scrollRef }: ScrollToTopButtonProps) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const containerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const container: HTMLElement | null =
      scrollRef?.current ?? document.getElementById('main-scroll') ?? document.querySelector<HTMLElement>('main')
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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 active:scale-95 transition-all"
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  )
}
