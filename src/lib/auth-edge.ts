import { jwtVerify } from 'jose'
import type { JWTPayload } from '@/lib/auth'

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-prod')
}

export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as JWTPayload['role'],
      name: payload.name as string,
    }
  } catch {
    return null
  }
}
