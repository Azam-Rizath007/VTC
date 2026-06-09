import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  _hasHydrated: boolean
  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
  setHasHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      _hasHydrated: false,
      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null }),
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'school-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
