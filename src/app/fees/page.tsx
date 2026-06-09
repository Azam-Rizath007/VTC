'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, CreditCard, Receipt, Search, X } from 'lucide-react'
import { StatWidget } from '@/components/ui/StatWidget'
import { SearchBar } from '@/components/ui/SearchBar'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { MobileListCard } from '@/components/ui/MobileListCard'
import { LoadingState } from '@/components/ui/LoadingState'
import { authFetch } from '@/lib/client-api'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeeStats {
  todayCollection: number
  weeklyCollection: number
  monthlyCollection: number
  pendingFeeCount: number
  recentPayments: { id: string; studentName: string; subject: string; amount: number; paidAt: string }[]
  overdueStudents: { studentName: string; grade: string; subject: string; balance: number }[]
}

interface Student {
  id: string
  name: string
  grade: { name: string }
}

interface SubjectFee {
  subjectId: string
  subjectName: string
  fee: number
  balance: number
  amountPaid: number
  discount: number
}

interface FeePreview {
  totalFee: number
  totalPreviouslyPaid: number
  totalDiscount: number
  previousDue: number
  subjects: SubjectFee[]
  student: Student & { grade: { name: string } }
}

interface Payment {
  id: string
  month: number
  year: number
  amountPaid: number
  balance: number
  status: string
  paidAt?: string
  student: { name: string; grade: { name: string } }
  subject: { name: string }
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeesPage() {
  const now = new Date()

  // Page state
  const [stats, setStats] = useState<FeeStats | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState<Payment | null>(null)
  const [listSearch, setListSearch] = useState('')

  // Payment modal state
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [preview, setPreview] = useState<FeePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // Payment form
  const [isFullPayment, setIsFullPayment] = useState(false)
  const [specificAmount, setSpecificAmount] = useState('')
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount')
  const [discountValue, setDiscountValue] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ─── Derived calculations ──────────────────────────────────────────────────

  // Whether any prior payment records exist for this student/month (discount already locked in)
  const hasPriorPayment = useMemo(() => {
    if (!preview) return false
    return preview.totalPreviouslyPaid > 0
  }, [preview])

  const discountAmount = useMemo(() => {
    if (!preview) return 0
    // If a prior partial payment exists, the discount is already locked in the DB — don't re-apply
    if (hasPriorPayment) return preview.totalDiscount
    const v = parseFloat(discountValue) || 0
    if (discountType === 'percent') {
      return Math.round((v / 100) * preview.totalFee)
    }
    return Math.round(v)
  }, [discountValue, discountType, preview, hasPriorPayment])

  const payableAmount = useMemo(() => {
    if (!preview) return 0
    // Remaining balance = previousDue (already accounts for prior payments & discounts)
    // Subtract only the *new* discount when no prior payment exists
    if (hasPriorPayment) return preview.previousDue
    return Math.max(0, preview.totalFee - discountAmount)
  }, [preview, discountAmount, hasPriorPayment])

  const paidAmount = useMemo(() => {
    if (isFullPayment) return payableAmount
    return Math.min(parseFloat(specificAmount) || 0, payableAmount)
  }, [isFullPayment, specificAmount, payableAmount])

  const dueAmount = useMemo(() => {
    return Math.max(0, payableAmount - paidAmount)
  }, [payableAmount, paidAmount])

  // Filtered student list for the dropdown search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students
    const q = studentSearch.toLowerCase()
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.grade.name.toLowerCase().includes(q)
    )
  }, [students, studentSearch])

  // ─── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [statsRes, paymentsRes, studentsRes] = await Promise.all([
      authFetch<FeeStats>('/api/fees/stats'),
      authFetch<{ payments: Payment[] }>(`/api/fees?search=${encodeURIComponent(listSearch)}`),
      authFetch<{ students: Student[] }>('/api/students?status=ACTIVE'),
    ])
    if (statsRes.data) setStats(statsRes.data)
    if (paymentsRes.data?.payments) setPayments(paymentsRes.data.payments)
    if (studentsRes.data?.students) setStudents(studentsRes.data.students)
    setLoading(false)
  }, [listSearch])

  useEffect(() => {
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [load])

  const loadPreview = useCallback(async (studentId: string, m: number, y: number) => {
    setPreviewLoading(true)
    setPreview(null)
    const { data } = await authFetch<FeePreview>(
      `/api/fees/preview?studentId=${studentId}&month=${m}&year=${y}`
    )
    if (data) setPreview(data)
    setPreviewLoading(false)
  }, [])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student)
    setStudentSearch('')
    setPreview(null)
    resetPaymentForm()
    loadPreview(student.id, month, year)
  }

  const handleClearStudent = () => {
    setSelectedStudent(null)
    setPreview(null)
    resetPaymentForm()
  }

  const resetPaymentForm = () => {
    setIsFullPayment(false)
    setSpecificAmount('')
    setDiscountValue('')
    setDiscountType('amount')
    setError('')
  }

  const handleMonthYearChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
    resetPaymentForm()
    if (selectedStudent) loadPreview(selectedStudent.id, newMonth, newYear)
  }

  const handleOpenPaymentModal = () => {
    setSelectedStudent(null)
    setStudentSearch('')
    setPreview(null)
    setMonth(now.getMonth() + 1)
    setYear(now.getFullYear())
    resetPaymentForm()
    setShowPayment(true)
  }

  const handleRecordPayment = async () => {
    setError('')
    if (!selectedStudent) { setError('Select a student'); return }
    if (!preview || preview.subjects.length === 0) { setError('No enrolled subjects found'); return }
    if (!isFullPayment && paidAmount <= 0) { setError('Enter an amount to pay'); return }
    if (paidAmount > payableAmount) { setError('Amount exceeds total payable'); return }

    setSaving(true)
    const { error: err } = await authFetch('/api/fees', {
      method: 'POST',
      body: JSON.stringify({
        studentId: selectedStudent.id,
        month,
        year,
        amountPaid: paidAmount,
        discount: discountAmount,
        isFullPayment,
      }),
    })
    setSaving(false)

    if (err) { setError(err); return }
    setShowPayment(false)
    load()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading && !stats) return <LoadingState message="Loading fees..." />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Fee Collection</h1>
        <Button size="sm" onClick={handleOpenPaymentModal}>
          <Plus className="w-4 h-4" />
          Collect
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatWidget label="Today" value={formatCurrency(stats.todayCollection)} icon={CreditCard} color="green" />
          <StatWidget label="This Week" value={formatCurrency(stats.weeklyCollection)} icon={CreditCard} color="blue" />
          <StatWidget label="This Month" value={formatCurrency(stats.monthlyCollection)} icon={CreditCard} color="purple" />
          <StatWidget label="Pending Students" value={stats.pendingFeeCount} icon={CreditCard} color="orange" />
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
          <div className="space-y-2">
            {!stats?.recentPayments.length ? (
              <p className="text-sm text-gray-400">No recent payments.</p>
            ) : (
              stats.recentPayments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{p.studentName}</p>
                    <p className="text-xs text-gray-400">{p.subject}</p>
                  </div>
                  <span className="font-semibold text-green-600">{formatCurrency(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Overdue Fees</CardTitle></CardHeader>
          <div className="space-y-2">
            {!stats?.overdueStudents.length ? (
              <p className="text-sm text-gray-400">No overdue fees.</p>
            ) : (
              stats.overdueStudents.map((s, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{s.studentName}</p>
                    <p className="text-xs text-gray-400">{s.grade} · {s.subject}</p>
                  </div>
                  <span className="font-semibold text-red-500">{formatCurrency(s.balance)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Payment list */}
      <SearchBar placeholder="Search payments by student..." onChange={setListSearch} />
      <div className="space-y-3">
        {payments.map((payment) => (
          <MobileListCard
            key={payment.id}
            title={payment.student.name}
            subtitle={`${payment.subject.name} · ${payment.student.grade.name}`}
            meta={payment.paidAt ? formatDate(payment.paidAt) : undefined}
            badge={
              <Badge variant={payment.status === 'PAID' ? 'success' : payment.status === 'PARTIAL' ? 'warning' : 'danger'}>
                {formatCurrency(payment.amountPaid)}
              </Badge>
            }
            onClick={() => setShowReceipt(payment)}
          />
        ))}
      </div>

      {/* ─── Record Payment Modal ─────────────────────────────────────────── */}
      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Record Payment">
        <div className="space-y-4">

          {/* Student search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            {selectedStudent ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-indigo-900">{selectedStudent.name}</p>
                  <p className="text-xs text-indigo-500">{selectedStudent.grade.name}</p>
                </div>
                <button onClick={handleClearStudent} className="text-indigo-400 hover:text-indigo-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or grade…"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {studentSearch && filteredStudents.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredStudents.slice(0, 20).map((s) => (
                      <li
                        key={s.id}
                        onClick={() => handleSelectStudent(s)}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-gray-400">{s.grade.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {studentSearch && filteredStudents.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                    No students found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Month / Year */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Month"
              options={MONTHS}
              value={String(month)}
              onChange={(e) => handleMonthYearChange(Number(e.target.value), year)}
            />
            <Input
              label="Year"
              type="number"
              value={year}
              onChange={(e) => handleMonthYearChange(month, Number(e.target.value))}
            />
          </div>

          {/* Preview loading */}
          {previewLoading && (
            <p className="text-sm text-gray-400 text-center py-2">Loading fee details…</p>
          )}

          {/* Fee breakdown — shown once student + preview is loaded */}
          {preview && !previewLoading && (
            <>
              {/* Subject pills */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Enrolled Subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.subjects.map((s) => (
                    <span
                      key={s.subjectId}
                      className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full px-2.5 py-1"
                    >
                      {s.subjectName}
                      <span className="text-gray-400">· {formatCurrency(s.fee)}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Previous due notice */}
              {preview.previousDue > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                  <span className="font-semibold">Previous due: {formatCurrency(preview.previousDue)}</span>
                  <span className="text-amber-600 text-xs block mt-0.5">
                    Remaining balance from prior payments will be included in payable amount.
                  </span>
                </div>
              )}

              {/* Discount row */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                {hasPriorPayment ? (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500">
                    <span>Discount locked from prior payment:</span>
                    <span className="font-semibold text-gray-700">{formatCurrency(preview?.totalDiscount ?? 0)}</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                      <button
                        onClick={() => setDiscountType('amount')}
                        className={`px-3 py-1.5 font-medium transition-colors ${discountType === 'amount' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        Rs.
                      </button>
                      <button
                        onClick={() => setDiscountType('percent')}
                        className={`px-3 py-1.5 font-medium transition-colors ${discountType === 'percent' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        %
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percent' ? 100 : preview?.totalFee}
                      placeholder={discountType === 'percent' ? '0 %' : 'Rs. 0'}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                )}
              </div>

              {/* Full Payment checkbox */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => { setIsFullPayment((v) => !v); setSpecificAmount('') }}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isFullPayment ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}
                >
                  {isFullPayment && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-800">Full Payment</span>
                  <span className="block text-xs text-gray-400">Clears all outstanding balance</span>
                </div>
              </label>

              {/* Specific Amount input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Paid (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  max={payableAmount}
                  placeholder="Enter amount"
                  value={isFullPayment ? payableAmount : specificAmount}
                  disabled={isFullPayment}
                  onChange={(e) => setSpecificAmount(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors ${isFullPayment ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-200 bg-white'}`}
                />
              </div>

              {/* Live fee summary */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm overflow-hidden">
                <SummaryRow label="Total Fee" value={formatCurrency(preview.totalFee)} />
                {preview.totalPreviouslyPaid > 0 && (
                  <SummaryRow label="Already Paid (this month)" value={`− ${formatCurrency(preview.totalPreviouslyPaid)}`} valueClass="text-green-600" />
                )}
                {discountAmount > 0 && (
                  <SummaryRow
                    label={hasPriorPayment ? 'Discount (applied)' : `Discount (${discountType === 'percent' ? discountValue + '%' : formatCurrency(discountAmount)})`}
                    value={`− ${formatCurrency(discountAmount)}`}
                    valueClass="text-blue-600"
                  />
                )}
                <SummaryRow label="Remaining Payable" value={formatCurrency(payableAmount)} valueClass="font-bold text-gray-900" />
                <SummaryRow label="Amount Being Paid" value={formatCurrency(paidAmount)} valueClass="text-green-600 font-semibold" />
                <SummaryRow
                  label="Due After Payment"
                  value={formatCurrency(dueAmount)}
                  valueClass={dueAmount > 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            fullWidth
            loading={saving}
            onClick={handleRecordPayment}
            disabled={!selectedStudent || previewLoading || (!!preview && paidAmount <= 0 && !isFullPayment)}
          >
            Record Payment
          </Button>
        </div>
      </Modal>

      {/* ─── Receipt Modal ────────────────────────────────────────────────── */}
      <Modal open={!!showReceipt} onClose={() => setShowReceipt(null)} title="Payment Receipt">
        {showReceipt && (
          <div className="space-y-4 text-sm">
            <div className="text-center py-4 border-b border-gray-100">
              <Receipt className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="font-bold text-gray-900">Fee Receipt</p>
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-400">Student</dt>
                <dd className="font-medium">{showReceipt.student.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Grade</dt>
                <dd>{showReceipt.student.grade.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Subject</dt>
                <dd>{showReceipt.subject.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Period</dt>
                <dd>{MONTHS[showReceipt.month - 1]?.label} {showReceipt.year}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Amount Paid</dt>
                <dd className="font-bold text-green-600">{formatCurrency(showReceipt.amountPaid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Balance Due</dt>
                <dd className={showReceipt.balance > 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}>
                  {formatCurrency(showReceipt.balance)}
                </dd>
              </div>
              {showReceipt.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Date</dt>
                  <dd>{formatDate(showReceipt.paidAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Helper component ──────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  valueClass = 'text-gray-700',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex justify-between items-center px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}
