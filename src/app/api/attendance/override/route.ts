import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { grantExtraSession } from '@/lib/services/attendance'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const { subjectId, gradeId, month, year } = await req.json()
  if (!subjectId || !gradeId || !month || !year) {
    return NextResponse.json({ error: 'subjectId, gradeId, month, year required' }, { status: 400 })
  }

  const override = await grantExtraSession(subjectId, gradeId, Number(month), Number(year), auth.userId)
  return NextResponse.json({ override })
}
