import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { assignTeacher, listTeachers, removeAssignment, updateAssignment } from '@/lib/services/setup'
import { z } from 'zod'

const assignSchema = z.object({
  userId: z.string().min(1),
  subjectId: z.string().min(1),
  gradeId: z.string().min(1),
  rate: z.number().int().min(0).default(0),
})

const updateSchema = z.object({
  id: z.string().min(1),
  rate: z.number().int().min(0),
})

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const teachers = await listTeachers()
  return NextResponse.json({ teachers })
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const assignment = await assignTeacher(parsed.data)
    return NextResponse.json({ assignment }, { status: 201 })
  } catch (err) {
    console.error('[assignments POST]', err)
    const message = err instanceof Error ? err.message : String(err)
    const isConflict = message.includes('already assigned')
    return NextResponse.json(
      { error: isConflict ? message : 'Failed to create assignment' },
      { status: isConflict ? 409 : 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    }
    const { id, ...data } = parsed.data
    const assignment = await updateAssignment(id, data)
    return NextResponse.json({ assignment })
  } catch {
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req, [Role.SUPER_ADMIN, Role.ADMIN])
  if (!isAuthUser(auth)) return auth

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Assignment id required' }, { status: 400 })

  await removeAssignment(id)
  return NextResponse.json({ message: 'Assignment removed' })
}
