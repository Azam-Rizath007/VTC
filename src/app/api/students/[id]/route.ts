import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { deactivateStudent, getStudentById, updateStudent } from '@/lib/services/students'
import { studentSchema } from '@/lib/validations/student'

const ALLOWED_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN]

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = requireAuth(_req, ALLOWED_ROLES)
  if (!isAuthUser(auth)) return auth

  const { id } = await params
  const student = await getStudentById(id)
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  return NextResponse.json({ student })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, ALLOWED_ROLES)
  if (!isAuthUser(auth)) return auth

  try {
    const { id } = await params
    const body = await req.json()
    const parsed = studentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid data' }, { status: 400 })
    }

    const student = await updateStudent(id, parsed.data)
    return NextResponse.json({ student })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, ALLOWED_ROLES)
  if (!isAuthUser(auth)) return auth

  try {
    const { id } = await params
    await deactivateStudent(id)
    return NextResponse.json({ message: 'Student deactivated' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to deactivate student' }, { status: 500 })
  }
}
