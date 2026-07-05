import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { getStudentFeePreview } from '@/lib/services/fees'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const studentId = req.nextUrl.searchParams.get('studentId')
  const month = Number(req.nextUrl.searchParams.get('month'))
  const year = Number(req.nextUrl.searchParams.get('year'))

  if (!studentId || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020) {
    return NextResponse.json({ error: 'studentId, month, and year required' }, { status: 400 })
  }

  const preview = await getStudentFeePreview(studentId, month, year)
  if (!preview) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  return NextResponse.json(preview)
}
