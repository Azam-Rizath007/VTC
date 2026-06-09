import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { getPaymentById } from '@/lib/services/fees'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = requireAuth(_req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const { id } = await params
  const payment = await getPaymentById(id)
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  return NextResponse.json({ payment })
}
