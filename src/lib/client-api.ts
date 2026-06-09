import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'

export async function authFetch<T>(url: string, options?: RequestInit) {
  const token = useAuthStore.getState().token
  return apiFetch<T>(url, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
