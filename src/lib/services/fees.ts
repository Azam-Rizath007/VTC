import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@/generated/prisma'

export interface PaymentInput {
  studentId: string
  subjectId: string
  month: number
  year: number
  amountPaid: number
  discount?: number
}

/** New bulk payment input — pays across all enrolled subjects for a month */
export interface BulkPaymentInput {
  studentId: string
  month: number
  year: number
  /** Raw cash collected from student this session */
  amountPaid: number
  /** Discount in rupees (already converted from % on the client) */
  discount: number
  /** Whether this is intended as a full payment (clears all due) */
  isFullPayment: boolean
}

export interface PaymentFilters {
  search?: string
  month?: number
  year?: number
  gradeId?: string
  subjectId?: string
}

function calcStatus(balance: number, amountPaid: number): PaymentStatus {
  if (balance === 0 && amountPaid > 0) return PaymentStatus.PAID
  if (amountPaid > 0) return PaymentStatus.PARTIAL
  return PaymentStatus.PENDING
}

export async function getFeeStats() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const payments = await prisma.feePayment.findMany({
    where: { paidAt: { not: null } },
    include: { student: { include: { grade: true } }, subject: true },
    orderBy: { paidAt: 'desc' },
  })

  const todayCollection = payments
    .filter((p) => p.paidAt && p.paidAt >= todayStart)
    .reduce((s, p) => s + p.amountPaid, 0)

  const weeklyCollection = payments
    .filter((p) => p.paidAt && p.paidAt >= weekStart)
    .reduce((s, p) => s + p.amountPaid, 0)

  const monthlyCollection = payments
    .filter((p) => p.paidAt && p.paidAt >= monthStart)
    .reduce((s, p) => s + p.amountPaid, 0)

  const pending = await prisma.feePayment.findMany({
    where: { status: { not: PaymentStatus.PAID } },
    include: { student: { include: { grade: true } }, subject: true },
  })

  const pendingStudentIds = new Set(pending.map((p) => p.studentId))

  return {
    todayCollection,
    weeklyCollection,
    monthlyCollection,
    pendingFeeCount: pendingStudentIds.size,
    overdueStudents: pending.slice(0, 10).map((p) => ({
      studentName: p.student.name,
      grade: p.student.grade.name,
      subject: p.subject.name,
      balance: p.balance,
    })),
    recentPayments: payments.slice(0, 10).map((p) => ({
      id: p.id,
      studentName: p.student.name,
      subject: p.subject.name,
      amount: p.amountPaid,
      paidAt: p.paidAt,
    })),
  }
}

export async function listPayments(filters: PaymentFilters = {}) {
  const { search, month, year, gradeId, subjectId } = filters

  return prisma.feePayment.findMany({
    where: {
      ...(month && { month }),
      ...(year && { year }),
      ...(subjectId && { subjectId }),
      ...(gradeId && { student: { gradeId } }),
      ...(search && {
        student: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { parentName: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    },
    include: {
      student: { include: { grade: true } },
      subject: true,
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { updatedAt: 'desc' }],
  })
}

export async function getStudentFeePreview(studentId: string, month: number, year: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      grade: true,
      subjects: { include: { subject: true } },
      payments: {
        where: { month, year },
        include: { subject: true },
      },
    },
  })

  if (!student) return null

  const subjects = student.subjects.map(({ subject }) => {
    const existing = student.payments.find((p) => p.subjectId === subject.id)
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      fee: subject.fee,
      amountDue: existing?.amountDue ?? subject.fee,
      amountPaid: existing?.amountPaid ?? 0,
      discount: existing?.discount ?? 0,
      balance: existing?.balance ?? subject.fee,
      paymentId: existing?.id,
    }
  })

  // Aggregate totals
  const totalFee = subjects.reduce((s, sub) => s + sub.fee, 0)
  const totalPreviouslyPaid = subjects.reduce((s, sub) => s + sub.amountPaid, 0)
  const totalDiscount = subjects.reduce((s, sub) => s + sub.discount, 0)
  const previousDue = subjects.reduce((s, sub) => s + sub.balance, 0)

  return {
    student,
    subjects,
    totalFee,
    totalPreviouslyPaid,
    totalDiscount,
    previousDue,
    /** @deprecated use previousDue */
    totalDue: previousDue,
  }
}

/**
 * Records a bulk payment across all enrolled subjects for a student for a given month.
 * Distributes the paid amount proportionally across subjects and saves per-subject records.
 * Returns an aggregate summary.
 */
export async function recordBulkPayment(data: BulkPaymentInput) {
  const { studentId, month, year, amountPaid, discount, isFullPayment } = data

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      subjects: { include: { subject: true } },
      payments: { where: { month, year } },
    },
  })
  if (!student) throw new Error('Student not found')
  if (!student.subjects.length) throw new Error('Student has no enrolled subjects')

  const totalFee = student.subjects.reduce((s, ss) => s + ss.subject.fee, 0)

  // Clamp discount to totalFee
  const safeDiscount = Math.min(discount, totalFee)

  // For each subject, the current balance already accounts for prior payments and discounts.
  // "Remaining due" = sum of existing balances (or full fee if no prior payment).
  // We apply the new discount only against subjects that haven't had a discount yet.
  const subjectData = student.subjects.map(({ subject }) => {
    const existing = student.payments.find((p) => p.subjectId === subject.id)
    const subjectRatio = totalFee > 0 ? subject.fee / totalFee : 1 / student.subjects.length
    // Only apply discount if not already discounted (i.e. no prior payment record)
    const subDiscount = existing ? (existing.discount) : Math.round(safeDiscount * subjectRatio)
    const priorPaid = existing?.amountPaid ?? 0
    const priorDiscount = existing?.discount ?? subDiscount
    const netSubDue = Math.max(0, subject.fee - priorDiscount)
    const currentBalance = Math.max(0, netSubDue - priorPaid)
    return { subject, existing, subjectRatio, subDiscount: priorDiscount, priorPaid, currentBalance }
  })

  // Total remaining to pay right now
  const totalRemainingDue = subjectData.reduce((s, sd) => s + sd.currentBalance, 0)

  // For full payment: pay exactly what is still owed (the remaining due)
  // For partial: cap at remaining due so we never overpay
  const effectivePaid = isFullPayment
    ? totalRemainingDue
    : Math.min(amountPaid, totalRemainingDue)

  const now = new Date()
  const results = []

  for (const { subject, existing, subjectRatio, subDiscount, priorPaid, currentBalance } of subjectData) {
    // Distribute this session's payment proportionally across subjects by their remaining balance
    const subPaid = totalRemainingDue > 0
      ? Math.round(effectivePaid * (currentBalance / totalRemainingDue))
      : 0

    const amountDue = subject.fee
    const totalSubPaid = priorPaid + subPaid
    const netSubDue = Math.max(0, amountDue - subDiscount)
    const balance = Math.max(0, netSubDue - totalSubPaid)
    const status = calcStatus(balance, totalSubPaid)

    const payload = {
      amountDue,
      amountPaid: totalSubPaid,
      discount: subDiscount,
      balance,
      status,
      paidAt: subPaid > 0 ? now : (existing?.paidAt ?? null),
      updatedAt: now,
    }

    if (existing) {
      const updated = await prisma.feePayment.update({
        where: { id: existing.id },
        data: payload,
        include: { student: true, subject: true },
      })
      results.push(updated)
    } else {
      const created = await prisma.feePayment.create({
        data: {
          studentId,
          subjectId: subject.id,
          month,
          year,
          ...payload,
        },
        include: { student: true, subject: true },
      })
      results.push(created)
    }
  }

  const totalBalance = results.reduce((s, r) => s + r.balance, 0)
  const totalAmountPaid = results.reduce((s, r) => s + r.amountPaid, 0)

  return {
    payments: results,
    summary: {
      totalFee,
      discount: safeDiscount,
      netPayable: totalRemainingDue,
      amountPaid: effectivePaid,
      dueAmount: totalBalance,
      totalAmountPaid,
      status: totalBalance === 0 ? PaymentStatus.PAID : effectivePaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING,
    },
  }
}

/** Original single-subject payment kept for backward compatibility */
export async function recordPayment(data: PaymentInput) {
  const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } })
  if (!subject) throw new Error('Subject not found')

  const existing = await prisma.feePayment.findFirst({
    where: {
      studentId: data.studentId,
      subjectId: data.subjectId,
      month: data.month,
      year: data.year,
    },
  })

  const amountDue = existing?.amountDue ?? subject.fee
  const discount = data.discount ?? existing?.discount ?? 0
  const totalPaid = (existing?.amountPaid ?? 0) + data.amountPaid
  const netDue = Math.max(0, amountDue - discount)
  const balance = Math.max(0, netDue - totalPaid)
  const status = calcStatus(balance, totalPaid)

  const payload = {
    amountDue,
    amountPaid: totalPaid,
    discount,
    balance,
    status,
    paidAt: new Date(),
  }

  if (existing) {
    return prisma.feePayment.update({
      where: { id: existing.id },
      data: payload,
      include: { student: true, subject: true },
    })
  }

  return prisma.feePayment.create({
    data: {
      studentId: data.studentId,
      subjectId: data.subjectId,
      month: data.month,
      year: data.year,
      ...payload,
    },
    include: { student: true, subject: true },
  })
}

export async function getPaymentById(id: string) {
  return prisma.feePayment.findUnique({
    where: { id },
    include: {
      student: { include: { grade: true } },
      subject: true,
    },
  })
}
