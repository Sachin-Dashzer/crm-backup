'use client';

import { SessionProvider } from 'next-auth/react';

export default function NextAuthProvider({ children, session }) {
  return (
    <SessionProvider basePath="/api/auth" session={session} refetchInterval={5 * 60}>
      {children}
    </SessionProvider>
  );
}