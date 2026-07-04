'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PublicStudent {
  id: string
  studentId: string
  name: string
  status: string
  grade: string
  subjects: string[]
  pendingBalance: number
  attendanceSummary: { subject: string; present: number; absent: number; total: number }[]
  attendanceDetails: { subject: string; date: string; sessionNumber: number; status: string }[]
  paymentHistory: { month: number; year: number; amountPaid: number; balance: number; status: string; paidAt: string | null }[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function PayBadge({ status }: { status: string }) {
  if (status === 'PAID') return <Badge variant="success">Paid</Badge>
  if (status === 'PARTIAL') return <Badge variant="warning">Partial</Badge>
  return <Badge variant="danger">Pending</Badge>
}

export default function PublicStudentPage() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<PublicStudent | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showAttendanceDetail, setShowAttendanceDetail] = useState(false)

  useEffect(() => {
    fetch(`/api/public/students/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.student) setStudent(data.student)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingState message="Loading student profile..." />

  if (notFound || !student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <GraduationCap className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-gray-500 font-medium">Student not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-gray-900">{student.name}</h1>
              <Badge variant={student.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {student.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">{student.grade} - {student.studentId}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Subjects */}
        <Card>
          <CardHeader><CardTitle>Enrolled Subjects</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2">
            {student.subjects.map((name) => (
              <Badge key={name} variant="maroon">{name}</Badge>
            ))}
          </div>
        </Card>

        {/* Fee summary */}
        <Card>
          <CardHeader><CardTitle>Fee Status</CardTitle></CardHeader>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total Pending Balance</span>
            <span className={`font-semibold ${student.pendingBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatCurrency(student.pendingBalance)}
            </span>
          </div>
        </Card>

        {/* Attendance summary */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Attendance</CardTitle>
          </CardHeader>

          {student.attendanceDetails.length === 0 ? (
            <p className="text-sm text-gray-400">
              No attendance marked for today.
            </p>
          ) : (
            <div className="space-y-2">
              {student.attendanceDetails.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{a.subject}</p>
                    <p className="text-xs text-gray-400">
                      Session {a.sessionNumber} · {formatDate(a.date)}
                    </p>
                  </div>

                  <Badge variant={a.status === 'PRESENT' ? 'success' : 'danger'}>
                    {a.status === 'PRESENT' ? 'Present' : 'Absent'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Payment history */}
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          {student.paymentHistory.length === 0 ? (
            <p className="text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {student.paymentHistory.map((p) => (
                <div key={`${p.year}-${p.month}`} className="flex items-center justify-between text-sm">
                  <p className="font-medium">{MONTHS[p.month - 1]} {p.year}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-600">{formatCurrency(p.amountPaid)}</span>
                    <PayBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400 pb-4">
          Read-only student profile. For queries, contact the institute directly.
        </p>
      </div>
    </div>
  )
}
