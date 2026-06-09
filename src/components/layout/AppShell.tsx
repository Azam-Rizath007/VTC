'use client'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, _hasHydrated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (_hasHydrated && !user) router.replace('/login')
  }, [user, _hasHydrated, router])

  if (!_hasHydrated || !user) return null

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6 px-4 py-4 lg:px-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
