import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CreditCard,
  ClipboardList,
  UserCheck,
  BarChart3,
  Settings,
  LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: Role[]
  bottomNav?: boolean // show in mobile bottom nav
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'], bottomNav: true },
  { label: 'Students', href: '/students', icon: GraduationCap, roles: ['SUPER_ADMIN', 'ADMIN'], bottomNav: true },
  { label: 'Attendance', href: '/attendance', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'], bottomNav: true },
  { label: 'Fees', href: '/fees', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN'], bottomNav: true },
  { label: 'Grades & Subjects', href: '/setup', icon: BookOpen, roles: ['SUPER_ADMIN'] },
  { label: 'Teachers', href: '/teachers', icon: UserCheck, roles: ['SUPER_ADMIN'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN'] },
  { label: 'Users', href: '/users', icon: Users, roles: ['SUPER_ADMIN'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
]
