import { AsyncLocalStorage } from "async_hooks";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 5;

// -----------------------------------------------------------
// Request-scoped context (IP, User-Agent) via AsyncLocalStorage
// -----------------------------------------------------------
interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return requestContextStore.run(context, fn);
}

function getContext(): RequestContext {
  return requestContextStore.getStore() ?? { ipAddress: null, userAgent: null };
}

// -----------------------------------------------------------
// NextAuth configuration
// -----------------------------------------------------------
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email ou identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Identifiant et mot de passe requis");
        }

        const identifier = credentials.email.trim();
        const { ipAddress, userAgent } = getContext();

        // Find user by email OR by ptaCode (case-insensitive)
        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: { equals: identifier, mode: "insensitive" } },
              { ptaCode: { equals: identifier, mode: "insensitive" } },
            ],
          },
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!user) {
          // Don't reveal whether the account exists
          throw new Error("Identifiant ou mot de passe incorrect");
        }

        if (!user.isActive) {
          throw new Error("Ce compte a été désactivé. Contactez l'administrateur.");
        }

        if (user.deletedAt) {
          throw new Error("Ce compte a été archivé. Contactez l'administrateur.");
        }

        if (user.isLocked) {
          throw new Error(
            "Ce compte est verrouillé suite à de multiples tentatives échouées. Contactez l'administrateur."
          );
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        // Fantomas account is exempt from brute-force protection
        const isFantomas =
          user.ptaCode?.toLowerCase() === "fantomas" ||
          user.email.toLowerCase() === "fantomas@aaea.org";

        if (!isPasswordValid) {
          // --- Brute-force protection (Fantomas exempted) ---
          if (!isFantomas) {
            const newAttempts = user.failedLoginAttempts + 1;
            const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

            await db.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: newAttempts,
                isLocked: shouldLock,
              },
            });

            // Audit log for failed login attempt
            await db.auditLog.create({
              data: {
                userId: user.id,
                action: "LOGIN_FAILED",
                entity: "User",
                entityId: user.id,
                details: shouldLock
                  ? `Tentative ${newAttempts}/${MAX_FAILED_ATTEMPTS} — compte verrouillé`
                  : `Tentative ${newAttempts}/${MAX_FAILED_ATTEMPTS} échouée`,
                ipAddress,
                userAgent,
                severity: shouldLock ? "warning" : "info",
              },
            });

            if (shouldLock) {
              throw new Error(
                "Compte verrouillé après " +
                  MAX_FAILED_ATTEMPTS +
                  " tentatives échouées. Contactez l'administrateur."
              );
            }
          }

          throw new Error("Identifiant ou mot de passe incorrect");
        }

        // --- Successful login ---
        await db.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0, // Reset on successful login
            isLocked: false, // Unlock in case it was manually locked
          },
        });

        // Audit log for successful login (with IP/UA)
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            entity: "User",
            entityId: user.id,
            details: "Connexion réussie",
            ipAddress,
            userAgent,
            severity: "info",
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          ptaCode: user.ptaCode,
          position: user.position,
          department: user.department,
          avatar: user.avatar,
          passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
          roles: user.roles.map((ur) => ({
            id: ur.role.id,
            code: ur.role.code,
            name: ur.role.name,
            permissions: ur.role.permissions.map((rp) => rp.permission.code),
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.ptaCode = user.ptaCode;
        token.position = user.position;
        token.department = user.department;
        token.roles = user.roles;
        token.passwordChangedAt = user.passwordChangedAt;
      }

      // Invalidate session if password was changed after the token was issued
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { passwordChangedAt: true },
        });
        if (dbUser?.passwordChangedAt) {
          const dbTime = dbUser.passwordChangedAt.getTime();
          const tokenTime = token.passwordChangedAt
            ? new Date(token.passwordChangedAt as string).getTime()
            : 0;
          if (dbTime > tokenTime) {
            // Password was changed after this token was issued — force re-login
            return { ...token, error: "PasswordChanged" } as typeof token;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.ptaCode = token.ptaCode as string | null;
        session.user.position = token.position as string | null;
        session.user.department = token.department as string | null;
        session.user.roles = token.roles as Array<{
          id: string;
          code: string;
          name: string;
          permissions: string[];
        }>;
      }
      // If password was changed, force sign out by adding error flag
      if ((token as Record<string, unknown>).error === "PasswordChanged") {
        (session as Record<string, unknown>).error = "PasswordChanged";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 heures
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
