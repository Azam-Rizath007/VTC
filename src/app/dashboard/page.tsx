'use client'

import { useAuthStore } from '@/store/auth'
import { AdminDashboard } from './AdminDashboard'
import { TeacherDashboard } from './TeacherDashboard'

export default function DashboardPage() {
  const { user } = useAuthStore()

  // AppShell handles auth redirect; user is guaranteed here
  if (!user) return null

  if (user.role === 'TEACHER') return <TeacherDashboard />
  return <AdminDashboard />
}