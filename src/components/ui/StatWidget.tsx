import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatWidgetProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  color?: 'maroon' | 'blue' | 'green' | 'orange' | 'purple'
  className?: string
}

const colorMap = {
  maroon: { bg: 'bg-maroon-50', icon: 'text-maroon-700', badge: 'bg-maroon-100 text-maroon-700' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', badge: 'bg-green-100 text-green-700' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
}

export function StatWidget({ label, value, icon: Icon, trend, trendUp, color = 'maroon', className }: StatWidgetProps) {
  const c = colorMap[color]
  return (
    <div className={cn('bg-white rounded-2xl p-4 shadow-sm border border-gray-100', className)}>
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-xl', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
        {trend && (
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', c.badge)}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
