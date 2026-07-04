import { prisma } from '@/lib/prisma'
import { PaymentStatus, Prisma, StudentStatus } from '@/generated/prisma'
import { isBillableFeeMonth, isDetailedFeeEnabled } from '@/lib/services/fees'

const STUDENT_ID_PREFIX = 'VTC'
const STUDENT_ID_START = 1531
const MAX_STUDENT_ID_ATTEMPTS = 5

export interface StudentFilters {
  search?: string
  gradeId?: string
  subjectId?: string
  status?: StudentStatus
}

export interface StudentInput {
  name: string
  gradeId: string
  parentName?: string
  parentContact?: string
  notes?: string
  subjectIds: string[]
  status?: StudentStatus
}

type FeeStatusRow = {
  subjectId: string
  subjectName: string
  fee: number
  amountDue: number
  amountPaid: number
  balance: number
  status: string
}

type PaymentHistoryRow = {
  month: number
  year: number
  amountPaid: number
  balance: number
  status: string
  paidAt?: string | null
}

function getStudentYearPrefix(date = new Date()) {
  const year = String(date.getFullYear() % 100).padStart(2, '0')
  return `${STUDENT_ID_PREFIX}-${year}`
}

async function generateStudentId() {
  const prefix = getStudentYearPrefix()
  const studentsForYear = await prisma.student.findMany({
    where: { studentId: { startsWith: prefix } },
    select: { studentId: true },
  })

  const lastNumber = studentsForYear.reduce((max, student) => {
    const sequence = Number.parseInt(student.studentId.slice(prefix.length), 10)
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max
  }, STUDENT_ID_START - 1)
  const nextNumber = Math.max(lastNumber + 1, STUDENT_ID_START)

  if (!Number.isInteger(nextNumber)) {
    throw new Error(`Student ID range exhausted for ${prefix}`)
  }

  return `${prefix}${nextNumber}`
}

function isStudentIdCollision(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false

  const target = error.meta?.target
  return Array.isArray(target)
    ? target.includes('studentId')
    : target === 'Student_studentId_key'
}

export async function listStudents(filters: StudentFilters = {}) {
  const { search, gradeId, subjectId, status } = filters

  return prisma.student.findMany({
    where: {
      ...(gradeId && { gradeId }),
      ...(status && { status }),
      ...(subjectId && { subjects: { some: { subjectId } } }),
      ...(search && {
        OR: [
          { studentId: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { parentName: { contains: search, mode: 'insensitive' } },
          { parentContact: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      grade: true,
      subjects: { include: { subject: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getStudentById(id: string) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const detailFeeEnabled = isDetailedFeeEnabled()

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      grade: true,
      subjects: { include: { subject: true } },
      payments: {
        include: { subject: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      },
      monthlyFees: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { updatedAt: 'desc' }],
      },
      attendances: {
        include: { subject: true },
        orderBy: { date: 'desc' },
      },
    },
  })

  if (!student) return null

  const attendanceSummary = student.attendances.reduce<
    Record<string, { subject: string; present: number; absent: number; total: number }>
  >((acc, row) => {
    const key = row.subjectId
    if (!acc[key]) {
      acc[key] = { subject: row.subject.name, present: 0, absent: 0, total: 0 }
    }
    acc[key].total += 1
    if (row.status === 'PRESENT') acc[key].present += 1
    else acc[key].absent += 1
    return acc
  }, {})

  let pendingBalance = 0
  let feeStatus: FeeStatusRow[]
  let paymentHistory: PaymentHistoryRow[]
  const monthlyFees = student.monthlyFees.filter(
    (p) => isBillableFeeMonth(student.createdAt, p.month, p.year, now)
  )
  const payments = student.payments.filter(
    (p) => isBillableFeeMonth(student.createdAt, p.month, p.year, now)
  )

  if (!detailFeeEnabled && monthlyFees.length) {
    const currentMonthlyFee = monthlyFees.find((p) => p.month === month && p.year === year)
    const totalFee = student.subjects.reduce((sum, row) => sum + row.subject.fee, 0)

    pendingBalance = monthlyFees
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.balance, 0)

    feeStatus = student.subjects.map(({ subject }) => {
      const ratio = totalFee > 0 ? subject.fee / totalFee : 0
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        fee: subject.fee,
        amountDue: subject.fee,
        amountPaid: currentMonthlyFee ? Math.round(currentMonthlyFee.paidAmount * ratio) : 0,
        balance: currentMonthlyFee ? Math.round(currentMonthlyFee.balance * ratio) : subject.fee,
        status: currentMonthlyFee?.status ?? PaymentStatus.PENDING,
      }
    })

    paymentHistory = monthlyFees.map((p) => ({
      month: p.month,
      year: p.year,
      amountPaid: p.paidAmount,
      balance: p.balance,
      status: p.status,
      paidAt: p.paidAt?.toISOString() ?? null,
    }))
  } else {
    const monthlyPayments = payments.filter((p) => p.month === month && p.year === year)
    pendingBalance = payments
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.balance, 0)

    feeStatus = student.subjects.map(({ subject }) => {
      const payment = monthlyPayments.find((p) => p.subjectId === subject.id)
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        fee: subject.fee,
        amountDue: payment?.amountDue ?? subject.fee,
        amountPaid: payment?.amountPaid ?? 0,
        balance: payment?.balance ?? subject.fee,
        status: payment?.status ?? PaymentStatus.PENDING,
      }
    })

    const paymentsByMonth = payments.reduce<
      Record<string, { month: number; year: number; amountPaid: number; balance: number; status: string; paidAt?: string | null }>
    >((acc, p) => {
      const key = `${p.year}-${p.month}`
      if (!acc[key]) {
        acc[key] = { month: p.month, year: p.year, amountPaid: 0, balance: 0, status: 'PENDING', paidAt: p.paidAt?.toISOString() ?? null }
      }
      acc[key].amountPaid += p.amountPaid
      acc[key].balance += p.balance
      if (p.paidAt) acc[key].paidAt = p.paidAt.toISOString()
      return acc
    }, {})

    paymentHistory = Object.values(paymentsByMonth)
      .map((p) => ({
        ...p,
        status: p.balance === 0 && p.amountPaid > 0 ? 'PAID' : p.amountPaid > 0 ? 'PARTIAL' : 'PENDING',
      }))
  }

  paymentHistory.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)

  return {
    ...student,
    attendanceSummary: Object.values(attendanceSummary),
    feeStatus,
    pendingBalance,
    paymentHistory,
  }
}

export async function createStudent(data: StudentInput) {
  for (let attempt = 0; attempt < MAX_STUDENT_ID_ATTEMPTS; attempt++) {
    try {
      const studentId = await generateStudentId()

      return await prisma.student.create({
        data: {
          studentId,
          name: data.name,
          gradeId: data.gradeId,
          parentName: data.parentName,
          parentContact: data.parentContact,
          notes: data.notes,
          status: data.status ?? StudentStatus.ACTIVE,
          subjects: {
            create: data.subjectIds.map((subjectId) => ({ subjectId })),
          },
        },
        include: {
          grade: true,
          subjects: { include: { subject: true } },
        },
      })
    } catch (error) {
      if (isStudentIdCollision(error) && attempt < MAX_STUDENT_ID_ATTEMPTS - 1) {
        continue
      }

      throw error
    }
  }

  throw new Error('Failed to generate a unique student ID')
}

export async function updateStudent(id: string, data: StudentInput) {
  await prisma.studentSubject.deleteMany({ where: { studentId: id } })

  return prisma.student.update({
    where: { id },
    data: {
      name: data.name,
      gradeId: data.gradeId,
      parentName: data.parentName,
      parentContact: data.parentContact,
      notes: data.notes,
      status: data.status ?? StudentStatus.ACTIVE,
      subjects: {
        create: data.subjectIds.map((subjectId) => ({ subjectId })),
      },
    },
    include: {
      grade: true,
      subjects: { include: { subject: true } },
    },
  })
}

export async function deactivateStudent(id: string) {
  return prisma.student.update({
    where: { id },
    data: { status: StudentStatus.INACTIVE },
  })
}

export async function updateStudentStatus(id: string, status: StudentStatus) {
  return prisma.student.update({
    where: { id },
    data: { status },
  })
}
