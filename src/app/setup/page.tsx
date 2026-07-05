'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/LoadingState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { authFetch } from '@/lib/client-api'
import { formatCurrency } from '@/lib/utils'

interface Subject {
  id: string
  name: string
  fee: number
  monthlySessionTarget: number
}

interface Grade {
  id: string
  name: string
  subjects: Subject[]
}

const SUBJECT_OPTIONS = [
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Science', label: 'Science' },
  { value: 'English', label: 'English' },
  { value: 'Tamil', label: 'Tamil' },
  { value: 'History', label: 'History' },
]

export default function SetupPage() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editSubject, setEditSubject] = useState<Subject | null>(null)
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null)
  const [gradeName, setGradeName] = useState('')
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    gradeId: '',
    fee: 2500,
    monthlySessionTarget: 12,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await authFetch<{ grades: Grade[] }>('/api/grades')
      if (data?.grades) setGrades(data.grades)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getSubjectOptionsForGrade = () => {
    const selectedGrade = grades.find((g) => g.id === subjectForm.gradeId)

    const assignedSubjects =
      selectedGrade?.subjects
        .filter((s) => s.id !== editSubject?.id)
        .map((s) => s.name.toLowerCase()) || []

    return SUBJECT_OPTIONS.map((option) => ({
      ...option,
      disabled: assignedSubjects.includes(option.value.toLowerCase()),
    }))
  }

  const handleAddGrade = async () => {
    if (!gradeName.trim()) {
      setError('Please enter a grade name.')
      return
    }

    setSaving(true)
    setError('')

    const { error: err } = await authFetch('/api/grades', {
      method: 'POST',
      body: JSON.stringify({ name: gradeName.trim() }),
    })

    setSaving(false)

    if (err) {
      setError(err)
      return
    }

    setGradeName('')
    setShowGradeModal(false)
    load()
  }

  const openSubjectModal = (gradeId: string, subject?: Subject) => {
  setError('')

  if (subject) {
    setEditSubject(subject)
    setSubjectForm({
      name: subject.name,
      gradeId,
      fee: subject.fee,
      monthlySessionTarget: subject.monthlySessionTarget,
    })
  } else {
    const grade = grades.find((g) => g.id === gradeId)

    const assignedSubjects =
      grade?.subjects.map((s) => s.name.toLowerCase()) || []

    const firstAvailableSubject = SUBJECT_OPTIONS.find(
      (option) => !assignedSubjects.includes(option.value.toLowerCase())
    )

    setEditSubject(null)
    setSubjectForm({
      name: firstAvailableSubject?.value || '',
      gradeId,
      fee: 2500,
      monthlySessionTarget: 12,
    })
  }

  setShowSubjectModal(true)
}

  const handleSaveSubject = async () => {
    if (!subjectForm.name.trim()) {
      setError('Please select a subject.')
      return
    }

    if (!subjectForm.gradeId) {
      setError('Please select a grade.')
      return
    }

    const selectedGrade = grades.find((g) => g.id === subjectForm.gradeId)

    const alreadyExists = selectedGrade?.subjects.some(
      (s) =>
        s.name.toLowerCase() === subjectForm.name.toLowerCase() &&
        s.id !== editSubject?.id
    )

    if (alreadyExists) {
      setError(`${subjectForm.name} is already assigned to this grade.`)
      return
    }

    setSaving(true)
    setError('')

    const url = editSubject ? `/api/subjects/${editSubject.id}` : '/api/subjects'
    const method = editSubject ? 'PATCH' : 'POST'

    const { error: err } = await authFetch(url, {
      method,
      body: JSON.stringify({
        name: subjectForm.name.trim(),
        gradeId: subjectForm.gradeId,
        fee: subjectForm.fee,
        monthlySessionTarget: subjectForm.monthlySessionTarget,
      }),
    })

    setSaving(false)

    if (err) {
      setError(err)
      return
    }

    setShowSubjectModal(false)
    setEditSubject(null)
    load()
  }

  const handleDeleteSubject = async () => {
    if (!deleteSubject) return

    setSaving(true)

    const { error: err } = await authFetch(`/api/subjects/${deleteSubject.id}`, {
      method: 'DELETE',
    })

    setSaving(false)

    if (err) {
      setError(err)
      return
    }

    setDeleteSubject(null)
    load()
  }

  if (loading) return <LoadingState message="Loading setup..." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Grades & Subjects</h1>
        <Button
          size="sm"
          onClick={() => {
            setError('')
            setShowGradeModal(true)
          }}
        >
          <Plus className="w-4 h-4" />
          Add Grade
        </Button>
      </div>

      {grades.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 text-center py-8">
            No grades yet. Add your first grade to get started.
          </p>
        </Card>
      ) : (
        grades.map((grade) => (
          <Card key={grade.id}>
            <CardHeader>
              <CardTitle>{grade.name}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => openSubjectModal(grade.id)}>
                <Plus className="w-4 h-4" />
                Subject
              </Button>
            </CardHeader>

            {grade.subjects.length === 0 ? (
              <p className="text-sm text-gray-400">No subjects in this grade.</p>
            ) : (
              <div className="space-y-2">
                {grade.subjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div>
                      <p className="text-sm font-medium">{subject.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatCurrency(subject.fee)} · {subject.monthlySessionTarget} sessions/month
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="maroon">{subject.monthlySessionTarget}/mo</Badge>

                      <button
                        onClick={() => openSubjectModal(grade.id, subject)}
                        className="p-1.5 rounded-lg hover:bg-white text-gray-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setError('')
                          setDeleteSubject(subject)
                        }}
                        className="p-1.5 rounded-lg hover:bg-white text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}

      <Modal open={showGradeModal} onClose={() => setShowGradeModal(false)} title="Add Grade">
        <div className="space-y-4">
          <Input
            label="Grade Name"
            placeholder="e.g. Grade 10"
            value={gradeName}
            onChange={(e) => setGradeName(e.target.value)}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button fullWidth loading={saving} onClick={handleAddGrade}>
            Save Grade
          </Button>
        </div>
      </Modal>

      <Modal
        open={showSubjectModal}
        onClose={() => {
          setShowSubjectModal(false)
          setEditSubject(null)
          setError('')
        }}
        title={editSubject ? 'Edit Subject' : 'Add Subject'}
      >
        <div className="space-y-4">
          <Select
            label="Grade"
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
            value={subjectForm.gradeId}
            onChange={(e) => {
              const selectedGradeId = e.target.value
              const selectedGrade = grades.find((g) => g.id === selectedGradeId)

              const assignedSubjects =
                selectedGrade?.subjects
                  .filter((s) => s.id !== editSubject?.id)
                  .map((s) => s.name.toLowerCase()) || []

              const firstAvailableSubject = SUBJECT_OPTIONS.find(
                (option) => !assignedSubjects.includes(option.value.toLowerCase())
              )

              setSubjectForm({
                ...subjectForm,
                gradeId: selectedGradeId,
                name: firstAvailableSubject?.value || '',
              })
            }}
          />

          <Select
            label="Subject Name"
            placeholder="Select subject"
            options={getSubjectOptionsForGrade()}
            value={subjectForm.name}
            onChange={(e) =>
              setSubjectForm({
                ...subjectForm,
                name: e.target.value,
              })
            }
          />

          <Input
            label="Monthly Fee (Rs.)"
            type="number"
            value={subjectForm.fee}
            onChange={(e) =>
              setSubjectForm({
                ...subjectForm,
                fee: Number(e.target.value),
              })
            }
          />

          <Input
            label="Monthly Session Target"
            type="number"
            hint="Maths/Science usually 10, others 12"
            value={subjectForm.monthlySessionTarget}
            onChange={(e) =>
              setSubjectForm({
                ...subjectForm,
                monthlySessionTarget: Number(e.target.value),
              })
            }
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button fullWidth loading={saving} onClick={handleSaveSubject}>
            Save Subject
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteSubject}
        onClose={() => setDeleteSubject(null)}
        onConfirm={handleDeleteSubject}
        title="Delete Subject"
        message={`Delete ${deleteSubject?.name}? This cannot be undone if students are enrolled.`}
        confirmLabel="Delete"
        loading={saving}
        danger
      />
    </div>
  )
}