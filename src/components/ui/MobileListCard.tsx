import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface MobileListCardProps {
  title: string
  subtitle?: string
  meta?: string
  badge?: React.ReactNode
  left?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function MobileListCard({ title, subtitle, meta, badge, left, onClick, className }: MobileListCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3',
        onClick && 'cursor-pointer active:bg-gray-50',
        className
      )}
    >
      {left && <div className="flex-shrink-0">{left}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        {meta && <p className="text-xs text-gray-400 mt-0.5">{meta}</p>}
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
    </div>
  )
}
