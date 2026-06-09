'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, GraduationCap } from 'lucide-react'
import { SearchBar } from '@/components/ui/SearchBar'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { MobileListCard } from '@/components/ui/MobileListCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState, SkeletonCard } from '@/components/ui/LoadingState'
import { StudentForm } from '@/components/students/StudentForm'
import { authFetch } from '@/lib/client-api'

interface Student {
  id: string
  name: string
  status: 'ACTIVE' | 'INACTIVE'
  parentName?: string | null
  parentContact?: string | null
  grade: { id: string; name: string }
  subjects: { subject: { id: string; name: string } }[]
}

interface Grade {
  id: string
  name: string
  subjects: { id: string; name: string }[]
}

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [status, setStatus] = useState('')

  const loadGrades = useCallback(async () => {
    const { data } = await authFetch<{ grades: Grade[] }>('/api/grades')
    if (data?.grades) setGrades(data.grades)
  }, [])

  const loadStudents = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (gradeId) params.set('gradeId', gradeId)
    if (subjectId) params.set('subjectId', subjectId)
    if (status) params.set('status', status)

    const { data } = await authFetch<{ students: Student[] }>(`/api/students?${params}`)
    if (data?.students) setStudents(data.students)
    setLoading(false)
  }, [search, gradeId, subjectId, status])

  useEffect(() => {
    loadGrades()
  }, [loadGrades])

  useEffect(() => {
    const timer = setTimeout(loadStudents, 300)
    return () => clearTimeout(timer)
  }, [loadStudents])

  const subjectOptions = grades
    .find((g) => g.id === gradeId)
    ?.subjects.map((s) => ({ value: s.id, label: s.name })) ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900">Students</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      <SearchBar placeholder="Search by name or parent..." onChange={setSearch} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          placeholder="All grades"
          options={grades.map((g) => ({ value: g.id, label: g.name }))}
          value={gradeId}
          onChange={(e) => {
            setGradeId(e.target.value)
            setSubjectId('')
          }}
        />
        <Select
          placeholder="All subjects"
          options={subjectOptions}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          disabled={!gradeId}
        />
        <Select
          placeholder="All statuses"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          description="Add a student or adjust your filters."
          action={<Button onClick={() => setShowForm(true)}>Add Student</Button>}
        />
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <MobileListCard
              key={student.id}
              title={student.name}
              subtitle={`${student.grade.name} · ${student.subjects.map((s) => s.subject.name).join(', ')}`}
              meta={student.parentContact || undefined}
              left={<Avatar name={student.name} />}
              badge={
                <Badge variant={student.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {student.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </Badge>
              }
              onClick={() => router.push(`/students/${student.id}`)}
            />
          ))}
        </div>
      )}

      <StudentForm open={showForm} onClose={() => setShowForm(false)} onSuccess={loadStudents} />
    </div>
  )
}
