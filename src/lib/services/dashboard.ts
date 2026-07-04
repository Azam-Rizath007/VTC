import { prisma } from '@/lib/prisma'
import { PaymentStatus, Role, StudentStatus } from '@/generated/prisma'
import { isBillableFeeMonth, isDetailedFeeEnabled, isFeeMonthBeforeStudentJoined } from '@/lib/services/fees'
import bcrypt from 'bcryptjs'

export async function getDashboardStats(role: Role, userId?: string) {
  const now = new Date()

  // Sessions are stored with UTC-based dates (Date.UTC of the client's chosen date).
  // Use the UTC calendar date for "today" so the query matches what's in the DB.
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const todayEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const detailFeeEnabled = isDetailedFeeEnabled()

  async function loadTeacherData() {
    if (role !== Role.TEACHER || !userId) return null

    const assignments = await prisma.teacherAssignment.findMany({
      where: { userId },
      include: { subject: true, grade: true },
    })

    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const sessionsConducted = await prisma.teacherSession.count({
      where: { teacherId: userId, month, year },
    })

    return {
      assignments: assignments.map((a) => ({
        grade: a.grade.name,
        subject: a.subject.name,
      })),
      sessionsConducted,
      pendingMarking: 0,
    }
  }

  const [
    totalStudents,
    activeStudents,
    todaySessions,
    salaryAlerts,
    todayAttendance,
    teacherData,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: StudentStatus.ACTIVE } }),
    prisma.teacherSession.count({ where: { date: { gte: todayStart, lte: todayEnd } } }),
    prisma.teacherSalary.findMany({
      where: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        completedSessions: { gte: 10 },
        status: 'PENDING',
      },
      include: { teacher: true, subject: true },
      take: 5,
    }),
    prisma.attendance.findMany({ where: { date: { gte: todayStart, lte: todayEnd } } }),
    loadTeacherData(),
  ])

  const absentToday = todayAttendance.filter((a) => a.status === 'ABSENT').length
  const mappedSalaryAlerts = salaryAlerts.map((s) => ({
    teacher: s.teacher.name,
    subject: s.subject.name,
    sessions: s.completedSessions,
    payable: s.totalPayable,
  }))

  if (!detailFeeEnabled) {
    const [
      todayPayments,
      monthlyPayments,
      yearlyPayments,
      pendingPayments,
      recentRaw,
    ] = await Promise.all([
      prisma.studentMonthlyFee.findMany({
        where: { paidAt: { gte: todayStart } },
        include: { student: { include: { grade: true } } },
      }),
      prisma.studentMonthlyFee.findMany({
        where: { paidAt: { gte: monthStart } },
        include: { student: { include: { grade: true } } },
      }),
      prisma.studentMonthlyFee.findMany({
        where: {
          paidAt: {
            gte: yearStart,
            lt: yearEnd,
          },
        },
        include: { student: { include: { grade: true } } },
      }),
      prisma.studentMonthlyFee.findMany({
        where: { status: { not: PaymentStatus.PAID }, balance: { gt: 0 } },
        include: { student: { include: { grade: true } } },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      prisma.studentMonthlyFee.findMany({
        where: { paidAt: { gte: weekStart } },
        include: { student: { include: { grade: true } } },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
    ])
    const todayCollection = todayPayments
      .filter((p) => !isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year))
      .reduce((sum, p) => sum + p.paidAmount, 0)
    const monthlyRevenue = monthlyPayments
      .filter((p) => !isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year))
      .reduce((sum, p) => sum + p.paidAmount, 0)
    const yearlyRevenue = yearlyPayments
      .filter((p) => !isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year))
      .reduce((sum, p) => sum + p.paidAmount, 0)

    const pendingMap = new Map<string, { studentName: string; grade: string; month: number; year: number; balance: number }>()
    for (const p of pendingPayments) {
      if (!isBillableFeeMonth(p.student.createdAt, p.month, p.year, now)) continue
      const existing = pendingMap.get(p.studentId)
      if (existing) {
        existing.balance += p.balance
      } else {
        pendingMap.set(p.studentId, {
          studentName: p.student.name,
          grade: p.student.grade.name,
          month: p.month,
          year: p.year,
          balance: p.balance,
        })
      }
    }
    const pendingStudents = [...pendingMap.values()].slice(0, 10)

    return {
      totalStudents,
      activeStudents,
      todayCollection,
      monthlyRevenue,
      yearlyRevenue,
      pendingFees: pendingMap.size,
      todayClasses: todaySessions,
      teacherSessionsCompleted: todaySessions,
      absentToday,
      recentPayments: recentRaw
        .filter((p) => !isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year))
        .map((p) => ({
          studentName: p.student.name,
          grade: p.student.grade.name,
          month: p.month,
          year: p.year,
          amount: p.paidAmount,
          paidAt: p.paidAt!.toISOString(),
        })),
      pendingStudents,
      salaryAlerts: mappedSalaryAlerts,
      teacher: teacherData,
    }
  }

  const [
    todayPayments,
    monthlyPayments,
    yearlyPayments,
    pendingPayments,
    recentRaw,
  ] = await Promise.all([
    prisma.feePayment.findMany({
      where: { paidAt: { gte: todayStart } },
      include: { student: { include: { grade: true } } },
    }),
    prisma.feePayment.findMany({
      where: { paidAt: { gte: monthStart } },
      include: { student: { include: { grade: true } } },
    }),
    prisma.feePayment.findMany({
      where: {
        paidAt: {
          gte: yearStart,
          lt: yearEnd,
        },
      },
      include: { student: { include: { grade: true } } },
    }),
    prisma.feePayment.findMany({
      where: { status: { not: PaymentStatus.PAID }, balance: { gt: 0 } },
      include: { student: { include: { grade: true } }, subject: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    }),
    prisma.feePayment.findMany({
      where: { paidAt: { gte: weekStart } },
      include: { student: { include: { grade: true } } },
      orderBy: { paidAt: 'desc' },
    }),
  ])
  const todayCollection = todayPayments
    .filter((p) => !isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year))
    .reduce((sum, p) => sum + p.amountPaid, 0)
  const monthlyRevenue = monthlyPayments
    .filter((p) => !isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year))
    .reduce((sum, p) => sum + p.amountPaid, 0)
  const yearlyRevenue = yearlyPayments
    .filter((p) => !isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year))
    .reduce((sum, p) => sum + p.amountPaid, 0)

  const recentMap = new Map<string, { studentName: string; grade: string; month: number; year: number; amount: number; paidAt: Date }>()
  for (const p of recentRaw) {
    if (isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year)) continue
    const key = `${p.studentId}-${p.month}-${p.year}`
    if (!recentMap.has(key)) {
      recentMap.set(key, { studentName: p.student.name, grade: p.student.grade.name, month: p.month, year: p.year, amount: 0, paidAt: p.paidAt! })
    }
    recentMap.get(key)!.amount += p.amountPaid
    if (p.paidAt! > recentMap.get(key)!.paidAt) recentMap.get(key)!.paidAt = p.paidAt!
  }
  const recentPayments = [...recentMap.values()]
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 10)
    .map((p) => ({ ...p, paidAt: p.paidAt.toISOString() }))

  const overdueMap = new Map<string, { studentName: string; grade: string; month: number; year: number; balance: number }>()
  for (const p of pendingPayments) {
    if (!isBillableFeeMonth(p.student.createdAt, p.month, p.year, now)) continue
    const existing = overdueMap.get(p.studentId)
    if (existing) {
      existing.balance += p.balance
    } else {
      overdueMap.set(p.studentId, {
        studentName: p.student.name,
        grade: p.student.grade.name,
        month: p.month,
        year: p.year,
        balance: p.balance,
      })
    }
  }
  const pendingStudents = [...overdueMap.values()].slice(0, 10)

  return {
    totalStudents,
    activeStudents,
    todayCollection,
    monthlyRevenue,
    yearlyRevenue,
    pendingFees: overdueMap.size,
    todayClasses: todaySessions,
    teacherSessionsCompleted: todaySessions,
    absentToday,
    recentPayments,
    pendingStudents,
    salaryAlerts: mappedSalaryAlerts,
    teacher: teacherData,
  }
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      assignments: { include: { subject: true, grade: true } },
    },
  })
}

export async function createUser(data: {
  name: string
  email: string
  password: string
  role: Role
}) {
  return prisma.user.create({
    data: {
      ...data,
      password: bcrypt.hashSync(data.password, 10),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; email: string; password: string; role: Role; isActive: boolean }>
) {
  const payload: Record<string, unknown> = { ...data }
  if (data.password) payload.password = bcrypt.hashSync(data.password, 10)
  return prisma.user.update({
    where: { id },
    data: payload,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
}

export async function getTeacherDashboard(teacherId: string, month: number, year: number) {
  // All assignments for this teacher
  const assignments = await prisma.teacherAssignment.findMany({
    where: { userId: teacherId },
    include: { subject: true, grade: true },
  })

  // Per-subject session stats for the selected month
  const subjectStats = await Promise.all(
    assignments.map(async (a) => {
      const allocated = a.subject.monthlySessionTarget
      const completed = await prisma.teacherSession.count({
        where: { teacherId, subjectId: a.subjectId, month, year },
      })
      const pending = Math.max(0, allocated - completed)

      // Salary record for this month (contains totalPayable)
      const salary = await prisma.teacherSalary.findFirst({
        where: { teacherId, subjectId: a.subjectId, gradeId: a.gradeId, month, year },
      })

      return {
        grade: a.grade.name,
        subject: a.subject.name,
        allocated,
        completed,
        pending,
        rate: a.rate > 0 ? a.rate : (salary?.rate ?? 0),
        revenue: salary?.totalPayable ?? completed * (a.rate > 0 ? a.rate : (salary?.rate ?? 0)),
        salaryStatus: salary?.status ?? 'PENDING',
      }
    })
  )

  const totalAllocated = subjectStats.reduce((s, r) => s + r.allocated, 0)
  const totalCompleted = subjectStats.reduce((s, r) => s + r.completed, 0)
  const totalPending = subjectStats.reduce((s, r) => s + r.pending, 0)
  const totalRevenue = subjectStats.reduce((s, r) => s + r.revenue, 0)

  return {
    month,
    year,
    totalAllocated,
    totalCompleted,
    totalPending,
    totalRevenue,
    subjects: subjectStats,
  }
}
