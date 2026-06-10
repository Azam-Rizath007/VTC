import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

let prisma: PrismaClient

function createPrismaClient() {
  const url = process.env.DATABASE_URL

  if (!url) {
    throw new Error('DATABASE_URL is missing at runtime')
  }

  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient()
} else {
  const globalForPrisma = globalThis as any
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  prisma = globalForPrisma.prisma
}

export { prisma }