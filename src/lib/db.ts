import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Sécurité : vérifier que DATABASE_URL pointe vers PostgreSQL Neon au runtime
// Cette vérification est différée pour ne pas bloquer le build Next.js
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  const databaseUrl = process.env.DATABASE_URL || ''
  if (databaseUrl && !databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    console.warn(
      `[DB] ATTENTION : DATABASE_URL ne pointe pas vers PostgreSQL. ` +
      `Valeur actuelle : "${databaseUrl.substring(0, 30)}..." . ` +
      `Vérifiez que DATABASE_URL=postgresql://... est bien défini dans les variables d'environnement.`
    )
  }
}
