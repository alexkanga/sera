import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email et mot de passe requis");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
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
          throw new Error("Aucun compte trouvé avec cet email");
        }

        if (!user.isActive) {
          throw new Error("Ce compte a été désactivé. Contactez l'administrateur.");
        }

        if (user.deletedAt) {
          throw new Error("Ce compte a été archivé. Contactez l'administrateur.");
        }

        if (user.isLocked) {
          throw new Error("Ce compte est verrouillé. Contactez l'administrateur.");
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Mot de passe incorrect");
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // Log the login
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            entity: "User",
            entityId: user.id,
            details: "Connexion réussie",
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
