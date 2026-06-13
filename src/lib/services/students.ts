import { prisma } from '@/lib/prisma'
import { PaymentStatus, StudentStatus } from '@/generated/prisma'

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

export async function listStudents(filters: StudentFilters = {}) {
  const { search, gradeId, subjectId, status } = filters

  return prisma.student.findMany({
    where: {
      ...(gradeId && { gradeId }),
      ...(status && { status }),
      ...(subjectId && { subjects: { some: { subjectId } } }),
      ...(search && {
        OR: [
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

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      grade: true,
      subjects: { include: { subject: true } },
      payments: {
        include: { subject: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
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

  const monthlyPayments = student.payments.filter((p) => p.month === month && p.year === year)
  const pendingBalance = student.payments
    .filter((p) => p.status !== PaymentStatus.PAID)
    .reduce((sum, p) => sum + p.balance, 0)

  const feeStatus = student.subjects.map(({ subject }) => {
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

  // Aggregate payments by month+year
  const paymentsByMonth = student.payments.reduce<
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

  const paymentHistory = Object.values(paymentsByMonth)
    .map((p) => ({
      ...p,
      status: p.balance === 0 && p.amountPaid > 0 ? 'PAID' : p.amountPaid > 0 ? 'PARTIAL' : 'PENDING',
    }))
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)

  return {
    ...student,
    attendanceSummary: Object.values(attendanceSummary),
    feeStatus,
    pendingBalance,
    paymentHistory,
  }
}

export async function createStudent(data: StudentInput) {
  return prisma.student.create({
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