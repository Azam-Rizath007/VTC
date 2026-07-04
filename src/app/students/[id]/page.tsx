'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, UserX, UserCheck, ClipboardList, Share2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StudentForm } from '@/components/students/StudentForm'
import { authFetch } from '@/lib/client-api'
import { formatCurrency } from '@/lib/utils'
import type { StudentFormData } from '@/lib/validations/student'

interface StudentDetail {
  id: string
  studentId: string
  name: string
  status: 'ACTIVE' | 'INACTIVE'
  parentName?: string | null
  parentContact?: string | null
  notes?: string | null
  grade: { id: string; name: string }
  subjects: { subject: { id: string; name: string; fee: number } }[]
  pendingBalance: number
  attendanceSummary: {
    subject: string
    present: number
    absent: number
    total: number
  }[]
  paymentHistory: {
    month: number
    year: number
    amountPaid: number
    balance: number
    status: string
    paidAt?: string | null
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
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const handleToggleStatus = async () => {
    if (!student) return

    const newStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    setUpdatingStatus(true)

    await authFetch(`/api/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: newStatus,
      }),
    })

    setUpdatingStatus(false)
    setShowStatusDialog(false)
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
          <p className="text-sm text-gray-500">{student.grade.name} - {student.studentId}</p>
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
        {/* <Button
          size="sm"
          variant={copied ? 'success' : 'outline'}
          onClick={async () => {
            const publicUrl = `${window.location.origin}/p/${student.id}`

            try {
              await navigator.clipboard.writeText(publicUrl)
              setCopied(true)

              setTimeout(() => {
                setCopied(false)
              }, 1500)
            } catch {
              setCopied(false)
            }
          }}
        >
          <Share2 className="w-4 h-4" />
          {copied ? 'Copied' : 'Share Profile'}
        </Button> */}
        <Button
          size="sm"
          variant="outline"
          className={copied ? 'bg-green-50 text-green-700 border-green-200' : ''}
          onClick={async () => {
            const publicUrl = `${window.location.origin}/p/${student.studentId}`

            try {
              await navigator.clipboard.writeText(publicUrl)
              setCopied(true)

              setTimeout(() => {
                setCopied(false)
              }, 1500)
            } catch {
              setCopied(false)
            }
          }}
        >
          <Share2 className="w-4 h-4" />
          {copied ? 'Copied' : 'Share Profile'}
        </Button>
        <Button
          size="sm"
          variant={student.status === 'ACTIVE' ? 'danger' : 'outline'}
          onClick={() => setShowStatusDialog(true)}
        >
          {student.status === 'ACTIVE' ? (
            <UserX className="w-4 h-4" />
          ) : (
            <UserCheck className="w-4 h-4" />
          )}

          {student.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Details</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-400">Student ID</dt>
            <dd className="font-medium">{student.studentId}</dd>
          </div>
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
              {subject.name}
            </Badge>
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
              <div key={`${payment.year}-${payment.month}`} className="flex items-center justify-between text-sm">
                <p className="font-medium">{MONTHS[payment.month - 1]} {payment.year}</p>
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
        open={showStatusDialog}
        onClose={() => setShowStatusDialog(false)}
        onConfirm={handleToggleStatus}
        title={student.status === 'ACTIVE' ? 'Deactivate Student' : 'Activate Student'}
        message={
          student.status === 'ACTIVE'
            ? `Are you sure you want to deactivate ${student.name}? They will no longer appear in active lists.`
            : `Are you sure you want to activate ${student.name}? They will appear in active lists again.`
        }
        confirmLabel={student.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        loading={updatingStatus}
        danger={student.status === 'ACTIVE'}
      />
    </div>
  )
}
