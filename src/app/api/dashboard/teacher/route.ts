import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { getTeacherDashboard } from '@/lib/services/dashboard'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.TEACHER])
  if (!isAuthUser(auth)) return auth

  const month = req.nextUrl.searchParams.get('month')
  const year = req.nextUrl.searchParams.get('year')
  const now = new Date()

  const data = await getTeacherDashboard(
    auth.userId,
    month ? Number(month) : now.getMonth() + 1,
    year ? Number(year) : now.getFullYear()
  )
  return NextResponse.json(data)
}
