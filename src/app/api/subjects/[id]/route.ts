import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { deleteSubject, updateSubject } from '@/lib/services/setup'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).optional(),
  fee: z.number().int().min(0).optional(),
  monthlySessionTarget: z.number().int().min(1).max(31).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const subject = await updateSubject(id, parsed.data)
    return NextResponse.json({ subject })
  } catch {
    return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = requireAuth(_req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const { id } = await params
    await deleteSubject(id)
    return NextResponse.json({ message: 'Subject deleted' })
  } catch {
    return NextResponse.json({ error: 'Failed to delete subject' }, { status: 500 })
  }
}
