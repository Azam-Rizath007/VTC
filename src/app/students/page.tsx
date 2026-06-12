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

    try {
      const params = new URLSearchParams()

      if (search.trim()) params.set('search', search.trim())
      if (gradeId) params.set('gradeId', gradeId)
      if (subjectId) params.set('subjectId', subjectId)
      if (status) params.set('status', status)

      const query = params.toString()
      const url = query ? `/api/students?${query}` : '/api/students'

      const { data, error } = await authFetch<{ students: Student[] }>(url)

      if (error) {
        console.error('Failed to load students:', error)
        setStudents([])
        return
      }

      setStudents(data?.students ?? [])
    } catch (err) {
      console.error('Failed to load students:', err)
      setStudents([])
    } finally {useEffect
      setLoading(false)
    }
  }, [search, gradeId, subjectId, status])

  useEffect(() => {
    loadGrades()
  }, [loadGrades])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const subjectOptions = grades
    .find((g) => g.id === gradeId)
    ?.subjects.map((s) => ({ value: s.id, label: s.name })) ?? []
  
  const handleToggleStatus = async (student: Student) => {
    const newStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    await authFetch(`/api/students/${student.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: newStatus,
      }),
    })

    loadStudents()
  }

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
            // <MobileListCard
            //   key={student.id}
            //   title={student.name}
            //   subtitle={`${student.grade.name} · ${student.subjects.map((s) => s.subject.name).join(', ')}`}
            //   meta={student.parentContact || undefined}
            //   left={<Avatar name={student.name} />}
            //   badge={
            //     <div className="flex items-center gap-2">
            //       <Badge variant={student.status === 'ACTIVE' ? 'success' : 'neutral'}>
            //         {student.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            //       </Badge>

            //       <Button
            //         size="sm"
            //         variant={student.status === 'ACTIVE' ? 'outline' : 'primary'}
            //         onClick={(e) => {
            //           e.stopPropagation()
            //           handleToggleStatus(student)
            //         }}
            //       >
            //         {student.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            //       </Button>
            //     </div>
            //   }
            //   onClick={() => router.push(`/students/${student.id}`)}
            // />
            <MobileListCard
              key={student.id}
              title={student.name}
              subtitle={`${student.grade.name} · ${student.subjects.map((s) => s.subject.name).join(', ')}`}
              meta={student.parentContact || undefined}
              left={<Avatar name={student.name} />}
              badge={
                <div className="flex items-center gap-2">
                  <Badge variant={student.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {student.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
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
