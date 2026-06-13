import { prisma } from '@/lib/prisma'

export interface GradeInput {
  name: string
}

export interface SubjectInput {
  name: string
  gradeId: string
  fee: number
  monthlySessionTarget: number
}

export interface TeacherAssignmentInput {
  userId: string
  subjectId: string
  gradeId: string
  rate?: number
}

export async function listGradesWithSubjects() {
  return prisma.grade.findMany({
    include: {
      subjects: { orderBy: { name: 'asc' } },
      _count: { select: { students: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function createGrade(data: GradeInput) {
  return prisma.grade.create({ data })
}

export async function createSubject(data: SubjectInput) {
  return prisma.subject.create({ data })
}

export async function updateSubject(id: string, data: Partial<SubjectInput>) {
  return prisma.subject.update({ where: { id }, data })
}

export async function deleteSubject(id: string) {
  return prisma.subject.delete({ where: { id } })
}

export async function listTeachers() {
  return prisma.user.findMany({
    where: { role: 'TEACHER', isActive: true },
    include: {
      assignments: {
        include: { subject: true, grade: true },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function assignTeacher(data: TeacherAssignmentInput) {
  // If this exact assignment already exists, just return it (idempotent)
  const existing = await prisma.teacherAssignment.findFirst({
    where: { userId: data.userId, subjectId: data.subjectId, gradeId: data.gradeId },
  })
  if (existing) return existing

  // Rule: only one teacher per subject+grade combo
  const conflict = await prisma.teacherAssignment.findFirst({
    where: {
      subjectId: data.subjectId,
      gradeId: data.gradeId,
      userId: { not: data.userId },
      user: { isActive: true },
    },
  })
  if (conflict) {
    throw new Error('This subject is already assigned for this grade.')
  }

  return prisma.teacherAssignment.create({ data })
}

export async function updateAssignment(id: string, data: { rate?: number }) {
  return prisma.teacherAssignment.update({ where: { id }, data })
}

export async function removeAssignment(id: string) {
  return prisma.teacherAssignment.delete({ where: { id } })
}

export async function getInstituteSettings() {
  return prisma.institute.findFirst()
}

export async function updateInstituteSettings(data: {
  name?: string
  contactDetails?: string
  defaultTeacherRate?: number
  defaultSessionCount?: number
}) {
  const existing = await prisma.institute.findFirst()
  if (existing) {
    return prisma.institute.update({ where: { id: existing.id }, data })
  }
  return prisma.institute.create({ data: { name: 'School', ...data } })
}
