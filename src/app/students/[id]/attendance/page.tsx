'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectSummary {
  subjectId: string
  subjectName: string
  present: number
  absent: number
  total: number
  percentage: number | null
  sessions: { date: string; sessionNumber: number; status: string }[]
}

interface AttendanceSummary {
  student: { id: string; name: string; grade: string; parentName?: string | null; parentContact?: string | null }
  period: 'monthly' | 'quarterly' | 'yearly'
  year: number
  month?: number
  quarter?: number
  dateFrom: string
  dateTo: string
  subjects: SubjectSummary[]
  totalPresent: number
  totalSessions: number
  overallPercentage: number | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Jan – Apr)',
  2: 'Q2 (May – Aug)',
  3: 'Q3 (Sep – Dec)',
}

function scoreColor(pct: number | null) {
  if (pct === null) return 'text-gray-400'
  if (pct >= 75) return 'text-green-600'
  if (pct >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function scoreBadge(pct: number | null) {
  if (pct === null) return <Badge variant="neutral">N/A</Badge>
  if (pct >= 75) return <Badge variant="success">{pct}%</Badge>
  if (pct >= 50) return <Badge variant="warning">{pct}%</Badge>
  return <Badge variant="danger">{pct}%</Badge>
}

function progressBar(pct: number | null) {
  const width = pct ?? 0
  const color = pct === null ? 'bg-gray-200' : pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div className={cn('h-2 rounded-full transition-all', color)} style={{ width: `${width}%` }} />
    </div>
  )
}

function periodLabel(summary: AttendanceSummary) {
  if (summary.period === 'monthly') return `${MONTHS[(summary.month ?? 1) - 1]} ${summary.year}`
  if (summary.period === 'quarterly') return `${QUARTER_LABELS[summary.quarter ?? 1]} ${summary.year}`
  return `Year ${summary.year}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentAttendancePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const now = new Date()

  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [month,  setMonth]  = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 4))
  const [year,   setYear]   = useState(now.getFullYear())

  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ period, year: String(year) })
    if (period === 'monthly')   params.set('month',   String(month))
    if (period === 'quarterly') params.set('quarter', String(quarter))

    const { data } = await authFetch<AttendanceSummary>(
      `/api/students/${id}/attendance?${params}`
    )
    if (data) setSummary(data)
    setLoading(false)
  }, [id, period, month, quarter, year])

  useEffect(() => { load() }, [load])

  const handlePrint = () => window.print()

  const yearOptions = [-2, -1, 0].map((o) => {
    const y = now.getFullYear() + o
    return { value: String(y), label: String(y) }
  })

  if (loading && !summary) return <LoadingState message="Loading attendance..." />

  return (
    <>
      {/* Print styles injected inline so they work without a separate CSS file */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #attendance-print, #attendance-print * { visibility: visible; }
          #attendance-print { position: absolute; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-4 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Attendance Summary</h1>
              {summary && <p className="text-sm text-gray-500">{summary.student.name} · {summary.student.grade}</p>}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>

        {/* Period controls */}
        <Card className="no-print">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Period"
                options={[
                  { value: 'monthly',   label: 'Monthly' },
                  { value: 'quarterly', label: 'Quarterly' },
                  { value: 'yearly',    label: 'Yearly' },
                ]}
                value={period}
                onChange={(e) => setPeriod(e.target.value as typeof period)}
              />
              <Select
                label="Year"
                options={yearOptions}
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>

            {period === 'monthly' && (
              <Select
                label="Month"
                options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                value={String(month)}
                onChange={(e) => setMonth(Number(e.target.value))}
              />
            )}

            {period === 'quarterly' && (
              <Select
                label="Quarter"
                options={[1, 2, 3].map((q) => ({ value: String(q), label: QUARTER_LABELS[q] }))}
                value={String(quarter)}
                onChange={(e) => setQuarter(Number(e.target.value))}
              />
            )}
          </div>
        </Card>

        {/* ── Printable content ────────────────────────────────────────────── */}
        <div id="attendance-print" ref={printRef}>

          {/* Print header (hidden on screen via CSS) */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <h2 className="text-xl font-bold">Attendance Report</h2>
            <p className="text-sm text-gray-600">{summary?.student.name} · {summary?.student.grade}</p>
            {summary?.student.parentName && (
              <p className="text-sm text-gray-500">Parent: {summary.student.parentName}
                {summary.student.parentContact && ` · ${summary.student.parentContact}`}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">Period: {summary ? periodLabel(summary) : ''}</p>
          </div>

          {/* Overall score */}
          {summary && (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Overall Attendance</p>
                  <p className="text-sm text-gray-500">{periodLabel(summary)}</p>
                </div>
                <div className="text-right">
                  <p className={cn('text-3xl font-bold', scoreColor(summary.overallPercentage))}>
                    {summary.overallPercentage !== null ? `${summary.overallPercentage}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {summary.totalPresent} / {summary.totalSessions} sessions
                  </p>
                </div>
              </div>
              {progressBar(summary.overallPercentage)}

              {/* Grade label */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Status:</span>
                {summary.overallPercentage === null ? (
                  <Badge variant="neutral">No records</Badge>
                ) : summary.overallPercentage >= 75 ? (
                  <Badge variant="success">Good Standing</Badge>
                ) : summary.overallPercentage >= 50 ? (
                  <Badge variant="warning">Needs Improvement</Badge>
                ) : (
                  <Badge variant="danger">At Risk</Badge>
                )}
              </div>
            </Card>
          )}

          {/* Per-subject breakdown */}
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle>By Subject</CardTitle>
              </CardHeader>
              {summary.subjects.length === 0 ? (
                <p className="text-sm text-gray-400">No attendance records in this period.</p>
              ) : (
                <div className="space-y-3">
                  {summary.subjects.map((s) => (
                    <div key={s.subjectId} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Subject row — clickable to expand sessions */}
                      <button
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors no-print"
                        onClick={() => setExpandedSubject(expandedSubject === s.subjectId ? null : s.subjectId)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{s.subjectName}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span className="text-green-600">✓ {s.present} present</span>
                            <span className="text-red-500">✗ {s.absent} absent</span>
                            <span>{s.total} total</span>
                          </div>
                          {progressBar(s.percentage)}
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          {scoreBadge(s.percentage)}
                        </div>
                      </button>

                      {/* Print-only row (no expand button) */}
                      <div className="hidden print:flex items-center justify-between p-3">
                        <div>
                          <p className="text-sm font-semibold">{s.subjectName}</p>
                          <p className="text-xs text-gray-500">
                            {s.present} present · {s.absent} absent · {s.total} total
                          </p>
                        </div>
                        <span className="text-sm font-bold">{s.percentage !== null ? `${s.percentage}%` : '—'}</span>
                      </div>

                      {/* Expanded session list */}
                      {expandedSubject === s.subjectId && s.sessions.length > 0 && (
                        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 no-print">
                          <p className="text-xs font-medium text-gray-500 mb-2">Session Details</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {s.sessions.map((session, i) => (
                              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                                <span className="text-gray-600">
                                  {new Date(session.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
                                  {' · '}Session {session.sessionNumber}
                                </span>
                                <Badge variant={session.status === 'PRESENT' ? 'success' : 'danger'}>
                                  {session.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Parent note — shown in print */}
          {summary && (
            <div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-500">
              <p>This report was generated for {summary.student.name}'s attendance during {periodLabel(summary)}.</p>
              <p className="mt-1">For queries, please contact the institute administration.</p>
            </div>
          )}

        </div>
        {/* end printable */}
      </div>
    </>
  )
}
