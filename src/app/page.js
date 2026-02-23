"use client";
import Link from "next/link";
import {
  Users,
  Calendar,
  TrendingUp,
  Shield,
  FileText,
  Clock,
  BarChart3,
  CheckCircle,
  Stethoscope,
  MapPin,
  Zap,
  Building2,
  UserCog,
  ClipboardList,
  IndianRupee,
  ArrowRight,
} from "lucide-react";

export default function Homepage() {
  const features = [
    {
      icon: Users,
      title: "Patient Management",
      description:
        "Complete patient lifecycle tracking from lead to post-surgery care with detailed records.",
      color: "blue",
    },
    {
      icon: UserCog,
      title: "Employee Management",
      description:
        "Manage sales agents, counsellors, reception, and surgery teams with role-based access.",
      color: "green",
    },
    {
      icon: Calendar,
      title: "Appointment Scheduling",
      description:
        "Smart booking system with automated reminders and visit tracking.",
      color: "purple",
    },
    {
      icon: IndianRupee,
      title: "Financial Tracking",
      description:
        "Real-time transaction management, billing, and revenue analytics.",
      color: "amber",
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description:
        "Comprehensive dashboards with charts, trends, and KPI tracking.",
      color: "indigo",
    },
    {
      icon: FileText,
      title: "Advanced Reports",
      description:
        "Generate detailed reports with custom filters by date, branch, and procedure.",
      color: "red",
    },
  ];

  const roles = [
    {
      name: "Admin",
      description:
        "Full system access with employee management, reports, and analytics",
      icon: Shield,
      features: [
        "Employee Management",
        "System Reports",
        "All Branch Access",
        "Financial Overview",
      ],
      color: "from-red-500 to-orange-500",
    },
    {
      name: "Sales",
      description:
        "Lead management, appointment booking, and performance tracking",
      icon: TrendingUp,
      features: [
        "Patient Creation",
        "Appointment Booking",
        "Lead Tracking",
        "Revenue Reports",
      ],
      color: "from-blue-500 to-cyan-500",
    },
    {
      name: "Reception",
      description: "Patient check-in, billing, and front-desk operations",
      icon: ClipboardList,
      features: [
        "Patient Check-in",
        "Bill Generation",
        "Visit Tracking",
        "Transaction Management",
      ],
      color: "from-green-500 to-emerald-500",
    },
    {
      name: "Surgery",
      description: "Surgical procedure tracking and post-op patient management",
      icon: Stethoscope,
      features: [
        "Surgery Scheduling",
        "Procedure Tracking",
        "Aftercare Management",
        "Patient Reports",
      ],
      color: "from-purple-500 to-pink-500",
    },
  ];

  const stats = [
    { value: "4", label: "User Roles", icon: Users },
    { value: "3", label: "Branch Locations", icon: Building2 },
    { value: "100%", label: "Real-time Sync", icon: Zap },
    { value: "24/7", label: "Access Available", icon: Clock },
  ];

  const branches = [
    { city: "Delhi", color: "bg-blue-500" },
    { city: "Mumbai", color: "bg-green-500" },
    { city: "Hyderabad", color: "bg-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-linear-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              LearCRM
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-1 rounded-lg bg-linear-to-r from-indigo-600 to-purple-600 text-white font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-linear-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 backdrop-blur-sm border border-indigo-200 rounded-full text-sm font-medium text-indigo-700">
              <Zap size={16} className="text-indigo-600" />
              Complete Hair Transplant Clinic Management
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight">
              Transform Your
              <br />
              <span className="bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Clinic Operations
              </span>
            </h1>

            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              A comprehensive CRM solution designed specifically for Ryan
              Clinic. Manage patients, track surgeries, handle finances, and
              gain insights — all from one powerful platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/login"
                className="group px-8 py-4 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
              >
                Get Started
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
              <button className="px-8 py-4 rounded-xl border-2 border-gray-300 font-semibold hover:border-indigo-600 hover:text-indigo-600 transition-all duration-300">
                Watch Demo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-16">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <stat.icon className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to run a successful hair transplant clinic
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group p-8 rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div
                    className={`w-14 h-14 rounded-xl bg-${feature.color}-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className={`text-${feature.color}-600`} size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Role-Based Access Section */}
      <section className="py-20 px-6 bg-linear-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-4">
              Role-Based Dashboards
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Customized interfaces for every team member with precise access
              control
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div
                    className={`h-32 bg-linear-to-br ${role.color} flex items-center justify-center`}
                  >
                    <Icon className="text-white mr-2" size={28} />
                    <h3 className="text-xl mt-1 font-bold text-white mb-2">
                      {role.name}
                    </h3>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-600 mb-4 text-sm">
                      {role.description}
                    </p>
                    <ul className="space-y-2">
                      {role.features.map((feat, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <CheckCircle
                            size={16}
                            className="text-green-500 shrink-0"
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Multi-Branch Support */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Multi-Branch Management
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Seamlessly manage operations across all LearCRM locations
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {branches.map((branch, index) => (
              <div key={index} className="group relative">
                <div className="w-48 h-48 rounded-full bg-linear-to-br from-indigo-100 to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <div
                    className={`w-40 h-40 ${branch.color} rounded-full flex items-center justify-center shadow-2xl`}
                  >
                    <div className="text-center">
                      <MapPin className="text-white mx-auto mb-2" size={32} />
                      <div className="text-white font-bold text-xl">
                        {branch.city}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 text-lg">
              Real-time data synchronization across all branches with
              centralized reporting
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6 bg-linear-to-br from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Choose LearCRM?
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Built specifically for hair transplant clinics with industry
              expertise
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Clock size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Save Time</h3>
              <p className="opacity-90">
                Automate repetitive tasks and streamline workflows to focus on
                patient care
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Increase Revenue</h3>
              <p className="opacity-90">
                Track performance metrics and identify growth opportunities with
                analytics
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Shield size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Secure & Reliable</h3>
              <p className="opacity-90">
                Role-based access control and secure data management for patient
                privacy
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to Transform Your Clinic?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join LearCRM in revolutionizing hair transplant patient
            management
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105"
          >
            Get Started Now
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Stethoscope className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  LearCRM
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                Complete management solution for hair transplant clinics.
                Streamline operations, track patients, and grow your business.
              </p>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={16} className="text-indigo-600" />
                  Delhi • Mumbai • Hyderabad
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Features</h4>
              <ul className="space-y-2 text-gray-600">
                <li>Patient Management</li>
                <li>Employee Tracking</li>
                <li>Performance Analytics</li>
                <li>Financial Reports</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-2 text-gray-600">
                <li>Documentation</li>
                <li>Contact Us</li>
                <li>System Status</li>
                <li>Updates</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} LearCRM. All rights reserved.
            </p>
            <p className="text-gray-600 text-sm">
              Built with Next.js, MongoDB & TailwindCSS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
