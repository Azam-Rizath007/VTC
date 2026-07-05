'use client'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

interface Salary {
  id: string
  teacherId: string
  subjectId: string
  gradeId: string
  completedSessions: number
  requiredSessions: number
  rate: number
  totalPayable: number
  status: string
  teacher: { name: string }
  subject: { name: string }
  grade: { name: string }
}

interface Session {
  id: string
  date: string
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // expanded row → sessions
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await authFetch<{ salaries: Salary[] }>(
      `/api/teachers/salary?month=${month}&year=${year}`
    )
    setSalaries(data?.salaries ?? [])
    setExpanded(null)
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (s: Salary) => {
    if (expanded === s.id) { setExpanded(null); return }
    setExpanded(s.id)
    setSessionsLoading(true)
    setSessions([])
    const { data } = await authFetch<{ sessions: Session[] }>(
      `/api/teachers/sessions?teacherId=${s.teacherId}&subjectId=${s.subjectId}&gradeId=${s.gradeId}&month=${month}&year=${year}`
    )
    setSessions(data?.sessions ?? [])
    setSessionsLoading(false)
  }

  const markPaid = async (id: string) => {
    setSaving(id)
    await authFetch('/api/teachers/salary', { method: 'PATCH', body: JSON.stringify({ id }) })
    setSaving(null)
    load()
  }

  if (loading) return <LoadingState message="Loading reports..." />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Reports</h1>

      {/* Month / Year picker */}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Month"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Input
          label="Year"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      {/* Salary Report */}
      <Card>
        <CardHeader>
          <CardTitle>Salary Report — {MONTHS[month - 1]} {year}</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {salaries.length === 0 ? (
            <p className="text-sm text-gray-400">No salary records for this month.</p>
          ) : (
            salaries.map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-100 overflow-hidden">
                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                  onClick={() => toggleExpand(s)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(s) } }}
                >
                  <div className="flex items-center gap-2">
                    {expanded === s.id
                      ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.teacher.name}</p>
                      <p className="text-xs text-gray-400 flex flex-wrap items-center gap-1">
                        {s.subject.name} · {s.grade.name} · {s.completedSessions}/{s.requiredSessions} sessions
                        {s.completedSessions < s.requiredSessions && (
                          <Badge variant="warning">Not completed</Badge>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">Rate: {formatCurrency(s.rate)}/session</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-semibold text-indigo-700">{formatCurrency(s.totalPayable)}</p>
                    {s.status === 'PAID' ? (
                      <Badge variant="success">Paid</Badge>
                    ) : user?.role === 'SUPER_ADMIN' || s.completedSessions >= s.requiredSessions ? (
                      <Button
                        size="sm"
                        className="px-2 py-1 text-xs rounded-md"
                        loading={saving === s.id}
                        onClick={(e) => { e.stopPropagation(); markPaid(s.id) }}
                      >
                        Mark Paid
                      </Button>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </div>
                </div>

                {/* Expanded sessions */}
                {expanded === s.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    {sessionsLoading ? (
                      <p className="text-xs text-gray-400">Loading sessions...</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-xs text-gray-400">No sessions recorded for this month.</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 mb-2">Sessions ({sessions.length})</p>
                        {sessions.map((sess, i) => (
                          <div key={sess.id} className="flex items-center gap-3 text-xs text-gray-600">
                            <span className="w-5 text-gray-400 font-medium">#{i + 1}</span>
                            <span>{formatDateTime(sess.date)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
