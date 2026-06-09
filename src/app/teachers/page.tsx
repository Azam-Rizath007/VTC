'use client'
import { useCallback, useEffect, useState } from 'react'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, Trash2, UserPlus, UserCheck } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string
  rate: number
  subject: { name: string }
  grade: { name: string }
}

interface Teacher {
  id: string
  name: string
  email: string
  isActive: boolean
  assignments: Assignment[]
}

interface Salary {
  id: string
  completedSessions: number
  requiredSessions: number
  rate: number
  totalPayable: number
  status: string
  teacher: { name: string }
  subject: { name: string }
  grade: { name: string }
}

interface Grade {
  id: string
  name: string
  subjects: { id: string; name: string }[]
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeachersPage() {
  const now = new Date()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // ── Create / Edit teacher modal ──
  const [showTeacherModal, setShowTeacherModal] = useState(false)
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null)
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '', isActive: true })
  const [teacherSaving, setTeacherSaving] = useState(false)
  const [teacherError, setTeacherError] = useState('')

  // ── Assign / Edit assignment modal ──
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Teacher | null>(null)
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null)
  const [assignForm, setAssignForm] = useState({ subjectId: '', gradeId: '', rate: '' })
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState('')

  // ─── Load data ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [teachersRes, salariesRes, gradesRes] = await Promise.all([
      authFetch<{ teachers: Teacher[] }>('/api/teachers/assignments'),
      authFetch<{ salaries: Salary[] }>(`/api/teachers/salary?month=${month}&year=${year}`),
      authFetch<{ grades: Grade[] }>('/api/grades'),
    ])
    if (teachersRes.data?.teachers) setTeachers(teachersRes.data.teachers)
    if (salariesRes.data?.salaries) setSalaries(salariesRes.data.salaries)
    if (gradesRes.data?.grades) setGrades(gradesRes.data.grades)
    setLoading(false)
  }, [month, year])

  useEffect(() => { load() }, [load])

  // ─── Teacher create / edit ──────────────────────────────────────────────────

  const openCreateTeacher = () => {
    setEditTeacher(null)
    setTeacherForm({ name: '', email: '', password: '', isActive: true })
    setTeacherError('')
    setShowTeacherModal(true)
  }

  const openEditTeacher = (t: Teacher) => {
    setEditTeacher(t)
    setTeacherForm({ name: t.name, email: t.email, password: '', isActive: t.isActive })
    setTeacherError('')
    setShowTeacherModal(true)
  }

  const handleSaveTeacher = async () => {
    setTeacherError('')
    if (!teacherForm.name.trim() || !teacherForm.email.trim()) {
      setTeacherError('Name and email are required')
      return
    }
    if (!editTeacher && !teacherForm.password) {
      setTeacherError('Password is required for new teachers')
      return
    }
    setTeacherSaving(true)

    if (editTeacher) {
      // PATCH existing
      const payload: Record<string, unknown> = {
        id: editTeacher.id,
        name: teacherForm.name,
        email: teacherForm.email,
        isActive: teacherForm.isActive,
      }
      if (teacherForm.password) payload.password = teacherForm.password

      const { error } = await authFetch('/api/users', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (error) { setTeacherError(error); setTeacherSaving(false); return }
    } else {
      // POST new
      const { error } = await authFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...teacherForm, role: 'TEACHER' }),
      })
      if (error) { setTeacherError(error); setTeacherSaving(false); return }
    }

    setTeacherSaving(false)
    setShowTeacherModal(false)
    load()
  }

  // ─── Assignment create / edit ───────────────────────────────────────────────

  const openAssign = (teacher: Teacher) => {
    setAssignTarget(teacher)
    setEditAssignment(null)
    setAssignForm({ subjectId: '', gradeId: '', rate: '' })
    setAssignError('')
    setShowAssignModal(true)
  }

  const openEditAssignment = (teacher: Teacher, assignment: Assignment) => {
    setAssignTarget(teacher)
    setEditAssignment(assignment)
    setAssignError('')
    // Pre-fill — we need gradeId/subjectId from the assignment text;
    // since the API includes subject/grade names but not IDs, we find them from grades list
    const gradeMatch = grades.find((g) => g.name === assignment.grade.name)
    const subjectMatch = gradeMatch?.subjects.find((s) => s.name === assignment.subject.name)
    setAssignForm({
      gradeId: gradeMatch?.id ?? '',
      subjectId: subjectMatch?.id ?? '',
      rate: String(assignment.rate),
    })
    setShowAssignModal(true)
  }

  const handleSaveAssignment = async () => {
    setAssignError('')
    if (!editAssignment && (!assignForm.subjectId || !assignForm.gradeId)) {
      setAssignError('Select a grade and subject')
      return
    }
    const rate = parseInt(assignForm.rate) || 0

    setAssignSaving(true)
    if (editAssignment) {
      // Update rate only
      const { error } = await authFetch('/api/teachers/assignments', {
        method: 'PATCH',
        body: JSON.stringify({ id: editAssignment.id, rate }),
      })
      if (error) { setAssignError(error); setAssignSaving(false); return }
    } else {
      const { error } = await authFetch('/api/teachers/assignments', {
        method: 'POST',
        body: JSON.stringify({
          userId: assignTarget!.id,
          subjectId: assignForm.subjectId,
          gradeId: assignForm.gradeId,
          rate,
        }),
      })
      if (error) { setAssignError(error); setAssignSaving(false); return }
    }
    setAssignSaving(false)
    setShowAssignModal(false)
    load()
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    await authFetch(`/api/teachers/assignments?id=${assignmentId}`, { method: 'DELETE' })
    load()
  }

  const markPaid = async (id: string) => {
    await authFetch('/api/teachers/salary', { method: 'PATCH', body: JSON.stringify({ id }) })
    load()
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const subjectOptions =
    grades.find((g) => g.id === assignForm.gradeId)?.subjects.map((s) => ({ value: s.id, label: s.name })) ?? []

  if (loading) return <LoadingState message="Loading teachers..." />

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Teachers</h1>
        <Button size="sm" onClick={openCreateTeacher}>
          <UserPlus className="w-4 h-4" />
          Add Teacher
        </Button>
      </div>

      {/* Teacher list */}
      <Card>
        <CardHeader><CardTitle>Teacher Assignments</CardTitle></CardHeader>
        <div className="space-y-3">
          {teachers.length === 0 && (
            <p className="text-sm text-gray-400">No teachers yet. Add one above.</p>
          )}
          {teachers.map((teacher) => (
            <div key={teacher.id} className="p-3 rounded-xl bg-gray-50 space-y-2">
              {/* Teacher header row */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{teacher.name}</p>
                  <p className="text-xs text-gray-400">{teacher.email}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!teacher.isActive && <Badge variant="danger">Inactive</Badge>}
                  <button
                    onClick={() => openEditTeacher(teacher)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit teacher"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openAssign(teacher)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                    title="Add assignment"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Assignments */}
              {teacher.assignments.length === 0 ? (
                <p className="text-xs text-gray-400 pl-0.5">No subjects assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {teacher.assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs"
                    >
                      <span className="font-medium text-gray-700">{a.grade.name} — {a.subject.name}</span>
                      {a.rate > 0 && (
                        <span className="text-gray-400">· {formatCurrency(a.rate)}</span>
                      )}
                      <button
                        onClick={() => openEditAssignment(teacher, a)}
                        className="ml-1 text-gray-400 hover:text-indigo-500"
                        title="Edit rate"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(a.id)}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove assignment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Salary month/year picker */}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Month"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
        <Input label="Year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      {/* Salary report */}
      <Card>
        <CardHeader><CardTitle>Salary Report — {MONTHS[month - 1]} {year}</CardTitle></CardHeader>
        <div className="space-y-3">
          {salaries.length === 0 ? (
            <p className="text-sm text-gray-400">No salary records for this month.</p>
          ) : (
            salaries.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm font-medium">{s.teacher.name}</p>
                  <p className="text-xs text-gray-400">
                    {s.subject.name} · {s.grade.name} · {s.completedSessions}/{s.requiredSessions} sessions
                  </p>
                  <p className="text-xs text-gray-500">Rate: {formatCurrency(s.rate)}/session</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-indigo-700">{formatCurrency(s.totalPayable)}</p>
                  {s.status === 'PAID' ? (
                    <Badge variant="success">Paid</Badge>
                  ) : s.completedSessions >= s.requiredSessions ? (
                    <Button size="sm" onClick={() => markPaid(s.id)}>Mark Paid</Button>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ─── Create / Edit Teacher Modal ──────────────────────────────────── */}
      <Modal
        open={showTeacherModal}
        onClose={() => setShowTeacherModal(false)}
        title={editTeacher ? 'Edit Teacher' : 'Add Teacher'}
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Ali Hassan"
            value={teacherForm.name}
            onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="teacher@school.com"
            value={teacherForm.email}
            onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
          />
          <Input
            label={editTeacher ? 'New Password (leave blank to keep)' : 'Password'}
            type="password"
            placeholder="••••••••"
            value={teacherForm.password}
            onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
          />
          {editTeacher && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setTeacherForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${teacherForm.isActive ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}
              >
                {teacherForm.isActive && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium text-gray-800">Active</span>
            </label>
          )}
          {teacherError && <p className="text-sm text-red-500">{teacherError}</p>}
          <Button fullWidth loading={teacherSaving} onClick={handleSaveTeacher}>
            {editTeacher ? <><Pencil className="w-4 h-4" /> Save Changes</> : <><UserPlus className="w-4 h-4" /> Create Teacher</>}
          </Button>
        </div>
      </Modal>

      {/* ─── Assign / Edit Assignment Modal ───────────────────────────────── */}
      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={editAssignment ? `Edit Assignment — ${assignTarget?.name}` : `Assign Subject — ${assignTarget?.name}`}
      >
        <div className="space-y-4">
          {editAssignment ? (
            /* Edit mode: only show current assignment info + rate field */
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
              <p className="font-medium">{editAssignment.grade.name} — {editAssignment.subject.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Grade and subject cannot be changed. Remove and re-add to change them.</p>
            </div>
          ) : (
            <>
              <Select
                label="Grade"
                placeholder="Select grade"
                options={grades.map((g) => ({ value: g.id, label: g.name }))}
                value={assignForm.gradeId}
                onChange={(e) => setAssignForm({ ...assignForm, gradeId: e.target.value, subjectId: '' })}
              />
              <Select
                label="Subject"
                placeholder={assignForm.gradeId ? 'Select subject' : 'Select grade first'}
                options={subjectOptions}
                value={assignForm.subjectId}
                onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}
              />
            </>
          )}
          <Input
            label="Rate per Session (Rs.)"
            type="number"
            placeholder="e.g. 500"
            value={assignForm.rate}
            onChange={(e) => setAssignForm({ ...assignForm, rate: e.target.value })}
          />
          {assignError && <p className="text-sm text-red-500">{assignError}</p>}
          <Button fullWidth loading={assignSaving} onClick={handleSaveAssignment}>
            {editAssignment ? <><Pencil className="w-4 h-4" /> Update Rate</> : <><UserCheck className="w-4 h-4" /> Assign Subject</>}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
