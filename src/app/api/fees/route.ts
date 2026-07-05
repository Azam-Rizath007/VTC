import { NextRequest, NextResponse } from 'next/server'
import { PaymentStatus, Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { listPayments, recordBulkPayment } from '@/lib/services/fees'
import { z } from 'zod'

const bulkPaymentSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020),
  amountPaid: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  isFullPayment: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  if (status && !Object.values(PaymentStatus).includes(status as PaymentStatus)) {
    return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
  }

  const payments = await listPayments({
    search: searchParams.get('search') || undefined,
    month: searchParams.get('month') ? Number(searchParams.get('month')) : undefined,
    year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
    gradeId: searchParams.get('gradeId') || undefined,
    status: (status as PaymentStatus) || undefined,
  })

  return NextResponse.json({ payments })
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = bulkPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    const result = await recordBulkPayment(parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Failed to record payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
