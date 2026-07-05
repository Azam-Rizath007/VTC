import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@/generated/prisma'
import { isBillableFeeMonth, isDetailedFeeEnabled } from '@/lib/services/fees'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const studentId = id.toUpperCase()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const student = await prisma.student.findUnique({
    where: { studentId },
    select: {
      id: true,
      studentId: true,
      name: true,
      status: true,
      createdAt: true,
      grade: { select: { name: true } },
      subjects: {
        select: { subject: { select: { id: true, name: true } } },
      },
      attendances: {
        where: {
          date: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
        select: {
          subjectId: true,
          status: true,
          date: true,
          sessionNumber: true,
          subject: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      },
      payments: {
        select: { month: true, year: true, amountPaid: true, balance: true, status: true, paidAt: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      },
      monthlyFees: {
        select: { month: true, year: true, paidAmount: true, balance: true, status: true, paidAt: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      },
    },
  })

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Attendance summary per subject
  const summaryMap: Record<string, { subject: string; present: number; absent: number; total: number }> = {}
  for (const a of student.attendances) {
    if (!summaryMap[a.subjectId]) {
      summaryMap[a.subjectId] = { subject: a.subject.name, present: 0, absent: 0, total: 0 }
    }
    summaryMap[a.subjectId].total++
    if (a.status === 'PRESENT') summaryMap[a.subjectId].present++
    else summaryMap[a.subjectId].absent++
  }

  const now = new Date()
  const monthlyFees = student.monthlyFees.filter((p) =>
    isBillableFeeMonth(student.createdAt, p.month, p.year, now)
  )
  const payments = student.payments.filter((p) =>
    isBillableFeeMonth(student.createdAt, p.month, p.year, now)
  )
  const useMonthlyFees = !isDetailedFeeEnabled() && monthlyFees.length > 0

  const paymentHistory = useMonthlyFees
    ? monthlyFees.map((p) => ({
        month: p.month,
        year: p.year,
        amountPaid: p.paidAmount,
        balance: p.balance,
        status: p.status,
        paidAt: p.paidAt?.toISOString() ?? null,
      }))
    : Object.values(payments.reduce<
        Record<string, { month: number; year: number; amountPaid: number; balance: number; status: string; paidAt: string | null }>
      >((acc, p) => {
        const key = `${p.year}-${p.month}`
        if (!acc[key]) acc[key] = { month: p.month, year: p.year, amountPaid: 0, balance: 0, status: 'PENDING', paidAt: null }
        acc[key].amountPaid += p.amountPaid
        acc[key].balance += p.balance
        if (p.paidAt) acc[key].paidAt = p.paidAt.toISOString()
        return acc
      }, {})).map((p) => ({
        ...p,
        status: p.balance === 0 && p.amountPaid > 0 ? 'PAID' : p.amountPaid > 0 ? 'PARTIAL' : 'PENDING',
      }))

  paymentHistory.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)

  const pendingBalance = useMonthlyFees
    ? monthlyFees
        .filter((p) => p.status !== PaymentStatus.PAID)
        .reduce((s, p) => s + p.balance, 0)
    : payments
        .filter((p) => p.status !== PaymentStatus.PAID)
        .reduce((s, p) => s + p.balance, 0)

  // Detailed attendance list (safe — no teacher info)
  const attendanceDetails = student.attendances.map((a) => ({
    subject: a.subject.name,
    date: a.date.toISOString(),
    sessionNumber: a.sessionNumber,
    status: a.status,
  }))

  return NextResponse.json({
    student: {
      id: student.studentId,
      studentId: student.studentId,
      name: student.name,
      status: student.status,
      grade: student.grade.name,
      subjects: student.subjects.map((s) => s.subject.name),
      pendingBalance,
      attendanceSummary: Object.values(summaryMap),
      attendanceDetails,
      paymentHistory,
    },
  })
}
