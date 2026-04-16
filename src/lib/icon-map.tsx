import { MoreHorizontal } from 'lucide-react'

import { ICON_MAP } from '@/lib/icon-map.constants'

/** Render a category icon by its stored name string. Falls back to MoreHorizontal. */
export function CategoryIcon({
  name,
  size = 18,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const Icon = ICON_MAP[name] ?? MoreHorizontal
  return <Icon size={size} className={className} />
}
