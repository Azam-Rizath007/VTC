import { prisma } from '@/lib/prisma'
import { SalaryStatus } from '@/generated/prisma'

export async function listTeacherSalaries(month?: number, year?: number) {
  const now = new Date()
  const m = month ?? now.getMonth() + 1
  const y = year ?? now.getFullYear()

  return prisma.teacherSalary.findMany({
    where: { month: m, year: y },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      subject: true,
      grade: true,
    },
    orderBy: { teacher: { name: 'asc' } },
  })
}

export async function getTeacherSalaryAlerts() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const salaries = await prisma.teacherSalary.findMany({
    where: { month, year, status: SalaryStatus.PENDING },
    include: {
      teacher: { select: { name: true } },
      subject: true,
      grade: true,
    },
  })

  return salaries.filter((s) => s.completedSessions >= s.requiredSessions)
}

export async function markSalaryPaid(id: string) {
  return prisma.teacherSalary.update({
    where: { id },
    data: { status: SalaryStatus.PAID },
  })
}

export async function getTeacherSessions(teacherId: string, month?: number, year?: number) {
  const now = new Date()
  const m = month ?? now.getMonth() + 1
  const y = year ?? now.getFullYear()

  return prisma.teacherSession.findMany({
    where: { teacherId, month: m, year: y },
    include: { subject: true, grade: true },
    orderBy: { date: 'desc' },
  })
}
