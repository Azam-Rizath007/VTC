import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'maroon'
}

const variants = {
  success: 'bg-green-100 text-green-700',
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-orange-100 text-orange-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
  maroon: 'bg-maroon-100 text-maroon-700',
}

export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  )
}
