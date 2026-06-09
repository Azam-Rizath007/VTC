import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <Loader2 className="w-8 h-8 text-maroon-700 animate-spin" />
      <p className="text-sm text-gray-500 mt-3">{message}</p>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-xl" />
        <div className="flex-1">
          <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-2 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}
