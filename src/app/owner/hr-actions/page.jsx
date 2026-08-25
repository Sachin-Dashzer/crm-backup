import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card } from "@/components/owner";

export default function HRActionsPage() {
  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="HR Action Center"
          subtitle="Not yet available"
        />

        <div className="content">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 150px)" }}>
            <Card className=" " style={{ maxWidth: "380px", textAlign: "center" }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>🗂️</div>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>This is coming soon.</h2>
              <p style={{ margin: "0", color: "var(--muted)", fontSize: "13px" }}>Needs an HR action-tracking system — not yet implemented.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
