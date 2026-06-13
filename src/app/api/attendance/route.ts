import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import {
  assertAttendanceAccess,
  getAttendanceForSession,
  getAllGradeSubjectPairs,
  getMonthlySessionProgress,
  getNextSessionNumber,
  getStudentsForAttendance,
  getTeacherAssignments,
  listAttendanceSummary,
  saveAttendance,
} from '@/lib/services/attendance'
import { z } from 'zod'

const recordSchema = z.object({
  gradeId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string(),
  sessionNumber: z.number().int().min(1),
  remarks: z.string().optional(),
  records: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(['PRESENT', 'ABSENT']),
    })
  ),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER])
  if (!isAuthUser(auth)) return auth

  const { searchParams } = req.nextUrl
  const action = searchParams.get('action')

  if (action === 'assignments') {
    if (auth.role === Role.SUPER_ADMIN || auth.role === Role.ADMIN) {
      const assignments = await getAllGradeSubjectPairs()
      return NextResponse.json({ assignments })
    }
    const assignments = await getTeacherAssignments(auth.userId)
    return NextResponse.json({ assignments })
  }

  if (action === 'nextsession') {
    const subjectId = searchParams.get('subjectId')
    const gradeId = searchParams.get('gradeId')
    const date = searchParams.get('date')
    if (!subjectId || !gradeId || !date) {
      return NextResponse.json({ error: 'subjectId, gradeId, and date required' }, { status: 400 })
    }
    // For admins, look up the assigned teacher for this subject+grade
    let teacherId = auth.userId
    if (auth.role !== Role.TEACHER) {
      const { prisma } = await import('@/lib/prisma')
      const assignment = await prisma.teacherAssignment.findFirst({ where: { subjectId, gradeId } })
      if (assignment) teacherId = assignment.userId
    }
    const result = await getNextSessionNumber(subjectId, gradeId, teacherId, new Date(date))
    return NextResponse.json(result)
  }

  if (action === 'students') {
    const gradeId = searchParams.get('gradeId')
    const subjectId = searchParams.get('subjectId')
    const date = searchParams.get('date')
    const sessionNumber = Number(searchParams.get('sessionNumber'))

    if (!gradeId || !subjectId || !date) {
      return NextResponse.json({ error: 'gradeId, subjectId, and date required' }, { status: 400 })
    }

    const allowed = await assertAttendanceAccess(auth.userId, auth.role, subjectId, gradeId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const students = await getStudentsForAttendance(gradeId, subjectId)
    const existing = sessionNumber
      ? await getAttendanceForSession(subjectId, new Date(date), sessionNumber)
      : []

    const progress = await getMonthlySessionProgress(
      subjectId,
      new Date(date).getMonth() + 1,
      new Date(date).getFullYear()
    )

    return NextResponse.json({ students, existing, progress })
  }

  const summary = await listAttendanceSummary({
    gradeId: searchParams.get('gradeId') || undefined,
    subjectId: searchParams.get('subjectId') || undefined,
    month: searchParams.get('month') ? Number(searchParams.get('month')) : undefined,
    year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
    studentId: searchParams.get('studentId') || undefined,
  })

  return NextResponse.json({ attendance: summary })
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = recordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    const { gradeId, subjectId, date, sessionNumber, remarks, records } = parsed.data

    const allowed = await assertAttendanceAccess(auth.userId, auth.role, subjectId, gradeId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const isTeacher = auth.role === Role.TEACHER
    const now = new Date()
    const [year, month, day] = date.split('-').map(Number)

    const sessionDate = new Date(year, month - 1, day)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (sessionDate > today) {
      return NextResponse.json({ error: 'Cannot record attendance for a future date.' }, { status: 400 })
    }

    const sessionDateTime = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())

    // For admin saves, look up the assigned teacher for this subject+grade.
    // Admin's userId must not be stored as teacherId — it would corrupt session/salary tracking.
    let teacherId = auth.userId
    if (!isTeacher) {
      const { prisma } = await import('@/lib/prisma')
      const assignment = await prisma.teacherAssignment.findFirst({ where: { subjectId, gradeId } })
      if (assignment) teacherId = assignment.userId
    }

    const attendanceRecords = records.map((r) => ({
      studentId: r.studentId,
      subjectId,
      teacherId,
      date: sessionDateTime,
      sessionNumber,
      status: r.status as 'PRESENT' | 'ABSENT',
      remarks,
    }))

    const saved = await saveAttendance(attendanceRecords, isTeacher)
    return NextResponse.json({ saved: saved.length })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Failed to save attendance'
    const isCap = message.includes('Session limit')
    return NextResponse.json({ error: message }, { status: isCap ? 403 : 500 })
  }
}
