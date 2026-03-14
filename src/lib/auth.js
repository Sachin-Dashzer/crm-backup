// lib/auth.js - REPLACE YOUR EXISTING FILE
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getSession() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        branch: session.user.branch || 'All',
      },
    };
  } catch (error) {
    console.error('Session error:', error);
    return { isAuthenticated: false };
  }
}

// Role-based permissions
export const ROLE_PERMISSIONS = {
  'super-admin': {
    routes: ['/super-admin', '/admin', '/sales', '/reception', '/surgery', '/counsellor', '/stocks', '/hr'],
    permissions: ['all'],
    canAccessAllBranches: true,
  },
  admin: {
    routes: ['/admin'],
    permissions: ['all'],
    canAccessAllBranches: true,
  },
  sales: {
    routes: ['/sales'],
    permissions: ['patients', 'agents', 'reports', 'revenue', 'transactions'],
    canAccessAllBranches: false,
  },
  reception: {
    routes: ['/reception'],
    permissions: ['appointments', 'patients', 'transactions', 'bills'],
    canAccessAllBranches: false,
  },
  surgery: {
    routes: ['/surgery'],
    permissions: ['patients', 'surgeries'],
    canAccessAllBranches: false,
  },
  counsellor: {
    routes: ['/counsellor'],
    permissions: ['patients'],
    canAccessAllBranches: false,
  },
  hr: {
    routes: ['/hr'],
    permissions: ['candidates', 'interviews'],
    canAccessAllBranches: true,
  },
};

export function hasPermission(userRole, permission) {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  if (rolePermissions.permissions.includes('all')) return true;
  return rolePermissions.permissions.includes(permission);
}

export function canAccessRoute(userRole, pathname) {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  if (userRole === 'super-admin') return true; // super-admin can access everything
  return rolePermissions.routes.some(route => pathname.startsWith(route));
}

export function canAccessBranch(userRole, userBranch, dataBranch) {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  if (rolePermissions.canAccessAllBranches || userBranch === 'All') return true;
  return userBranch === dataBranch;
}