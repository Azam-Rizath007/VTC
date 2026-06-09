import { NextRequest, NextResponse } from 'next/server'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/students/[id]/attendance
 * Query params:
 *   period = 'monthly' | 'quarterly' | 'yearly'
 *   month  = 1-12   (monthly only)
 *   quarter= 1|2|3  (quarterly — Q1=Jan-Apr, Q2=May-Aug, Q3=Sep-Dec)
 *   year   = YYYY
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req)
  if (!isAuthUser(auth)) return auth

  const { id } = await params
  const { searchParams } = req.nextUrl

  const period  = (searchParams.get('period') ?? 'monthly') as 'monthly' | 'quarterly' | 'yearly'
  const year    = Number(searchParams.get('year') ?? new Date().getFullYear())
  const month   = Number(searchParams.get('month') ?? new Date().getMonth() + 1)
  const quarter = Number(searchParams.get('quarter') ?? 1)

  // Determine date range
  let dateFrom: Date
  let dateTo: Date

  if (period === 'monthly') {
    dateFrom = new Date(year, month - 1, 1)
    dateTo   = new Date(year, month, 0, 23, 59, 59)
  } else if (period === 'quarterly') {
    // Q1=1-4, Q2=5-8, Q3=9-12
    const startMonth = (quarter - 1) * 4 + 1
    const endMonth   = Math.min(startMonth + 3, 12)
    dateFrom = new Date(year, startMonth - 1, 1)
    dateTo   = new Date(year, endMonth, 0, 23, 59, 59)
  } else {
    dateFrom = new Date(year, 0, 1)
    dateTo   = new Date(year, 11, 31, 23, 59, 59)
  }

  // Fetch student with enrolled subjects
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      grade: true,
      subjects: { include: { subject: true } },
    },
  })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  // Fetch all attendance in range
  const records = await prisma.attendance.findMany({
    where: {
      studentId: id,
      date: { gte: dateFrom, lte: dateTo },
    },
    include: { subject: true },
    orderBy: { date: 'asc' },
  })

  // Build per-subject summary
  const subjectMap: Record<string, {
    subjectId: string
    subjectName: string
    present: number
    absent: number
    total: number
    sessions: { date: string; sessionNumber: number; status: string }[]
  }> = {}

  for (const r of records) {
    if (!subjectMap[r.subjectId]) {
      subjectMap[r.subjectId] = {
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        present: 0,
        absent: 0,
        total: 0,
        sessions: [],
      }
    }
    const s = subjectMap[r.subjectId]
    s.total++
    if (r.status === 'PRESENT') s.present++
    else s.absent++
    s.sessions.push({
      date: r.date.toISOString(),
      sessionNumber: r.sessionNumber,
      status: r.status,
    })
  }

  // Include subjects with zero attendance too
  for (const { subject } of student.subjects) {
    if (!subjectMap[subject.id]) {
      subjectMap[subject.id] = {
        subjectId: subject.id,
        subjectName: subject.name,
        present: 0,
        absent: 0,
        total: 0,
        sessions: [],
      }
    }
  }

  const subjects = Object.values(subjectMap).map((s) => ({
    ...s,
    percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : null,
  }))

  const totalPresent = subjects.reduce((n, s) => n + s.present, 0)
  const totalSessions = subjects.reduce((n, s) => n + s.total, 0)
  const overallPercentage = totalSessions > 0
    ? Math.round((totalPresent / totalSessions) * 100)
    : null

  return NextResponse.json({
    student: { id: student.id, name: student.name, grade: student.grade.name,
               parentName: student.parentName, parentContact: student.parentContact },
    period,
    year,
    ...(period === 'monthly' && { month }),
    ...(period === 'quarterly' && { quarter }),
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    subjects,
    totalPresent,
    totalSessions,
    overallPercentage,
  })
}
