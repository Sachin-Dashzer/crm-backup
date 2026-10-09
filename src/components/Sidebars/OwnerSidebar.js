"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  UserCheck,
  Compass,
  Megaphone,
  BrainCircuit,
  RotateCcw,
  ShieldAlert,
  Signal,
  Clock,
  TrendingUp,
  ShieldCheck,
  Stethoscope,
  MessageSquare,
  Scissors,
  Dna,
  Users,
  Wallet,
  FolderKanban,
  Receipt,
  Crown,
} from "lucide-react";

const SECTIONS = [
  {
    title: "Executive",
    items: [
      { label: "Command Center", href: "/owner/dashboard", icon: LayoutDashboard },
      { label: "Live Workforce & Queue", href: "/owner/live-workforce", icon: Activity },
      { label: "Agent 360°", href: "/owner/agent-360", icon: UserCheck },
      { label: "TL & Manager", href: "/owner/leadership", icon: Compass },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Meta & Google", href: "/owner/ad-spend", icon: Megaphone },
      { label: "Conversion Intelligence", href: "/owner/conversion", icon: BrainCircuit },
      { label: "Retry & Recovery", href: "/owner/retry", icon: RotateCcw },
      { label: "Leak Control Room", href: "/owner/leaks", icon: ShieldAlert },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Phone & SIM Health", href: "/owner/sim-health", icon: Signal },
      { label: "Productivity Attendance", href: "/owner/attendance", icon: Clock },
      { label: "Forecast & Staffing", href: "/owner/forecast", icon: TrendingUp },
      { label: "AI Health & Audit", href: "/owner/ai-health", icon: ShieldCheck },
    ],
  },
  {
    title: "Clinic Operations",
    items: [
      { label: "Patient Journey 360°", href: "/owner/patient-journey", icon: Stethoscope },
      { label: "Counsellor Conversion", href: "/owner/counsellor-conversion", icon: MessageSquare },
      { label: "Surgery & OT Planner", href: "/owner/surgery-planner", icon: Scissors },
      { label: "Clinical AI Quality", href: "/owner/clinical-ai-quality", icon: Dna },
    ],
  },
  {
    title: "People & Finance",
    items: [
      { label: "All Staff 360°", href: "/owner/staff-360", icon: Users },
      { label: "Incentives & Payroll", href: "/owner/payroll", icon: Wallet },
      { label: "HR Action Center", href: "/owner/hr-actions", icon: FolderKanban },
      { label: "Accounts/P&L & Expenses", href: "/owner/finance", icon: Receipt },
    ],
  },
];

export default function OwnerSidebar() {
  const pathname = usePathname();

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div>
          <strong>RyanCRM</strong>
          <small>Owner</small>
        </div>
      </div>

      <nav>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="nav-label">{section.title}</p>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-btn${isActive(item.href) ? " active" : ""}`}
                >
                  <span className="nav-ico">
                    <Icon className="w-4 h-4 inline-block" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
