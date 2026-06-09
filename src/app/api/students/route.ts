import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { createStudent, listStudents } from '@/lib/services/students'
import { studentSchema } from '@/lib/validations/student'

const ALLOWED_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN]

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, ALLOWED_ROLES)
  if (!isAuthUser(auth)) return auth

  const { searchParams } = req.nextUrl
  const students = await listStudents({
    search: searchParams.get('search') || undefined,
    gradeId: searchParams.get('gradeId') || undefined,
    subjectId: searchParams.get('subjectId') || undefined,
    status: (searchParams.get('status') as 'ACTIVE' | 'INACTIVE') || undefined,
  })

  return NextResponse.json({ students })
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, ALLOWED_ROLES)
  if (!isAuthUser(auth)) return auth

  try {
    const body = await req.json()
    const parsed = studentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid data' }, { status: 400 })
    }

    const student = await createStudent(parsed.data)
    return NextResponse.json({ student }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}
