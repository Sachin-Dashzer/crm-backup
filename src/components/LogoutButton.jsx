// components/LogoutButton.jsx - CREATE THIS FILE
'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LogoutButton({ className = "" }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut({ 
        redirect: false,
        callbackUrl: '/login'
      });
      
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={className || "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"}
    >
      Logout
    </button>
  );
}