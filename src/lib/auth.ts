import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { Role } from '@/generated/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface JWTPayload {
  userId: string
  email: string
  role: Role
  name: string
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function canAccess(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole)
}
