import { NextRequest, NextResponse } from 'next/server'
import { isAuthUser, requireAuth } from '@/lib/api-auth'
import { getDashboardStats } from '@/lib/services/dashboard'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!isAuthUser(auth)) return auth

  const stats = await getDashboardStats(auth.role, auth.userId)
  return NextResponse.json(stats)
}
