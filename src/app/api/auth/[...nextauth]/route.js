import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "@/lib/db";
import User from "@/models/User";



const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          await connectDB();

          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email and password are required");
          }

          const user = await User.findOne({
            email: credentials.email
          }).select('+password +sessionVersion');

          if (!user) {
            throw new Error("Invalid email or password");
          }

          const isValid = await user.correctPassword(
            credentials.password,
            user.password
          );

          if (!isValid) {
            throw new Error("Invalid email or password");
          }

          user.lastLogin = new Date();
          await user.save();

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            branch: user.branch || 'All',
            sessionVersion: user.sessionVersion || 0,
          };
        } catch (error) {
          console.error("Authorization error:", error);
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.branch = user.branch;
        token.sessionVersion = user.sessionVersion || 0;
        token.lastValidated = Date.now();
      }

      const dueForRevalidation =
        trigger === "update" ||
        !token.lastValidated ||
        Date.now() - token.lastValidated >= SESSION_REVALIDATE_MS;

      if (token.id && dueForRevalidation) {
        try {
          await connectDB();

          const currentUser = await User.findById(token.id).select('+sessionVersion');

          if (!currentUser) {
            return null;
          }

          const currentSessionVersion = currentUser.sessionVersion || 0;
          const tokenSessionVersion = token.sessionVersion || 0;

          if (currentSessionVersion !== tokenSessionVersion) {
            console.log(`Session invalidated for user ${token.id}: version mismatch`);
            return null;
          }

          token.lastValidated = Date.now();
        } catch (error) {
          console.error("Session validation error:", error);
          return null;
        }
      }

      if (trigger === "update" && session) {
        token.name = session.name;
        token.email = session.email;
        token.branch = session.branch;
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.branch = token.branch;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 9 * 60 * 60,
    updateAge: 60 * 60,
  },

  jwt: {
    maxAge: 9 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };