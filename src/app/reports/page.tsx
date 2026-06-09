'use client'
import { useCallback, useEffect, useState } from 'react'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'
import { formatCurrency } from '@/lib/utils'
import { BarChart3, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function ReportsPage() {
  const now = new Date()
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [report, setReport] = useState<{
    students: number
    activeStudents: number
    payments: { student: { name: string }; subject: { name: string }; amountPaid: number; status: string }[]
    attendance: { student: { name: string }; subject: { name: string }; status: string }[]
    salaries: { teacher: { name: string }; subject: { name: string }; totalPayable: number; completedSessions: number }[]
    totalCollection: number
    pendingCount: number
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [statsRes, paymentsRes, attendanceRes, salariesRes, studentsRes] = await Promise.all([
      authFetch<{ totalStudents: number; activeStudents: number; monthlyRevenue: number; pendingFees: number }>('/api/dashboard/stats'),
      authFetch<{ payments: typeof report extends null ? never : NonNullable<typeof report>['payments'] }>(`/api/fees?month=${month}&year=${year}`),
      authFetch<{ attendance: typeof report extends null ? never : NonNullable<typeof report>['attendance'] }>(`/api/attendance?month=${month}&year=${year}`),
      authFetch<{ salaries: typeof report extends null ? never : NonNullable<typeof report>['salaries'] }>(`/api/teachers/salary?month=${month}&year=${year}`),
      authFetch<{ students: unknown[] }>('/api/students'),
    ])

    setReport({
      students: statsRes.data?.totalStudents ?? 0,
      activeStudents: statsRes.data?.activeStudents ?? 0,
      totalCollection: statsRes.data?.monthlyRevenue ?? 0,
      pendingCount: statsRes.data?.pendingFees ?? 0,
      payments: paymentsRes.data?.payments ?? [],
      attendance: attendanceRes.data?.attendance ?? [],
      salaries: salariesRes.data?.salaries ?? [],
    })
    setLoading(false)
  }, [month, year])

  useEffect(() => {
    load()
  }, [load])

  const exportCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPayments = () => {
    if (!report) return
    exportCsv(`fee-report-${month}-${year}.csv`, [
      ['Student', 'Subject', 'Amount Paid', 'Status'],
      ...report.payments.map((p) => [p.student.name, p.subject.name, String(p.amountPaid), p.status]),
    ])
  }

  if (loading) return <LoadingState message="Loading reports..." />

  const presentCount = report?.attendance.filter((a) => a.status === 'PRESENT').length ?? 0
  const absentCount = report?.attendance.filter((a) => a.status === 'ABSENT').length ?? 0

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Reports</h1>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Month"
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Select
          label="Year"
          options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card padding="sm">
          <p className="text-xs text-gray-400">Total Students</p>
          <p className="text-xl font-bold">{report?.students}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-400">Collection</p>
          <p className="text-xl font-bold">{formatCurrency(report?.totalCollection ?? 0)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-400">Pending Fees</p>
          <p className="text-xl font-bold">{report?.pendingCount}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-400">Attendance</p>
          <p className="text-xl font-bold">{presentCount}P / {absentCount}A</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee Collection Report</CardTitle>
          <Button size="sm" variant="outline" onClick={exportPayments}>
            <Download className="w-4 h-4" />
            CSV
          </Button>
        </CardHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {!report?.payments.length ? (
            <p className="text-sm text-gray-400">No payments this month.</p>
          ) : (
            report.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{p.student.name}</p>
                  <p className="text-xs text-gray-400">{p.subject.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(p.amountPaid)}</p>
                  <Badge variant={p.status === 'PAID' ? 'success' : 'warning'}>{p.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teacher Salary Report</CardTitle>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </CardHeader>
        <div className="space-y-2">
          {!report?.salaries.length ? (
            <p className="text-sm text-gray-400">No salary records.</p>
          ) : (
            report.salaries.map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{s.teacher.name}</p>
                  <p className="text-xs text-gray-400">{s.subject.name} · {s.completedSessions} sessions</p>
                </div>
                <span className="font-semibold">{formatCurrency(s.totalPayable)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
