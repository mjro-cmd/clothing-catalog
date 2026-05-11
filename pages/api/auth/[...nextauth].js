import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const ALLOWED_EMAILS = [
  'minji.ro@gmail.com',
  'phil.thomson@gmail.com',
]

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return ALLOWED_EMAILS.includes(user.email)
    },
    async session({ session }) {
      return session
    },
  },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
}

export default NextAuth(authOptions)
