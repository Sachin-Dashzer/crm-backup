/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ];
  },
};

export default nextConfig;
