'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { navItems } from './navConfig'
import { useAuthStore } from '@/store/auth'
import { Avatar } from '@/components/ui/Avatar'
import { LogOut, GraduationCap } from 'lucide-react'
import type { Role } from '@/types'

export function Sidebar() {
  const pathname = usePathname()
  const { user, clearAuth } = useAuthStore()
  const role = user?.role as Role

  const visible = navItems.filter((item) => item.roles.includes(role))

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-maroon-700 rounded-xl flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">VTC Management System</p>
          <p className="text-xs text-gray-400">Management System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visible.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-maroon-700 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2">
            <Avatar name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={clearAuth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
