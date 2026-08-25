import AdminSidebar from "@/components/Sidebars/Sidebar";

/**
 * Shared shell for every /admin route.
 *
 * The sidebar used to be imported and rendered by each of the 23 admin pages individually, so a
 * 293-line subtree (plus its icon set) was torn down and rebuilt on every navigation. Mounting it
 * once here keeps it alive across route changes — Next.js preserves the layout and swaps only
 * `children`.
 *
 * This is a Server Component: it ships no JavaScript of its own, and AdminSidebar stays a client
 * component via its own "use client" directive.
 *
 * Pages still carry their own `flex min-h-screen` wrapper around their <main>. That nests
 * harmlessly inside the flex child below and is left in place deliberately, so adopting this
 * layout was a one-line deletion per page rather than a re-indent of every page's whole render
 * tree. Those wrappers can be flattened later without changing anything here.
 */
export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
