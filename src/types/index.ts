export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER'

export interface AuthUser {
  userId: string
  email: string
  role: Role
  name: string
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}
