import { prisma } from '@/lib/prisma'
import { PaymentStatus, Role, StudentStatus } from '@/generated/prisma'
import bcrypt from 'bcryptjs'

export async function getDashboardStats(role: Role, userId?: string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalStudents, activeStudents, todayPayments, monthlyPayments, pendingPayments, todaySessions] =
    await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: StudentStatus.ACTIVE } }),
      prisma.feePayment.findMany({ where: { paidAt: { gte: todayStart } } }),
      prisma.feePayment.findMany({ where: { paidAt: { gte: monthStart } } }),
      prisma.feePayment.findMany({
        where: { status: { not: PaymentStatus.PAID } },
        include: { student: { include: { grade: true } }, subject: true },
      }),
      prisma.teacherSession.count({ where: { date: { gte: todayStart } } }),
    ])

  const todayCollection = todayPayments.reduce((s, p) => s + p.amountPaid, 0)
  const monthlyRevenue = monthlyPayments.reduce((s, p) => s + p.amountPaid, 0)

  const pendingStudentIds = new Set(pendingPayments.map((p) => p.studentId))

  const recentPayments = await prisma.feePayment.findMany({
    where: { paidAt: { not: null } },
    include: { student: true, subject: true },
    orderBy: { paidAt: 'desc' },
    take: 5,
  })

  const pendingStudents = pendingPayments.slice(0, 5).map((p) => ({
    name: p.student.name,
    grade: p.student.grade.name,
    amount: p.balance,
  }))

  const salaryAlerts = await prisma.teacherSalary.findMany({
    where: {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      completedSessions: { gte: 10 },
      status: 'PENDING',
    },
    include: { teacher: true, subject: true },
    take: 5,
  })

  let teacherData = null
  if (role === Role.TEACHER && userId) {
    const assignments = await prisma.teacherAssignment.findMany({
      where: { userId },
      include: { subject: true, grade: true },
    })

    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const sessionsConducted = await prisma.teacherSession.count({
      where: { teacherId: userId, month, year },
    })

    teacherData = {
      assignments: assignments.map((a) => ({
        grade: a.grade.name,
        subject: a.subject.name,
      })),
      sessionsConducted,
      pendingMarking: 0,
    }
  }

  const todayAttendance = await prisma.attendance.findMany({
    where: { date: { gte: todayStart } },
  })
  const absentToday = todayAttendance.filter((a) => a.status === 'ABSENT').length

  return {
    totalStudents,
    activeStudents,
    todayCollection,
    monthlyRevenue,
    pendingFees: pendingStudentIds.size,
    todayClasses: todaySessions,
    teacherSessionsCompleted: todaySessions,
    absentToday,
    recentPayments: recentPayments.map((p) => ({
      name: p.student.name,
      subject: p.subject.name,
      amount: p.amountPaid,
      time: p.paidAt?.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) ?? '',
    })),
    pendingStudents,
    salaryAlerts: salaryAlerts.map((s) => ({
      teacher: s.teacher.name,
      subject: s.subject.name,
      sessions: s.completedSessions,
      payable: s.totalPayable,
    })),
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
