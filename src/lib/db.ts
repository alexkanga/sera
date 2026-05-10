import { PrismaClient } from '@prisma/client'

// Sécurité : vérifier que DATABASE_URL pointe vers PostgreSQL Neon
// Cette application utilise EXCLUSIVEMENT PostgreSQL Neon — pas de SQLite
const databaseUrl = process.env.DATABASE_URL || ''
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  throw new Error(
    `DATABASE_URL invalide : doit pointer vers PostgreSQL Neon. ` +
    `Valeur actuelle : "${databaseUrl.substring(0, 30)}..." . ` +
    `Vérifiez que DATABASE_URL=postgresql://... est bien défini dans .env`
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
