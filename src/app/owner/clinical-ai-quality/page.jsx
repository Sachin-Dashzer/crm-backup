import OwnerSidebar from "@/components/Sidebars/OwnerSidebar";
import { OwnerTopbar, Card } from "@/components/owner";
import { Dna } from "lucide-react";

export default function ClinicalAiQualityPage() {
  return (
    <div className="app">
      <OwnerSidebar />

      <div className="main">
        <OwnerTopbar
          title="Clinical AI Quality"
          subtitle="Not yet available"
        />

        <div className="content">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 150px)" }}>
            <Card style={{ maxWidth: "380px", textAlign: "center", padding: "32px 24px" }}>
              <div style={{ display: "inline-flex", padding: "16px", borderRadius: "16px", background: "var(--chip-bg)", color: "var(--blue)", marginBottom: "16px" }}>
                <Dna className="w-10 h-10" />
              </div>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 800 }}>This is coming soon.</h2>
              <p style={{ margin: "0", color: "var(--muted)", fontSize: "13px", lineHeight: 1.5 }}>Needs a clinical evaluation model — not yet implemented.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
