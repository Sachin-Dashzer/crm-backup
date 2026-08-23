"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import LogoutButton from "../LogoutButton";

// Exact section structure and order as specified — every item (including the 6 "Coming Soon"
// pages: Phone & SIM Health, Productivity Attendance, AI Health & Audit, Clinical AI Quality,
// Incentives & Payroll, HR Action Center) is a real route, never hidden or disabled.
const SECTIONS = [
  {
    title: "Executive",
    items: [
      { label: "Command Center", href: "/owner/dashboard", icon: "🎯" },
      { label: "Live Workforce & Queue", href: "/owner/live-workforce", icon: "🟢" },
      { label: "Agent 360°", href: "/owner/agent-360", icon: "🧑‍💼" },
      { label: "TL & Manager", href: "/owner/leadership", icon: "🧭" },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Meta & Google", href: "/owner/ad-spend", icon: "📣" },
      { label: "Conversion Intelligence", href: "/owner/conversion", icon: "🧠" },
      { label: "Retry & Recovery", href: "/owner/retry", icon: "🔁" },
      { label: "Leak Control Room", href: "/owner/leaks", icon: "🚨" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Phone & SIM Health", href: "/owner/phone-sim-health", icon: "📶" },
      { label: "Productivity Attendance", href: "/owner/productivity-attendance", icon: "🕒" },
      { label: "Forecast & Staffing", href: "/owner/forecast-staffing", icon: "📈" },
      { label: "AI Health & Audit", href: "/owner/ai-health-audit", icon: "🛡️" },
    ],
  },
  {
    title: "Clinic Operations",
    items: [
      { label: "Patient Journey 360°", href: "/owner/patient-journey-360", icon: "🩺" },
      { label: "Counsellor Conversion", href: "/owner/counsellor-conversion", icon: "💬" },
      { label: "Surgery & OT Planner", href: "/owner/surgery-ot-planner", icon: "✂️" },
      { label: "Clinical AI Quality", href: "/owner/clinical-ai-quality", icon: "🧬" },
    ],
  },
  {
    title: "People & Finance",
    items: [
      { label: "All Staff 360°", href: "/owner/all-staff-360", icon: "👥" },
      { label: "Incentives & Payroll", href: "/owner/incentives-payroll", icon: "💰" },
      { label: "HR Action Center", href: "/owner/hr-action-center", icon: "🗂️" },
      { label: "Accounts/P&L & Expenses", href: "/owner/accounts-pnl-expenses", icon: "📊" },
    ],
  },
];

export default function OwnerSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

  const userName = session?.user?.name || session?.user?.email || "Owner";
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">👑</div>
        <div>
          <strong>RyanCRM</strong>
          <small>Owner</small>
        </div>
      </div>

      <nav>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="nav-label">{section.title}</p>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-btn${isActive(item.href) ? " active" : ""}`}
              >
                <span className="nav-ico">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ marginTop: 16, padding: "12px 7px", borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 11, color: "#fff" }}>{userName}</strong>
            <span style={{ fontSize: 9, color: "#abc0e6" }}>Owner</span>
          </div>
        </div>
        <LogoutButton className="danger-btn" />
      </div>
    </aside>
  );
}
