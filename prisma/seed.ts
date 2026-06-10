import { PrismaClient, Role } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ✅ CHECK IF SEED ALREADY RUN
  const seedFlag = await prisma.systemConfig.findUnique({
    where: { key: 'seed_completed' },
  })

  if (seedFlag?.value === 'true') {
    console.log('⚠️ Seed already executed. Skipping...')
    return
  }

  const hash = (p: string) => bcrypt.hashSync(p, 10)

  // 🔐 ENV VALUES (IMPORTANT CHANGE)
  const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL!
  const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD!

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL!
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!

  const TEACHER_EMAIL = process.env.TEACHER_EMAIL!
  const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD!

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

  // Users (FROM ENV)
  await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {},
    create: {
      name: 'Super Admin',
      email: SUPERADMIN_EMAIL,
      password: hash(SUPERADMIN_PASSWORD),
      role: Role.SUPER_ADMIN,
    },
  })

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: 'Admin User',
      email: ADMIN_EMAIL,
      password: hash(ADMIN_PASSWORD),
      role: Role.ADMIN,
    },
  })

  const teacher = await prisma.user.upsert({
    where: { email: TEACHER_EMAIL },
    update: {},
    create: {
      name: 'Teacher',
      email: TEACHER_EMAIL,
      password: hash(TEACHER_PASSWORD),
      role: Role.TEACHER,
    },
  })

  // Grades
  const grade9 = await prisma.grade.upsert({
    where: { name: 'Grade 9' },
    update: {},
    create: { name: 'Grade 9' },
  })

  const grade10 = await prisma.grade.upsert({
    where: { name: 'Grade 10' },
    update: {},
    create: { name: 'Grade 10' },
  })

  // Subjects
  const maths = await prisma.subject.upsert({
    where: { name_gradeId: { name: 'Mathematics', gradeId: grade10.id } },
    update: {},
    create: {
      name: 'Mathematics',
      gradeId: grade10.id,
      fee: 3000,
      monthlySessionTarget: 10,
    },
  })

  const science = await prisma.subject.upsert({
    where: { name_gradeId: { name: 'Science', gradeId: grade10.id } },
    update: {},
    create: {
      name: 'Science',
      gradeId: grade10.id,
      fee: 3000,
      monthlySessionTarget: 10,
    },
  })

  const english = await prisma.subject.upsert({
    where: { name_gradeId: { name: 'English', gradeId: grade10.id } },
    update: {},
    create: {
      name: 'English',
      gradeId: grade10.id,
      fee: 2500,
      monthlySessionTarget: 12,
    },
  })

  // Teacher assignment
  await prisma.teacherAssignment.upsert({
    where: {
      userId_subjectId_gradeId: {
        userId: teacher.id,
        subjectId: maths.id,
        gradeId: grade10.id,
      },
    },
    update: {},
    create: {
      userId: teacher.id,
      subjectId: maths.id,
      gradeId: grade10.id,
    },
  })

  console.log('✅ Seed complete')
  console.log('SuperAdmin:', SUPERADMIN_EMAIL)
  console.log('Admin:', ADMIN_EMAIL)
  console.log('Teacher:', TEACHER_EMAIL)

  // ✅ MARK SEED AS COMPLETED
  await prisma.systemConfig.upsert({
    where: { key: 'seed_completed' },
    update: { value: 'true' },
    create: { key: 'seed_completed', value: 'true' },
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())