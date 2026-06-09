'use client'
import { useAuthStore } from '@/store/auth'
import { Avatar } from '@/components/ui/Avatar'
import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navItems } from './navConfig'
import type { Role } from '@/types'

export function TopBar() {
  const { user, clearAuth } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const role = user?.role as Role
  const visible = navItems.filter((item) => item.roles.includes(role))

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMenuOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <p className="text-sm font-bold text-gray-900">VTC Management System</p>
        {user && <Avatar name={user.name} size="sm" />}
      </header>

      {/* Drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="relative bg-white w-72 h-full flex flex-col shadow-xl">
            <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
              <div className="w-9 h-9 bg-maroon-700 rounded-xl flex items-center justify-center">
                <span className="text-white text-sm font-bold">S</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">VTC Management System</p>
                <p className="text-xs text-gray-400">Management System</p>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {visible.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      active ? 'bg-maroon-700 text-white' : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            {user && (
              <div className="px-3 py-4 border-t border-gray-100">
                <div className="flex items-center gap-3 px-2">
                  <Avatar name={user.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.role.replace('_', ' ')}</p>
                  </div>
                  <button onClick={clearAuth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
