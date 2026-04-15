export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(percent, 100)
  const color =
    percent >= 100 ? 'bg-red-500' : percent >= 75 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
