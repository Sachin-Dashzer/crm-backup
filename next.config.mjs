const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "chart.js", "react-chartjs-2"],
  },

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
