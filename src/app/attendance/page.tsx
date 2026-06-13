'use client'
import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Check, X, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'
import { cn } from '@/lib/utils'

interface Assignment {
  gradeId: string
  subjectId: string
  grade: { name: string }
  subject: { name: string; monthlySessionTarget: number }
}

interface Student {
  id: string
  name: string
}

interface ExistingRecord {
  studentId: string
  status: 'PRESENT' | 'ABSENT'
}

type ProgressData = { target: number; sessionsConducted: number; progress: string }

/** Sentinel value meaning "new session not yet saved" */
const NEW_SESSION = -1

export default function AttendancePage() {
  const { user } = useAuthStore()
  const isTeacher = user?.role === 'TEACHER'
  const today = new Date().toISOString().split('T')[0]

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ gradeId: '', subjectId: '', date: today })

  // Sessions state
  const [recordedSessions, setRecordedSessions] = useState<number[]>([])
  const [nextSession, setNextSession] = useState(1)
  const [effectiveCap, setEffectiveCap] = useState(0)
  const [selectedSession, setSelectedSession] = useState<number | null>(null)  // null = none, NEW_SESSION = new
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [monthlyProgress, setMonthlyProgress] = useState<ProgressData | null>(null)

  // Student list state
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<Record<string, 'PRESENT' | 'ABSENT'>>({})
  const [studentsLoading, setStudentsLoading] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [remarks, setRemarks] = useState('')
  const [grantingOverride, setGrantingOverride] = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const selectedAssignment = assignments.find(
    (a) => a.gradeId === form.gradeId && a.subjectId === form.subjectId
  )
  const sessionTarget = selectedAssignment?.subject.monthlySessionTarget ?? 0
  const sessionsThisMonth = monthlyProgress?.sessionsConducted ?? 0
  const atCap = isTeacher && effectiveCap > 0 && sessionsThisMonth >= effectiveCap

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadAssignments = useCallback(async () => {
    const { data } = await authFetch<{ assignments: Assignment[] }>('/api/attendance?action=assignments')
    if (data?.assignments) {
      setAssignments(data.assignments)
      if (data.assignments.length === 1) {
        setForm((f) => ({
          ...f,
          gradeId: data.assignments[0].gradeId,
          subjectId: data.assignments[0].subjectId,
        }))
      }
    }
    setLoading(false)
  }, [])

  const loadStudentsForSession = useCallback(async (
    subjectId: string, gradeId: string, date: string, sessionNumber: number
  ) => {
    setStudentsLoading(true)
    setSaved(false)

    if (sessionNumber === NEW_SESSION) {
      // New session — just load the student list with all PRESENT by default
      const params = new URLSearchParams({ action: 'students', gradeId, subjectId, date, sessionNumber: '0' })
      const { data } = await authFetch<{ students: Student[]; existing: ExistingRecord[]; progress: ProgressData }>(
        `/api/attendance?${params}`
      )
      if (data?.students) {
        setStudents(data.students)
        const initial: Record<string, 'PRESENT' | 'ABSENT'> = {}
        data.students.forEach((s) => { initial[s.id] = 'PRESENT' })
        setRecords(initial)
      }
    } else {
      const params = new URLSearchParams({
        action: 'students', gradeId, subjectId, date, sessionNumber: String(sessionNumber),
      })
      const { data } = await authFetch<{ students: Student[]; existing: ExistingRecord[]; progress: ProgressData }>(
        `/api/attendance?${params}`
      )
      if (data?.students) {
        setStudents(data.students)
        const initial: Record<string, 'PRESENT' | 'ABSENT'> = {}
        data.students.forEach((s) => {
          const ex = data.existing?.find((e) => e.studentId === s.id)
          initial[s.id] = ex?.status ?? 'PRESENT'
        })
        setRecords(initial)
      }
      if (data?.progress) setMonthlyProgress(data.progress)
    }
    setStudentsLoading(false)
  }, [])

  const loadRecordedSessions = useCallback(async (subjectId: string, gradeId: string, date: string) => {
    setSessionsLoading(true)
    setRecordedSessions([])
    setSelectedSession(null)
    setStudents([])
    setRecords({})
    setSaved(false)

    const params = new URLSearchParams({ action: 'nextsession', subjectId, gradeId, date })
    const { data } = await authFetch<{ nextSession: number; todaySessions: number[]; effectiveCap: number }>(
      `/api/attendance?${params}`
    )
    if (data) {
      setRecordedSessions(data.todaySessions)
      setNextSession(data.nextSession)
      setEffectiveCap(data.effectiveCap ?? 0)
      if (data.todaySessions.length === 1) setSelectedSession(data.todaySessions[0])
    }
    setSessionsLoading(false)
  }, [])

  // Load monthly progress separately (needed for cap check before any session is selected)
  const loadMonthlyProgress = useCallback(async (subjectId: string, date: string) => {
    const d = new Date(date)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    const params = new URLSearchParams({
      action: 'students',
      gradeId: form.gradeId,
      subjectId,
      date,
      sessionNumber: '0',
    })
    // Re-use the students endpoint just for progress; we only read progress from it
    const { data } = await authFetch<{ students: Student[]; progress: ProgressData }>(
      `/api/attendance?${params}`
    )
    if (data?.progress) setMonthlyProgress(data.progress)
  }, [form.gradeId])

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { loadAssignments() }, [loadAssignments])

  useEffect(() => {
    if (form.gradeId && form.subjectId) {
      loadRecordedSessions(form.subjectId, form.gradeId, form.date)
      if (isTeacher) loadMonthlyProgress(form.subjectId, form.date)
    }
  }, [form.gradeId, form.subjectId, form.date, loadRecordedSessions, loadMonthlyProgress, isTeacher])

  useEffect(() => {
    if (form.gradeId && form.subjectId && selectedSession !== null) {
      setRemarks('')
      loadStudentsForSession(form.subjectId, form.gradeId, form.date, selectedSession)
    }
  }, [selectedSession, form.gradeId, form.subjectId, form.date, loadStudentsForSession])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAssignmentChange = (value: string) => {
    const [gradeId, subjectId] = value.split('|')
    setForm((f) => ({ ...f, gradeId, subjectId }))
  }

  const toggleStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setRecords((r) => ({ ...r, [studentId]: status }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (selectedSession === null) return
    const sessionNumber = selectedSession === NEW_SESSION ? nextSession : selectedSession
    setSaving(true)
    setSaved(false)
    setSaveError('')
    const { error } = await authFetch('/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        gradeId: form.gradeId,
        subjectId: form.subjectId,
        date: form.date,
        sessionNumber,
        remarks: remarks || undefined,
        records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
      }),
    })
    setSaving(false)
    if (error) {
      setSaveError(error)
    } else {
      setSaved(true)
      setRemarks('')
      if (selectedSession === NEW_SESSION) {
        await loadRecordedSessions(form.subjectId, form.gradeId, form.date)
        if (isTeacher) loadMonthlyProgress(form.subjectId, form.date)
      }
    }
  }

  if (loading) return <LoadingState message="Loading attendance..." />

  const presentCount = Object.values(records).filter((s) => s === 'PRESENT').length
  const absentCount = Object.values(records).filter((s) => s === 'ABSENT').length
  const isNewSession = selectedSession === NEW_SESSION
  const displaySession = isNewSession ? nextSession : selectedSession

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-bold text-gray-900">Attendance</h1>

      <Card>
        <div className="space-y-4">

          {/* Class selector */}
          {isTeacher ? (
            <Select
              label="Class"
              placeholder="Select class"
              options={assignments.map((a) => ({
                value: `${a.gradeId}|${a.subjectId}`,
                label: `${a.grade.name} — ${a.subject.name}`,
              }))}
              value={`${form.gradeId}|${form.subjectId}`}
              onChange={(e) => handleAssignmentChange(e.target.value)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Grade"
                placeholder="Select grade"
                options={[...new Map(assignments.map((a) => [a.gradeId, { value: a.gradeId, label: a.grade.name }])).values()]}
                value={form.gradeId}
                onChange={(e) => setForm({ ...form, gradeId: e.target.value, subjectId: '' })}
              />
              <Select
                label="Subject"
                placeholder={form.gradeId ? 'Select subject' : 'Select grade first'}
                options={assignments.filter((a) => a.gradeId === form.gradeId).map((a) => ({ value: a.subjectId, label: a.subject.name }))}
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              />
            </div>
          )}

          {/* Date — teachers locked to current month only */}
          <Input
            label="Date"
            type="date"
            value={form.date}
            min={isTeacher ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] : undefined}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />

          {/* Monthly progress + cap warning (teacher only) */}
          {isTeacher && form.gradeId && form.subjectId && monthlyProgress && (
            <div className={cn(
              'flex items-center justify-between p-3 rounded-xl text-sm',
              atCap ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
            )}>
              <span className={atCap ? 'text-red-700 font-medium' : 'text-gray-600'}>
                Monthly sessions: {sessionsThisMonth} / {effectiveCap || sessionTarget}
                {effectiveCap > sessionTarget && ` (+${effectiveCap - sessionTarget} extra)`}
                {atCap && ' — session limit reached'}
              </span>
              <Badge variant={atCap ? 'danger' : monthlyProgress.progress === 'completed' ? 'success' : 'warning'}>
                {atCap ? 'Capped' : monthlyProgress.progress}
              </Badge>
            </div>
          )}

          {/* Admin/SuperAdmin: session cap info + Add Extra Session */}
          {!isTeacher && form.gradeId && form.subjectId && form.date && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 text-sm">
              <span className="text-gray-600">
                Session cap: {sessionTarget || effectiveCap}
                {effectiveCap > sessionTarget && (
                  <span className="ml-1.5 text-indigo-600 font-medium">+{effectiveCap - sessionTarget} extra granted</span>
                )}
              </span>
              <Button
                size="sm"
                variant="secondary"
                loading={grantingOverride}
                onClick={async () => {
                  setGrantingOverride(true)
                  const d = new Date(form.date)
                  await authFetch('/api/attendance/override', {
                    method: 'POST',
                    body: JSON.stringify({
                      subjectId: form.subjectId,
                      gradeId: form.gradeId,
                      month: d.getMonth() + 1,
                      year: d.getFullYear(),
                    }),
                  })
                  await loadRecordedSessions(form.subjectId, form.gradeId, form.date)
                  setGrantingOverride(false)
                }}
              >
                + Add Extra Session
              </Button>
            </div>
          )}

          {/* Sessions on selected date */}
          {form.gradeId && form.subjectId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sessions on this date
              </label>
              {sessionsLoading ? (
                <p className="text-sm text-gray-400">Loading sessions…</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {recordedSessions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSession(s)}
                      className={cn(
                        'px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                        selectedSession === s
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      Session {s}
                    </button>
                  ))}

                  {/* New session button — teachers only, blocked at cap */}
                  {isTeacher && (
                    atCap ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 border border-red-200 cursor-not-allowed">
                        Session limit reached ({sessionsThisMonth}/{effectiveCap || sessionTarget})
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedSession(NEW_SESSION)}
                        className={cn(
                          'flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                          selectedSession === NEW_SESSION
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-green-700 border-green-300 hover:bg-green-50'
                        )}
                      >
                        <Plus className="w-3 h-3" />
                        New Session {nextSession}
                      </button>
                    )
                  )}

                  {/* No sessions message for non-teachers */}
                  {!isTeacher && recordedSessions.length === 0 && (
                    <p className="text-sm text-gray-400">No sessions recorded for this date.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Student list */}
      {selectedSession !== null && (
        studentsLoading ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No students found for this class.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{students.length} students</span>
                <span className="text-green-600 font-medium">✓ {presentCount}</span>
                <span className="text-red-500 font-medium">✗ {absentCount}</span>
              </div>
              <span className="text-xs font-medium text-gray-500">
                {isNewSession ? `New — Session ${displaySession}` : `Session ${displaySession}`}
              </span>
            </div>

            <div className="space-y-2">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100"
                >
                  <p className="text-sm font-medium">{student.name}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleStatus(student.id, 'PRESENT')}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                        records[student.id] === 'PRESENT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Check className="w-3 h-3" /> Present
                    </button>
                    <button
                      onClick={() => toggleStatus(student.id, 'ABSENT')}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                        records[student.id] === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <X className="w-3 h-3" /> Absent
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Add a note…"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            <Button fullWidth size="lg" loading={saving} onClick={handleSave}>
              <ClipboardList className="w-4 h-4" />
              {isNewSession ? `Save Session ${displaySession}` : `Update Session ${displaySession}`}
            </Button>

            {saveError && (
              <p className="text-sm text-red-500 text-center">{saveError}</p>
            )}

            {saved && (
              <p className="text-sm text-green-600 text-center">
                {isNewSession ? 'Session saved successfully.' : 'Attendance updated successfully.'}
              </p>
            )}
          </>
        )
      )}
    </div>
  )
}
