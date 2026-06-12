'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { AdminDashboard } from './AdminDashboard'
import { TeacherDashboard } from './TeacherDashboard'
import { LoadingState } from '@/components/ui/LoadingState'

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !user) {
      router.replace('/login')
    }
  }, [mounted, user, router])

  if (!mounted) {
    return <LoadingState message="Loading dashboard..." />
  }

  if (!user) {
    return <LoadingState message="Checking login..." />
  }

  if (user.role === 'TEACHER') {
    return <TeacherDashboard />
  }

  return <AdminDashboard />
}