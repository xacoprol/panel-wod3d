import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { neonSql, wakeNeon } from "./neon-http";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type AuthUserRow = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const email = parsed.data.email.toLowerCase();

          // HTTP a Neon (no TCP :5432) — estable en Vercel serverless
          await wakeNeon();
          const sql = neonSql();
          const rows = (await sql`
            SELECT id, email, name, "passwordHash"
            FROM "User"
            WHERE email = ${email}
            LIMIT 1
          `) as AuthUserRow[];

          const user = rows[0];
          if (!user) return null;

          const valid = await bcrypt.compare(
            parsed.data.password,
            user.passwordHash
          );
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (err) {
          console.error("[auth] authorize failed", err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  trustHost: true,
});
