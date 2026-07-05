import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { listTeacherSalaries, markSalaryPaid, markSalaryPaidWithOverride } from '@/lib/services/teachers'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const month = req.nextUrl.searchParams.get('month')
  const year = req.nextUrl.searchParams.get('year')

  const salaries = await listTeacherSalaries(
    month ? Number(month) : undefined,
    year ? Number(year) : undefined
  )

  return NextResponse.json({ salaries })
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Salary id required' }, { status: 400 })

    const salary = auth.role === Role.SUPER_ADMIN
      ? await markSalaryPaidWithOverride(id)
      : await markSalaryPaid(id)
    return NextResponse.json({ salary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to mark salary paid'
    const status = message === 'Salary record not found' ? 404 : message === 'Required sessions are not completed' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
