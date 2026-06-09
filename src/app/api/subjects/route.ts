import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { createSubject } from '@/lib/services/setup'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  gradeId: z.string().min(1),
  fee: z.number().int().min(0),
  monthlySessionTarget: z.number().int().min(1).max(31),
})

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const subject = await createSubject(parsed.data)
    return NextResponse.json({ subject }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 })
  }
}
