'use client'
import { useEffect, useState } from 'react'
import { StatWidget } from '@/components/ui/StatWidget'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAuthStore } from '@/store/auth'
import { authFetch } from '@/lib/client-api'
import {
  Users,
  GraduationCap,
  CreditCard,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface DashboardStats {
  totalStudents: number
  activeStudents: number
  todayCollection: number
  monthlyRevenue: number
  pendingFees: number
  todayClasses: number
  teacherSessionsCompleted: number
  recentPayments: { studentName: string; grade: string; month: number; year: number; amount: number; paidAt: string }[]
  pendingStudents: { studentName: string; grade: string; month: number; year: number; balance: number }[]
  salaryAlerts: { teacher: string; subject: string; sessions: number; payable: number }[]
}

export function AdminDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { data } = await authFetch<DashboardStats>('/api/dashboard/stats')
        if (data) setStats(data)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) return <LoadingState message="Loading dashboard..." />
  if (!stats) return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Good morning, {user?.name?.split(' ')[0] || 'Admin'} 👋</h1>
        <p className="text-sm text-gray-500">Here&apos;s what&apos;s happening today</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatWidget label="Total Students" value={stats.totalStudents} icon={GraduationCap} color="maroon" />
        <StatWidget label="Active Students" value={stats.activeStudents} icon={Users} color="blue" />
        <StatWidget label="Today's Collection" value={formatCurrency(stats.todayCollection)} icon={CreditCard} color="green" />
        <StatWidget label="Pending Fees" value={stats.pendingFees} icon={AlertCircle} color="orange" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatWidget label="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} icon={TrendingUp} color="purple" />
        <StatWidget label="Today's Classes" value={stats.todayClasses} icon={ClipboardList} color="blue" />
        <StatWidget label="Sessions Done" value={stats.teacherSessionsCompleted} icon={CheckCircle} color="green" />
        <StatWidget label="Salary Alerts" value={stats.salaryAlerts.length} icon={Clock} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {stats.recentPayments.length === 0 ? (
              <p className="text-sm text-gray-400">No recent payments.</p>
            ) : (
              stats.recentPayments.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{p.studentName}</p>
                    <p className="text-xs text-gray-400">{p.grade} · {formatDate(p.paidAt)}</p>
                  </div>
                  <span className="font-semibold text-green-600">{formatCurrency(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Fees</CardTitle>
            <Badge variant="warning">{stats.pendingStudents.length} shown</Badge>
          </CardHeader>
          <div className="space-y-2">
            {stats.pendingStudents.length === 0 ? (
              <p className="text-sm text-gray-400">No pending fees.</p>
            ) : (
              stats.pendingStudents.map((s, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{s.studentName}</p>
                    <p className="text-xs text-gray-400">{s.grade}</p>
                  </div>
                  <span className="font-semibold text-red-500">{formatCurrency(s.balance)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {stats.salaryAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Teacher Salary Alerts</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {stats.salaryAlerts.map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{s.teacher}</p>
                  <p className="text-xs text-gray-400">{s.subject} · {s.sessions} sessions</p>
                </div>
                <span className="font-semibold text-maroon-700">{formatCurrency(s.payable)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
