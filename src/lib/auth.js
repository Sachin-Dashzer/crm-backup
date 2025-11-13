import { cookies } from 'next/headers';

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const isLoggedIn = cookieStore.get('isLoggedIn')?.value === 'true';
    const userRole = cookieStore.get('userRole')?.value || null;
    const userId = cookieStore.get('userId')?.value || null;
    const userName = cookieStore.get('userName')?.value || null;
    const userBranch = cookieStore.get('userBranch')?.value || null;
    const userEmail = cookieStore.get('userEmail')?.value || null;

    if (!isLoggedIn || !userRole || !userId) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      user: {
        id: userId,
        name: decodeURIComponent(userName || ''),
        email: userEmail,
        role: userRole,
        branch: userBranch || 'All',
      },
    };
  } catch (error) {
    console.error('Session error:', error);
    return { isAuthenticated: false };
  }
}

// Role-based permissions
export const ROLE_PERMISSIONS = {
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
};

// Check if user has permission
export function hasPermission(userRole, permission) {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  
  if (!rolePermissions) return false;
  
  // Admin has all permissions
  if (rolePermissions.permissions.includes('all')) return true;
  
  return rolePermissions.permissions.includes(permission);
}

// Check if user can access route
export function canAccessRoute(userRole, pathname) {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  
  if (!rolePermissions) return false;
  
  // Admin can access all routes
  if (userRole === 'admin') return true;
  
  return rolePermissions.routes.some(route => pathname.startsWith(route));
}

// Check if user can access specific branch data
export function canAccessBranch(userRole, userBranch, dataBranch) {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  
  if (!rolePermissions) return false;
  
  // Admin or users with "All" branch can access all data
  if (rolePermissions.canAccessAllBranches || userBranch === 'All') return true;
  
  // User can only access their own branch
  return userBranch === dataBranch;
}