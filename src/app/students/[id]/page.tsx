'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, UserX, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StudentForm } from '@/components/students/StudentForm'
import { authFetch } from '@/lib/client-api'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { StudentFormData } from '@/lib/validations/student'

interface StudentDetail {
  id: string
  name: string
  status: 'ACTIVE' | 'INACTIVE'
  parentName?: string | null
  parentContact?: string | null
  notes?: string | null
  grade: { id: string; name: string }
  subjects: { subject: { id: string; name: string; fee: number } }[]
  pendingBalance: number
  feeStatus: {
    subjectName: string
    fee: number
    amountDue: number
    amountPaid: number
    balance: number
    status: string
  }[]
  attendanceSummary: {
    subject: string
    present: number
    absent: number
    total: number
  }[]
  paymentHistory: {
    id: string
    month: number
    year: number
    amountPaid: number
    balance: number
    status: string
    paidAt?: string | null
    subject: { name: string }
  }[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function statusBadge(status: string) {
  if (status === 'PAID') return <Badge variant="success">Paid</Badge>
  if (status === 'PARTIAL') return <Badge variant="warning">Partial</Badge>
  return <Badge variant="danger">Pending</Badge>
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const loadStudent = useCallback(async () => {
    setLoading(true)
    const { data, error } = await authFetch<{ student: StudentDetail }>(`/api/students/${id}`)
    if (error || !data?.student) {
      router.replace('/students')
      return
    }
    setStudent(data.student)
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    loadStudent()
  }, [loadStudent])

  const handleDeactivate = async () => {
    setDeactivating(true)
    await authFetch(`/api/students/${id}`, { method: 'DELETE' })
    setDeactivating(false)
    setShowDeactivate(false)
    loadStudent()
  }

  if (loading || !student) return <LoadingState message="Loading student..." />

  const formInitial: StudentFormData & { id: string } = {
    id: student.id,
    name: student.name,
    gradeId: student.grade.id,
    parentName: student.parentName ?? '',
    parentContact: student.parentContact ?? '',
    notes: student.notes ?? '',
    subjectIds: student.subjects.map((s) => s.subject.id),
    status: student.status,
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900">{student.name}</h1>
            <Badge variant={student.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {student.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">{student.grade.name}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Edit className="w-4 h-4" />
          Edit
        </Button>
        <Link href={`/students/${student.id}/attendance`}>
          <Button size="sm" variant="outline">
            <ClipboardList className="w-4 h-4" />
            Attendance
          </Button>
        </Link>
        {student.status === 'ACTIVE' && (
          <Button size="sm" variant="danger" onClick={() => setShowDeactivate(true)}>
            <UserX className="w-4 h-4" />
            Deactivate
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Details</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-400">Parent / Guardian</dt>
            <dd className="font-medium">{student.parentName || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Contact</dt>
            <dd className="font-medium">{student.parentContact || '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-400">Notes</dt>
            <dd className="font-medium">{student.notes || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Pending Balance</dt>
            <dd className="font-semibold text-red-500">{formatCurrency(student.pendingBalance)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrolled Subjects</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {student.subjects.map(({ subject }) => (
            <Badge key={subject.id} variant="maroon">
              {subject.name} · {formatCurrency(subject.fee)}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee Status (This Month)</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {student.feeStatus.map((fee) => (
            <div key={fee.subjectName} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{fee.subjectName}</p>
                <p className="text-xs text-gray-400">
                  Paid {formatCurrency(fee.amountPaid)} of {formatCurrency(fee.amountDue)}
                </p>
              </div>
              <div className="text-right">
                {statusBadge(fee.status)}
                {fee.balance > 0 && (
                  <p className="text-xs text-red-500 mt-1">{formatCurrency(fee.balance)} due</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Summary</CardTitle>
        </CardHeader>
        {student.attendanceSummary.length === 0 ? (
          <p className="text-sm text-gray-400">No attendance records yet.</p>
        ) : (
          <div className="space-y-3">
            {student.attendanceSummary.map((row) => (
              <div key={row.subject} className="flex items-center justify-between text-sm">
                <p className="font-medium">{row.subject}</p>
                <p className="text-gray-500">
                  <span className="text-green-600">{row.present} present</span>
                  {' · '}
                  <span className="text-red-500">{row.absent} absent</span>
                  {' · '}
                  {row.total} total
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        {student.paymentHistory.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {student.paymentHistory.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{payment.subject.name}</p>
                  <p className="text-xs text-gray-400">
                    {MONTHS[payment.month - 1]} {payment.year}
                    {payment.paidAt && ` · ${formatDate(payment.paidAt)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">{formatCurrency(payment.amountPaid)}</p>
                  {statusBadge(payment.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <StudentForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={loadStudent}
        initial={formInitial}
      />

      <ConfirmDialog
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Student"
        message={`Are you sure you want to deactivate ${student.name}? They will no longer appear in active lists.`}
        confirmLabel="Deactivate"
        loading={deactivating}
        danger
      />
    </div>
  )
}
