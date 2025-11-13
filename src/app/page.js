"use client";
import Link from "next/link";


export default function HomePage() {

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">
            🏥 Ryan Clinic CRM
          </h1>
          <div className="space-x-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-700"
            >
              Login
            </Link>
            
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-4xl text-center space-y-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">
            Manage Patients, Roles & Reports <br />
            <span className="text-indigo-600">All in One Place</span>
          </h2>
          <p className="text-lg text-gray-600">
            A complete CRM for Ryan Clinic — track patient journeys, manage
            agents, counsellors, and surgeries with real-time reports and
            premium dashboards.
          </p>
          <div className="space-x-4">
            <Link
              href="/dashboard/admin"
              className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 rounded-lg border border-gray-300 font-medium hover:bg-gray-100"
            >
              Let&apos;s Start
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between text-sm text-gray-500">
          <span>© {new Date().getFullYear()} Ryan Clinic CRM</span>
          <span>Built with Next.js + TailwindCSS</span>
        </div>
      </footer>
    </div>
  );
}
