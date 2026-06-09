import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  return NextResponse.json({ user: payload })
}
