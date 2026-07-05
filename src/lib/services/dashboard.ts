import { prisma } from '@/lib/prisma'
import { Role, StudentStatus } from '@/generated/prisma'
import {
  computePendingStudents,
  isDetailedFeeEnabled,
  isFeeMonthBeforeStudentJoined,
} from '@/lib/services/fees'
import bcrypt from 'bcryptjs'

// ─── getDashboardStats ────────────────────────────────────────────────────────

export async function getDashboardStats(role: Role, userId?: string) {
  const now = new Date()

  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const todayEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart  = new Date(now.getFullYear(), 0, 1)
  const yearEnd    = new Date(now.getFullYear() + 1, 0, 1)
  const weekStart  = new Date(todayStart)
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
      assignments: assignments.map((a) => ({ grade: a.grade.name, subject: a.subject.name })),
      sessionsConducted,
      pendingMarking: 0,
    }
  }

  const [
    totalStudents,
    activeStudents,
    todaySessions,
    salaryAlerts,
    absentTodayCount,
    teacherData,
    overdueMap,
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
    // #6 — count absent directly in DB instead of fetching all attendance rows
    prisma.attendance.count({ where: { date: { gte: todayStart, lte: todayEnd }, status: 'ABSENT' } }),
    loadTeacherData(),
    // #4 — compute pending via DB groupBy (no more full in-memory scan)
    computePendingStudents(now),
  ])

  const mappedSalaryAlerts = salaryAlerts.map((s) => ({
    teacher: s.teacher.name,
    subject: s.subject.name,
    sessions: s.completedSessions,
    payable: s.totalPayable,
  }))

  const overdueStudents = [...overdueMap.values()].slice(0, 10)
  const pendingFeeCount = overdueMap.size

  if (!detailFeeEnabled) {
    // #6 — use aggregate._sum for revenue numbers instead of fetching full rows
    const [
      todaySum,
      monthlySum,
      yearlySum,
      recentRaw,
    ] = await Promise.all([
      prisma.studentMonthlyFee.aggregate({
        where: { paidAt: { gte: todayStart } },
        _sum: { paidAmount: true },
      }),
      prisma.studentMonthlyFee.aggregate({
        where: { paidAt: { gte: monthStart } },
        _sum: { paidAmount: true },
      }),
      prisma.studentMonthlyFee.aggregate({
        where: { paidAt: { gte: yearStart, lt: yearEnd } },
        _sum: { paidAmount: true },
      }),
      // Recent payments still need student names — fetch only what we need
      prisma.studentMonthlyFee.findMany({
        where: { paidAt: { gte: weekStart } },
        select: {
          month: true,
          year: true,
          paidAmount: true,
          paidAt: true,
          student: { select: { name: true, createdAt: true, grade: { select: { name: true } } } },
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
    ])

    return {
      totalStudents,
      activeStudents,
      todayCollection: todaySum._sum.paidAmount ?? 0,
      monthlyRevenue:  monthlySum._sum.paidAmount ?? 0,
      yearlyRevenue:   yearlySum._sum.paidAmount ?? 0,
      pendingFees: pendingFeeCount,
      todayClasses: todaySessions,
      teacherSessionsCompleted: todaySessions,
      absentToday: absentTodayCount,
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
      pendingStudents: overdueStudents,
      salaryAlerts: mappedSalaryAlerts,
      teacher: teacherData,
    }
  }

  // detailFee mode
  const [
    todaySum,
    monthlySum,
    yearlySum,
    recentRaw,
  ] = await Promise.all([
    // #6 — aggregate sums instead of full row fetches
    prisma.feePayment.aggregate({
      where: { paidAt: { gte: todayStart } },
      _sum: { amountPaid: true },
    }),
    prisma.feePayment.aggregate({
      where: { paidAt: { gte: monthStart } },
      _sum: { amountPaid: true },
    }),
    prisma.feePayment.aggregate({
      where: { paidAt: { gte: yearStart, lt: yearEnd } },
      _sum: { amountPaid: true },
    }),
    prisma.feePayment.findMany({
      where: { paidAt: { gte: weekStart } },
      select: {
        studentId: true,
        month: true,
        year: true,
        amountPaid: true,
        paidAt: true,
        student: { select: { name: true, createdAt: true, grade: { select: { name: true } } } },
      },
      orderBy: { paidAt: 'desc' },
    }),
  ])

  const recentMap = new Map<string, {
    studentName: string; grade: string; month: number; year: number; amount: number; paidAt: Date
  }>()
  for (const p of recentRaw) {
    if (isFeeMonthBeforeStudentJoined(p.student.createdAt, p.month, p.year)) continue
    const key = `${p.studentId}-${p.month}-${p.year}`
    if (!recentMap.has(key)) {
      recentMap.set(key, {
        studentName: p.student.name,
        grade: p.student.grade.name,
        month: p.month,
        year: p.year,
        amount: 0,
        paidAt: p.paidAt!,
      })
    }
    recentMap.get(key)!.amount += p.amountPaid
    if (p.paidAt! > recentMap.get(key)!.paidAt) recentMap.get(key)!.paidAt = p.paidAt!
  }
  const recentPayments = [...recentMap.values()]
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 10)
    .map((p) => ({ ...p, paidAt: p.paidAt.toISOString() }))

  return {
    totalStudents,
    activeStudents,
    todayCollection: todaySum._sum.amountPaid ?? 0,
    monthlyRevenue:  monthlySum._sum.amountPaid ?? 0,
    yearlyRevenue:   yearlySum._sum.amountPaid ?? 0,
    pendingFees: pendingFeeCount,
    todayClasses: todaySessions,
    teacherSessionsCompleted: todaySessions,
    absentToday: absentTodayCount,
    recentPayments,
    pendingStudents: overdueStudents,
    salaryAlerts: mappedSalaryAlerts,
    teacher: teacherData,
  }
}

// ─── listUsers / createUser / updateUser ─────────────────────────────────────

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

// ─── #1  getTeacherDashboard — batch queries instead of N+1 ──────────────────

export async function getTeacherDashboard(teacherId: string, month: number, year: number) {
  // Fetch assignments, session counts, and salary records in 3 queries (not 2N)
  const [assignments, sessionGroups, salaries] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: { userId: teacherId },
      include: { subject: true, grade: true },
    }),
    // One groupBy to count sessions per subject for this teacher/month/year
    prisma.teacherSession.groupBy({
      by: ['subjectId'],
      where: { teacherId, month, year },
      _count: { id: true },
    }),
    // One query for all salary rows for this teacher/month/year
    prisma.teacherSalary.findMany({
      where: { teacherId, month, year },
    }),
  ])

  // Build lookup maps so we don't re-scan arrays in the loop
  const sessionCountMap = new Map(sessionGroups.map((g) => [g.subjectId, g._count.id]))
  const salaryMap = new Map(salaries.map((s) => [s.subjectId, s]))

  const subjectStats = assignments.map((a) => {
    const allocated = a.subject.monthlySessionTarget
    const completed = sessionCountMap.get(a.subjectId) ?? 0
    const pending   = Math.max(0, allocated - completed)
    const salary    = salaryMap.get(a.subjectId)
    const rate      = a.rate > 0 ? a.rate : (salary?.rate ?? 0)
    const revenue   = salary?.totalPayable ?? completed * rate

    return {
      grade: a.grade.name,
      subject: a.subject.name,
      allocated,
      completed,
      pending,
      rate,
      revenue,
      salaryStatus: salary?.status ?? 'PENDING',
    }
  })

  const totalAllocated = subjectStats.reduce((s, r) => s + r.allocated, 0)
  const totalCompleted = subjectStats.reduce((s, r) => s + r.completed, 0)
  const totalPending   = subjectStats.reduce((s, r) => s + r.pending, 0)
  const totalRevenue   = subjectStats.reduce((s, r) => s + r.revenue, 0)

  return { month, year, totalAllocated, totalCompleted, totalPending, totalRevenue, subjects: subjectStats }
}
