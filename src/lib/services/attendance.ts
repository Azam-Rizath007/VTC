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
): Promise<{ nextSession: number; todaySessions: number[] }> {
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

  // Next session = month-wide TeacherSession count + 1
  // This gives the correct sequential number regardless of which day the teacher opens the app
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const monthSessionCount = await prisma.teacherSession.count({
    where: { teacherId, subjectId, month, year },
  })
  const nextSession = monthSessionCount + 1

  return { nextSession, todaySessions }
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

  const results = []
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
      if (target > 0) {
        const month = first.date.getMonth() + 1
        const year = first.date.getFullYear()
        const completed = await prisma.teacherSession.count({
          where: { teacherId: first.teacherId, subjectId: first.subjectId, month, year },
        })
        if (completed >= target) {
          throw new Error(`Session limit reached. This subject allows ${target} sessions per month and ${completed} have already been recorded.`)
        }
      }
    }
  }

  for (const record of records) {
    // Upsert per student+subject+sessionNumber within the same calendar day
    const existing = await prisma.attendance.findFirst({
      where: {
        studentId: record.studentId,
        subjectId: record.subjectId,
        sessionNumber: record.sessionNumber,
        date: { gte: dayStart, lte: dayEnd },
      },
    })

    if (existing) {
      results.push(
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: record.status,
            teacherId: record.teacherId,
            ...(record.remarks !== undefined && { remarks: record.remarks }),
          },
        })
      )
    } else {
      results.push(
        await prisma.attendance.create({
          data: {
            studentId: record.studentId,
            subjectId: record.subjectId,
            teacherId: record.teacherId,
            date: record.date,
            sessionNumber: record.sessionNumber,
            status: record.status,
            remarks: record.remarks ?? null,
          },
        })
      )
    }
  }

  // TeacherSession tracking and salary — teachers only
  // Admins updating attendance must not affect session counts or salary
  if (isTeacher) {
    const subject = await prisma.subject.findUnique({
      where: { id: first.subjectId },
      include: { grade: true },
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
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } })
  const requiredSessions = subject?.monthlySessionTarget ?? 12

  // Use the rate from the teacher's assignment for this subject+grade
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { userId: teacherId, subjectId, gradeId },
  })
  const institute = await prisma.institute.findFirst()
  const rate = assignment?.rate && assignment.rate > 0
    ? assignment.rate
    : (institute?.defaultTeacherRate ?? 5000)

  const completedSessions = await prisma.teacherSession.count({
    where: { teacherId, subjectId, month, year },
  })

  const existing = await prisma.teacherSalary.findFirst({
    where: { teacherId, subjectId, gradeId, month, year },
  })

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
