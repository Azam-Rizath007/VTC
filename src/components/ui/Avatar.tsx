import { cn, getInitials } from '@/lib/utils'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-maroon-700 text-white font-semibold flex items-center justify-center flex-shrink-0',
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
