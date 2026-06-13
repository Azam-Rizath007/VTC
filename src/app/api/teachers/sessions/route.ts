import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const { searchParams } = req.nextUrl
  const teacherId = searchParams.get('teacherId')
  const subjectId = searchParams.get('subjectId')
  const gradeId = searchParams.get('gradeId')
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  if (!teacherId || !subjectId || !gradeId || !month || !year) {
    return NextResponse.json({ error: 'teacherId, subjectId, gradeId, month, year required' }, { status: 400 })
  }

  const sessions = await prisma.teacherSession.findMany({
    where: {
      teacherId,
      subjectId,
      gradeId,
      month: Number(month),
      year: Number(year),
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ sessions })
}
