import { prisma } from '@/lib/prisma'
import { PaymentStatus, Prisma, StudentStatus } from '@/generated/prisma'
import { isBillableFeeMonth, isDetailedFeeEnabled } from '@/lib/services/fees'

const STUDENT_ID_PREFIX = 'VTC'
const STUDENT_ID_START = 1531
const MAX_STUDENT_ID_ATTEMPTS = 5

/**
 * Returns every (month, year) pair from the student's join month up to and
 * including the current month. Used to detect months with no fee row at all.
 */
function getAllEligibleMonths(joinedAt: Date, now: Date): { month: number; year: number }[] {
  const result: { month: number; year: number }[] = []
  const startMonth = joinedAt.getMonth() + 1
  const startYear = joinedAt.getFullYear()
  const endMonth = now.getMonth() + 1
  const endYear = now.getFullYear()

  let m = startMonth
  let y = startYear
  while (y < endYear || (y === endYear && m <= endMonth)) {
    result.push({ month: m, year: y })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

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

  // #5 — fetch attendance summary via groupBy instead of loading every row,
  // run in parallel with the student query
  const [student, attendanceGroups] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        grade: { include: { subjects: true } },
        subjects: { include: { subject: true } },
        payments: {
          include: { subject: true },
          orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
        },
        monthlyFees: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }, { updatedAt: 'desc' }],
        },
      },
    }),
    // One groupBy query → present/absent counts per subject, no row-level data needed
    prisma.attendance.groupBy({
      by: ['subjectId', 'status'],
      where: { studentId: id },
      _count: { id: true },
    }),
  ])

  if (!student) return null

  // Build the subject-name lookup from the student's enrolled subjects
  const subjectNameMap = new Map(student.subjects.map((s) => [s.subjectId, s.subject.name]))

  // Also fetch subject names for any subjectIds not covered by enrolled subjects
  // (e.g. subjects the student was removed from but still has attendance records)
  const knownSubjectIds = new Set(subjectNameMap.keys())
  const unknownSubjectIds = [...new Set(attendanceGroups.map((g) => g.subjectId))].filter(
    (sid) => !knownSubjectIds.has(sid)
  )
  if (unknownSubjectIds.length > 0) {
    const extraSubjects = await prisma.subject.findMany({
      where: { id: { in: unknownSubjectIds } },
      select: { id: true, name: true },
    })
    for (const s of extraSubjects) subjectNameMap.set(s.id, s.name)
  }

  // Aggregate groupBy rows into { present, absent, total } per subject
  const attendanceSummaryMap = new Map<string, { subject: string; present: number; absent: number; total: number }>()
  for (const g of attendanceGroups) {
    if (!attendanceSummaryMap.has(g.subjectId)) {
      attendanceSummaryMap.set(g.subjectId, {
        subject: subjectNameMap.get(g.subjectId) ?? g.subjectId,
        present: 0,
        absent: 0,
        total: 0,
      })
    }
    const entry = attendanceSummaryMap.get(g.subjectId)!
    const count = g._count.id
    entry.total += count
    if (g.status === 'PRESENT') entry.present += count
    else entry.absent += count
  }
  const attendanceSummary = [...attendanceSummaryMap.values()]

  let pendingBalance = 0
  let feeStatus: FeeStatusRow[]
  let paymentHistory: PaymentHistoryRow[]
  const monthlyFees = student.monthlyFees.filter(
    (p) => isBillableFeeMonth(student.createdAt, p.month, p.year, now)
  )
  const payments = student.payments.filter(
    (p) => isBillableFeeMonth(student.createdAt, p.month, p.year, now)
  )

  if (!detailFeeEnabled) {
    const currentMonthlyFee = monthlyFees.find((p) => p.month === month && p.year === year)
    // Use grade subjects (same basis as syncStudentMonthlyFee / StudentMonthlyFee.expectedAmount)
    const totalFee = student.grade.subjects.reduce((sum, sub) => sum + sub.fee, 0)

    // Sum unpaid balances from existing rows (covers partial payments and historical dues)
    const balanceFromRows = monthlyFees
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.balance, 0)

    // Find ALL eligible months with no row at all — these are fully unpaid
    const existingMonthKeys = new Set(monthlyFees.map((p) => `${p.year}-${p.month}`))
    const missingMonthsDue = getAllEligibleMonths(student.createdAt, now)
      .filter((m) => !existingMonthKeys.has(`${m.year}-${m.month}`))
      .reduce((sum) => sum + totalFee, 0)

    pendingBalance = balanceFromRows + missingMonthsDue

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
    const totalFee = student.subjects.reduce((sum, row) => sum + row.subject.fee, 0)

    // Sum unpaid balances from existing rows (covers partial payments and historical dues)
    const balanceFromRows = payments
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.balance, 0)

    // Find ALL eligible months with no payment row at all — these are fully unpaid
    const existingMonthKeys = new Set(payments.map((p) => `${p.year}-${p.month}`))
    const missingMonthsDue = getAllEligibleMonths(student.createdAt, now)
      .filter((m) => !existingMonthKeys.has(`${m.year}-${m.month}`))
      .reduce((sum) => sum + totalFee, 0)

    pendingBalance = balanceFromRows + missingMonthsDue

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

  // Inject missing months (no row at all) as PENDING entries so the frontend
  // can display them in the Pending Payments section.
  const existingKeys = new Set(paymentHistory.map((p) => `${p.year}-${p.month}`))
  const totalFeeForMissing = detailFeeEnabled
    ? student.subjects.reduce((sum, row) => sum + row.subject.fee, 0)
    : student.grade.subjects.reduce((sum, sub) => sum + sub.fee, 0)

  for (const { month: m, year: y } of getAllEligibleMonths(student.createdAt, now)) {
    if (!existingKeys.has(`${y}-${m}`)) {
      paymentHistory.push({
        month: m,
        year: y,
        amountPaid: 0,
        balance: totalFeeForMissing,
        status: 'PENDING',
        paidAt: null,
      })
    }
  }

  paymentHistory.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)

  return {
    ...student,
    attendanceSummary,
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
