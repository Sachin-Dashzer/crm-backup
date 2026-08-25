import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card } from "@/components/owner";

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
            <Card className=" " style={{ maxWidth: "380px", textAlign: "center" }}>
              <div style={{ fontSize: "64px", marginBottom: "16px" }}>📶</div>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>This is coming soon.</h2>
              <p style={{ margin: "0", color: "var(--muted)", fontSize: "13px" }}>Needs SIM info to be uploaded from the CallTrack app to the backend — not yet implemented.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
