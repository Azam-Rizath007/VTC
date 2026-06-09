import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { createGrade } from '@/lib/services/setup'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ALLOWED_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEACHER]
const schema = z.object({ name: z.string().min(1, 'Grade name is required') })

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, ALLOWED_ROLES)
  if (!isAuthUser(auth)) return auth

  const grades = await prisma.grade.findMany({
    include: { subjects: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ grades })
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const grade = await createGrade(parsed.data)
    return NextResponse.json({ grade }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create grade' }, { status: 500 })
  }
}
