'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'
import { studentSchema, type StudentFormData } from '@/lib/validations/student'
import { cn } from '@/lib/utils'

interface Grade {
  id: string
  name: string
  subjects: { id: string; name: string; fee: number }[]
}

interface StudentFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  initial?: StudentFormData & { id?: string }
}

export function StudentForm({ open, onClose, onSuccess, initial }: StudentFormProps) {
  const [grades, setGrades] = useState<Grade[]>([])
  const [loadingGrades, setLoadingGrades] = useState(true)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: '',
      gradeId: '',
      parentName: '',
      parentContact: '',
      notes: '',
      subjectIds: [],
      status: 'ACTIVE',
    },
  })

  const gradeId = watch('gradeId')
  const subjectIds = watch('subjectIds') ?? []
  const selectedGrade = grades.find((g) => g.id === gradeId)

  useEffect(() => {
    if (!open) return
    authFetch<{ grades: Grade[] }>('/api/grades').then(({ data }) => {
      if (data?.grades) setGrades(data.grades)
      setLoadingGrades(false)
    })
  }, [open])

  useEffect(() => {
    if (open && initial) {
      reset(initial)
    } else if (open && !initial) {
      reset({
        name: '',
        gradeId: '',
        parentName: '',
        parentContact: '',
        notes: '',
        subjectIds: [],
        status: 'ACTIVE',
      })
    }
  }, [open, initial, reset])

  const toggleSubject = (id: string) => {
    const next = subjectIds.includes(id)
      ? subjectIds.filter((s) => s !== id)
      : [...subjectIds, id]
    setValue('subjectIds', next, { shouldValidate: true })
  }

  const onSubmit = async (data: StudentFormData) => {
    setServerError('')
    const url = initial?.id ? `/api/students/${initial.id}` : '/api/students'
    const method = initial?.id ? 'PATCH' : 'POST'
    const { error } = await authFetch(url, {
      method,
      body: JSON.stringify(data),
    })
    if (error) {
      setServerError(error)
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit Student' : 'Add Student'}>
      {loadingGrades ? (
        <LoadingState message="Loading grades..." />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Student Name" placeholder="Full name" error={errors.name?.message} {...register('name')} />
          <Select
            label="Grade / Year"
            placeholder="Select grade"
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
            error={errors.gradeId?.message}
            {...register('gradeId')}
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Subjects Enrolled</p>
            {!selectedGrade ? (
              <p className="text-xs text-gray-400">Select a grade first</p>
            ) : (
              <div className="space-y-2">
                {selectedGrade.subjects.map((sub) => (
                  <label
                    key={sub.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors',
                      subjectIds.includes(sub.id)
                        ? 'border-maroon-700 bg-maroon-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <span className="text-sm text-gray-900">{sub.name}</span>
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(sub.id)}
                      onChange={() => toggleSubject(sub.id)}
                      className="w-4 h-4 accent-maroon-700"
                    />
                  </label>
                ))}
              </div>
            )}
            {errors.subjectIds && <p className="mt-1 text-xs text-red-500">{errors.subjectIds.message}</p>}
          </div>

          <Input label="Parent / Guardian Name" placeholder="Optional" {...register('parentName')} />
          <Input label="Parent Contact" placeholder="0300-0000000" {...register('parentContact')} />
          <Textarea label="Notes" rows={3} placeholder="Optional notes" {...register('notes')} />

          {initial?.id && (
            <Select
              label="Status"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              {...register('status')}
            />
          )}

          {serverError && <p className="text-sm text-red-500 text-center">{serverError}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={isSubmitting}>
              {initial?.id ? 'Save Changes' : 'Add Student'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
