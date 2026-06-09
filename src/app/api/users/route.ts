import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { createUser, listUsers, updateUser } from '@/lib/services/dashboard'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER']),
})

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER']).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  // ADMIN can only list teachers; SUPER_ADMIN sees everyone
  const users = await listUsers()
  const filtered =
    auth.role === Role.ADMIN ? users.filter((u) => u.role === Role.TEACHER) : users
  return NextResponse.json({ users: filtered })
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    // ADMIN can only create TEACHER accounts
    if (auth.role === Role.ADMIN && parsed.data.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Admins can only create teacher accounts' }, { status: 403 })
    }

    const user = await createUser(parsed.data)
    return NextResponse.json({ user }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create user — email may already exist' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 })
    const parsed = updateSchema.safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    // ADMIN can only edit teachers and cannot change role
    if (auth.role === Role.ADMIN) {
      const users = await listUsers()
      const target = users.find((u) => u.id === id)
      if (!target || target.role !== Role.TEACHER) {
        return NextResponse.json({ error: 'Admins can only edit teacher accounts' }, { status: 403 })
      }
      delete parsed.data.role // prevent role escalation
    }

    const user = await updateUser(id, parsed.data)
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
