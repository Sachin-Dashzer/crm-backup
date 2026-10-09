import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card } from "@/components/owner";
import { Signal } from "lucide-react";

export default function SimHealthPage() {
  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="Phone & SIM Health"
          subtitle="Not yet available"
        />

        <div className="content">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 150px)" }}>
            <Card style={{ maxWidth: "380px", textAlign: "center", padding: "32px 24px" }}>
              <div style={{ display: "inline-flex", padding: "16px", borderRadius: "16px", background: "var(--chip-bg)", color: "var(--blue)", marginBottom: "16px" }}>
                <Signal className="w-10 h-10" />
              </div>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 800 }}>This is coming soon.</h2>
              <p style={{ margin: "0", color: "var(--muted)", fontSize: "13px", lineHeight: 1.5 }}>Needs SIM info to be uploaded from the CallTrack app to the backend — not yet implemented.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
