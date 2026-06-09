import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/generated/prisma'
import { JWTPayload, verifyToken } from '@/lib/auth'

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return req.cookies.get('auth-token')?.value ?? null
}

export function getAuthUser(req: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function requireAuth(req: NextRequest, roles?: Role[]): JWTPayload | NextResponse {
  const user = getAuthUser(req)
  if (!user) return unauthorized()
  if (roles && !roles.includes(user.role)) return forbidden()
  return user
}

export function isAuthUser(result: JWTPayload | NextResponse): result is JWTPayload {
  return !(result instanceof NextResponse)
}
