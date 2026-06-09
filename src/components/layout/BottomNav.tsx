'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { navItems } from './navConfig'
import { useAuthStore } from '@/store/auth'
import type { Role } from '@/types'

export function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const role = user?.role as Role

  const visible = navItems.filter((item) => item.roles.includes(role) && item.bottomNav)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-1">
        {visible.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-0',
                active ? 'text-maroon-700' : 'text-gray-400'
              )}
            >
              <item.icon className={cn('w-5 h-5', active && 'text-maroon-700')} />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
