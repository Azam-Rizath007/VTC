import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, signToken } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 })
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = comparePassword(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    })

    const response = NextResponse.json({
      token,
      user: { userId: user.id, email: user.email, role: user.role, name: user.name },
    })

    response.cookies.set('auth-token', token, {
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
      sameSite: 'lax',
    })

    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
