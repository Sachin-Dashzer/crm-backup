/** @type {import('next').NextConfig} */
const nextConfig = {
  // `lucide-react` is imported by 145 files and `recharts`/`chart.js` are barrel packages too.
  // Without this, importing a handful of named icons pulls the whole barrel into the module graph,
  // which inflates both the client bundle and dev compile times. This rewrites those named imports
  // to their direct submodule paths.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "chart.js", "react-chartjs-2"],
  },

  // Task 5, Step 6 — the standalone Payables/Receivables pages are retired in favour of the
  // documents drill-down on Liabilities/Assets; these keep old bookmarks and any stray in-app
  // links working. Not `permanent`: the merge could still be revisited, and a 301 would get
  // cached by browsers/CDNs past the point it's easy to undo.
  async redirects() {
    return [
      {
        source: "/admin/payables",
        destination: "/admin/liabilities?section=payables",
        permanent: false,
      },
      {
        source: "/admin/receivables",
        destination: "/admin/assets?section=receivables",
        permanent: false,
      },
      // §4.1 — Borrowings and Advances merged into one page, two tabs. Same "not permanent"
      // reasoning as the pair above.
      {
        source: "/admin/borrowings",
        destination: "/admin/financing?tab=borrowings",
        permanent: false,
      },
      {
        source: "/admin/advances",
        destination: "/admin/financing?tab=advances",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
