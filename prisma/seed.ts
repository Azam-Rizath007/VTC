import { PrismaClient, Role } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Institute
  await prisma.institute.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Bright Future Tuition Centre',
      contactDetails: '+92 300 0000000',
      currency: 'Rs.',
      defaultTeacherRate: 5000,
      defaultSessionCount: 12,
    },
  })

  // Users
  const hash = (p: string) => bcrypt.hashSync(p, 10)

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@school.com' },
    update: {},
    create: { name: 'Super Admin', email: 'superadmin@school.com', password: hash('admin123'), role: Role.SUPER_ADMIN },
  })

  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@school.com', password: hash('admin123'), role: Role.ADMIN },
  })

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@school.com' },
    update: {},
    create: { name: 'Ali Hassan', email: 'teacher@school.com', password: hash('teacher123'), role: Role.TEACHER },
  })

  // Grades
  const grade9 = await prisma.grade.upsert({ where: { name: 'Grade 9' }, update: {}, create: { name: 'Grade 9' } })
  const grade10 = await prisma.grade.upsert({ where: { name: 'Grade 10' }, update: {}, create: { name: 'Grade 10' } })

  // Subjects
  const maths = await prisma.subject.upsert({
    where: { name_gradeId: { name: 'Mathematics', gradeId: grade10.id } },
    update: {},
    create: { name: 'Mathematics', gradeId: grade10.id, fee: 3000, monthlySessionTarget: 10 },
  })
  const science = await prisma.subject.upsert({
    where: { name_gradeId: { name: 'Science', gradeId: grade10.id } },
    update: {},
    create: { name: 'Science', gradeId: grade10.id, fee: 3000, monthlySessionTarget: 10 },
  })
  const english = await prisma.subject.upsert({
    where: { name_gradeId: { name: 'English', gradeId: grade10.id } },
    update: {},
    create: { name: 'English', gradeId: grade10.id, fee: 2500, monthlySessionTarget: 12 },
  })

  // Teacher assignment
  await prisma.teacherAssignment.upsert({
    where: { userId_subjectId_gradeId: { userId: teacher.id, subjectId: maths.id, gradeId: grade10.id } },
    update: {},
    create: { userId: teacher.id, subjectId: maths.id, gradeId: grade10.id },
  })

  // Students
  const s1 = await prisma.student.upsert({
    where: { id: 'student-1' },
    update: {},
    create: { id: 'student-1', name: 'Ahmed Khan', gradeId: grade10.id, parentName: 'Imran Khan', parentContact: '0300-1234567' },
  })
  const s2 = await prisma.student.upsert({
    where: { id: 'student-2' },
    update: {},
    create: { id: 'student-2', name: 'Sara Ali', gradeId: grade10.id, parentName: 'Tariq Ali', parentContact: '0301-7654321' },
  })

  // Enroll students
  for (const sub of [maths, science, english]) {
    for (const st of [s1, s2]) {
      await prisma.studentSubject.upsert({
        where: { studentId_subjectId: { studentId: st.id, subjectId: sub.id } },
        update: {},
        create: { studentId: st.id, subjectId: sub.id },
      })
    }
  }

  console.log('✅ Seed complete')
  console.log('  superadmin@school.com / admin123')
  console.log('  admin@school.com      / admin123')
  console.log('  teacher@school.com    / teacher123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
