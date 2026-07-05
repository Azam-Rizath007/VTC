'use client'
import { useCallback, useEffect, useState } from 'react'
import { StatWidget } from '@/components/ui/StatWidget'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAuthStore } from '@/store/auth'
import { authFetch } from '@/lib/client-api'
import { formatCurrency } from '@/lib/utils'
import { ClipboardList, CheckCircle, Clock, DollarSign, AlertCircle } from 'lucide-react'

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' },   { value: '4', label: 'April' },
  { value: '5', label: 'May' },     { value: '6', label: 'June' },
  { value: '7', label: 'July' },    { value: '8', label: 'August' },
  { value: '9', label: 'September' },{ value: '10', label: 'October' },
  { value: '11', label: 'November' },{ value: '12', label: 'December' },
]

interface SubjectStat {
  grade: string
  subject: string
  allocated: number
  completed: number
  pending: number
  rate: number
  revenue: number
  salaryStatus: string
}

interface TeacherStats {
  month: number
  year: number
  totalAllocated: number
  totalCompleted: number
  totalPending: number
  totalRevenue: number
  subjects: SubjectStat[]
}

export function TeacherDashboard() {
  const { user } = useAuthStore()
  const now = new Date()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [stats, setStats] = useState<TeacherStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await authFetch<TeacherStats>(
      `/api/dashboard/teacher?month=${month}&year=${year}`
    )
    if (data) setStats(data)
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  // Year options: current year and 2 years back
  const yearOptions = [0, 1, 2].map((offset) => {
    const y = now.getFullYear() - offset
    return { value: String(y), label: String(y) }
  })

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  // Unpaid salary balance for the selected month
  const pendingBalance = stats?.subjects
    .filter((s) => s.salaryStatus !== 'PAID')
    .reduce((sum, s) => sum + s.revenue, 0) ?? 0

  if (loading && !stats) return <LoadingState message="Loading dashboard..." />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Hello, {user?.name.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500">
            {MONTHS[month - 1]?.label} {year}
            {isCurrentMonth && <span className="ml-1 text-indigo-500">· Current month</span>}
          </p>
        </div>
      </div>

      {/* Month + Year picker */}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Month"
          options={MONTHS}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Select
          label="Year"
          options={yearOptions}
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatWidget
          label="Sessions Allocated"
          value={stats?.totalAllocated ?? 0}
          icon={ClipboardList}
          color="blue"
        />
        <StatWidget
          label="Completed"
          value={stats?.totalCompleted ?? 0}
          icon={CheckCircle}
          color="green"
        />
        <StatWidget
          label="Pending"
          value={stats?.totalPending ?? 0}
          icon={Clock}
          color="orange"
        />
        <StatWidget
          label="Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          icon={DollarSign}
          color="purple"
        />
        <StatWidget
          label="Pending Balance"
          value={formatCurrency(pendingBalance)}
          icon={AlertCircle}
          color="maroon"
          className="col-span-2"
        />
      </div>

      {/* Per-subject breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Breakdown</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {!stats?.subjects.length ? (
            <p className="text-sm text-gray-400">No subjects assigned.</p>
          ) : (
            stats.subjects.map((s, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-50 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.subject}</p>
                    <p className="text-xs text-gray-400">{s.grade}</p>
                  </div>
                  <Badge variant={s.salaryStatus === 'PAID' ? 'success' : 'warning'}>
                    {s.salaryStatus === 'PAID' ? 'Salary Paid' : 'Pending'}
                  </Badge>
                </div>

                {/* Session bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{s.completed} / {s.allocated} sessions</span>
                    <span className="text-orange-500">{s.pending} remaining</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                      style={{ width: s.allocated > 0 ? `${Math.min(100, (s.completed / s.allocated) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Rate: {formatCurrency(s.rate)}/session</span>
                  <span className="font-semibold text-indigo-700">{formatCurrency(s.revenue)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
