import { prisma } from '@/lib/prisma'
import { AttendanceStatus, Role } from '@/generated/prisma'

export interface AttendanceInput {
  studentId: string
  subjectId: string
  teacherId: string
  /** Exact datetime for this session — includes time component */
  date: Date
  sessionNumber: number
  status: AttendanceStatus
  remarks?: string
}

export interface AttendanceFilters {
  gradeId?: string
  subjectId?: string
  teacherId?: string
  month?: number
  year?: number
  studentId?: string
}

export async function getTeacherAssignments(teacherId: string) {
  return prisma.teacherAssignment.findMany({
    where: { userId: teacherId },
    include: { subject: true, grade: true },
  })
}

export async function getAllGradeSubjectPairs() {
  const grades = await prisma.grade.findMany({
    include: { subjects: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  // Flatten into the same shape as TeacherAssignment includes
  return grades.flatMap((g) =>
    g.subjects.map((s) => ({
      gradeId: g.id,
      subjectId: s.id,
      grade: { id: g.id, name: g.name },
      subject: { id: s.id, name: s.name, monthlySessionTarget: s.monthlySessionTarget },
    }))
  )
}

export async function getStudentsForAttendance(gradeId: string, subjectId: string) {
  return prisma.student.findMany({
    where: {
      gradeId,
      status: 'ACTIVE',
      subjects: { some: { subjectId } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getEffectiveCap(subjectId: string, gradeId: string, month: number, year: number): Promise<number> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
  const base = subject?.monthlySessionTarget ?? 0
  const override = await prisma.sessionOverride.findUnique({
    where: { subjectId_gradeId_month_year: { subjectId, gradeId, month, year } },
  })
  return base + (override?.extraSessions ?? 0)
}

export async function grantExtraSession(
  subjectId: string,
  gradeId: string,
  month: number,
  year: number,
  adminUserId: string
) {
  return prisma.sessionOverride.upsert({
    where: { subjectId_gradeId_month_year: { subjectId, gradeId, month, year } },
    update: { extraSessions: { increment: 1 }, grantedBy: adminUserId },
    create: { subjectId, gradeId, month, year, extraSessions: 1, grantedBy: adminUserId },
  })
}


/**
 * Returns sessions recorded on a specific date AND the next session number
 * based on the month-wide count (not just today), so teachers always get
 * the correct sequential number across multiple days.
 */
export async function getNextSessionNumber(
  subjectId: string,
  gradeId: string,
  teacherId: string,
  date: Date
): Promise<{ nextSession: number; todaySessions: number[]; effectiveCap: number }> {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  // Sessions recorded on the selected date (for the session picker buttons)
  const todayRecords = await prisma.attendance.findMany({
    where: {
      subjectId,
      date: { gte: dayStart, lte: dayEnd },
    },
    select: { sessionNumber: true },
    distinct: ['sessionNumber'],
    orderBy: { sessionNumber: 'asc' },
  })
  const todaySessions = todayRecords.map((r) => r.sessionNumber)

  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const monthSessionCount = await prisma.teacherSession.count({
    where: { teacherId, subjectId, month, year },
  })
  const nextSession = monthSessionCount + 1
  const effectiveCap = await getEffectiveCap(subjectId, gradeId, month, year)

  return { nextSession, todaySessions, effectiveCap }
}
export async function getAttendanceForSession(
  subjectId: string,
  date: Date,
  sessionNumber: number
) {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  return prisma.attendance.findMany({
    where: {
      subjectId,
      sessionNumber,
      date: { gte: dayStart, lte: dayEnd },
    },
  })
}

/**
 * Saves attendance records for a session.
 * - For teachers: enforces monthly cap, creates TeacherSession, updates salary.
 * - For admins/super_admins: only updates the attendance records — no session tracking or salary impact.
 */
export async function saveAttendance(records: AttendanceInput[], isTeacher = true) {
  if (records.length === 0) return []

  const first = records[0]

  const dayStart = new Date(first.date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(first.date)
  dayEnd.setHours(23, 59, 59, 999)

  // Cap enforcement — teachers only
  if (isTeacher) {
    const isExistingSession = await prisma.attendance.findFirst({
      where: {
        subjectId: first.subjectId,
        sessionNumber: first.sessionNumber,
        date: { gte: dayStart, lte: dayEnd },
      },
    })

    if (!isExistingSession) {
      const subject = await prisma.subject.findUnique({ where: { id: first.subjectId } })
      const target = subject?.monthlySessionTarget ?? 0
      if (target > 0 && subject) {
        const month = first.date.getMonth() + 1
        const year = first.date.getFullYear()
        const effectiveCap = await getEffectiveCap(first.subjectId, subject.gradeId, month, year)
        const completed = await prisma.teacherSession.count({
          where: { teacherId: first.teacherId, subjectId: first.subjectId, month, year },
        })
        if (completed >= effectiveCap) {
          throw new Error(`Session limit reached. This subject allows ${effectiveCap} sessions per month and ${completed} have already been recorded.`)
        }
      }
    }
  }

  // #2 — batch: one findMany to fetch all existing records for this session/day,
  // then split into updates vs creates and run them in a transaction.
  const studentIds = records.map((r) => r.studentId)

  const existingRecords = await prisma.attendance.findMany({
    where: {
      subjectId: first.subjectId,
      sessionNumber: first.sessionNumber,
      studentId: { in: studentIds },
      date: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true, studentId: true },
  })
  const existingMap = new Map(existingRecords.map((r) => [r.studentId, r.id]))

  const toUpdate = records.filter((r) => existingMap.has(r.studentId))
  const toCreate = records.filter((r) => !existingMap.has(r.studentId))

  const results = await prisma.$transaction([
    ...toUpdate.map((r) =>
      prisma.attendance.update({
        where: { id: existingMap.get(r.studentId)! },
        data: {
          status: r.status,
          teacherId: r.teacherId,
          ...(r.remarks !== undefined && { remarks: r.remarks }),
        },
      })
    ),
    ...toCreate.map((r) =>
      prisma.attendance.create({
        data: {
          studentId: r.studentId,
          subjectId: r.subjectId,
          teacherId: r.teacherId,
          date: r.date,
          sessionNumber: r.sessionNumber,
          status: r.status,
          remarks: r.remarks ?? null,
        },
      })
    ),
  ])

  // TeacherSession tracking and salary — teachers only
  if (isTeacher) {
    const subject = await prisma.subject.findUnique({
      where: { id: first.subjectId },
    })

    if (subject) {
      const month = first.date.getMonth() + 1
      const year = first.date.getFullYear()

      const sessionsThisDay = await prisma.teacherSession.count({
        where: {
          teacherId: first.teacherId,
          subjectId: first.subjectId,
          gradeId: subject.gradeId,
          date: { gte: dayStart, lte: dayEnd },
        },
      })

      if (first.sessionNumber > sessionsThisDay) {
        await prisma.teacherSession.create({
          data: {
            teacherId: first.teacherId,
            subjectId: first.subjectId,
            gradeId: subject.gradeId,
            date: first.date,
            month,
            year,
          },
        })
      }

      await upsertTeacherSalary(first.teacherId, first.subjectId, subject.gradeId, month, year)
    }
  }

  return results
}

async function upsertTeacherSalary(
  teacherId: string,
  subjectId: string,
  gradeId: string,
  month: number,
  year: number
) {
  // Batch: fetch subject, assignment, institute, session count, and existing salary in parallel
  const [subject, assignment, institute, completedSessions, existing] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subjectId }, select: { monthlySessionTarget: true } }),
    prisma.teacherAssignment.findFirst({
      where: { userId: teacherId, subjectId, gradeId },
      select: { rate: true },
    }),
    prisma.institute.findFirst({ select: { defaultTeacherRate: true } }),
    prisma.teacherSession.count({ where: { teacherId, subjectId, month, year } }),
    prisma.teacherSalary.findFirst({ where: { teacherId, subjectId, gradeId, month, year } }),
  ])

  const requiredSessions = subject?.monthlySessionTarget ?? 12
  const rate = assignment?.rate && assignment.rate > 0
    ? assignment.rate
    : (institute?.defaultTeacherRate ?? 5000)

  const data = {
    completedSessions,
    requiredSessions,
    rate,
    totalPayable: completedSessions * rate,
  }

  if (existing) {
    await prisma.teacherSalary.update({ where: { id: existing.id }, data })
  } else {
    await prisma.teacherSalary.create({
      data: { teacherId, subjectId, gradeId, month, year, ...data },
    })
  }
}

export async function getMonthlySessionProgress(subjectId: string, month: number, year: number) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
  if (!subject) return null

  const dayStart = new Date(year, month - 1, 1)
  const dayEnd = new Date(year, month, 0, 23, 59, 59)

  const sessionsConducted = await prisma.teacherSession.count({
    where: { subjectId, date: { gte: dayStart, lte: dayEnd } },
  })

  const target = subject.monthlySessionTarget
  let progress: 'completed' | 'pending' | 'exceeded' = 'pending'
  if (sessionsConducted >= target) progress = sessionsConducted > target ? 'exceeded' : 'completed'

  return { target, sessionsConducted, progress }
}

export async function listAttendanceSummary(filters: AttendanceFilters) {
  const { gradeId, subjectId, month, year, studentId } = filters

  const dateFilter =
    month && year
      ? {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0, 23, 59, 59),
        }
      : undefined

  return prisma.attendance.findMany({
    where: {
      ...(subjectId && { subjectId }),
      ...(studentId && { studentId }),
      ...(dateFilter && { date: dateFilter }),
      ...(gradeId && { student: { gradeId } }),
    },
    include: {
      student: { include: { grade: true } },
      subject: true,
      teacher: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })
}

export async function canTeacherAccessSubject(
  teacherId: string,
  subjectId: string,
  gradeId: string
) {
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { userId: teacherId, subjectId, gradeId },
  })
  return !!assignment
}

export async function assertAttendanceAccess(
  userId: string,
  role: Role,
  subjectId: string,
  gradeId: string
) {
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN) return true
  return canTeacherAccessSubject(userId, subjectId, gradeId)
}
