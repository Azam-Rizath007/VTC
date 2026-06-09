import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { getInstituteSettings, updateInstituteSettings } from '@/lib/services/setup'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).optional(),
  contactDetails: z.string().optional(),
  defaultTeacherRate: z.number().int().min(0).optional(),
  defaultSessionCount: z.number().int().min(1).optional(),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const settings = await getInstituteSettings()
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const settings = await updateInstituteSettings(parsed.data)
    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
