"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import { useToast } from "@/components/Toast";
import { Loader2, Plus, Search, Store, Mail, Phone, Hash, Pencil } from "lucide-react";

// Vendors inside the admin shell. The same records the stocks section manages — /api/vendors
// is the single source for both, so a vendor added here is immediately selectable as a
// payable payee or receivable payer.

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export default function AdminVendorsPage() {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendors/get");
      const d = await res.json();
      if (res.ok && d.success !== false) setVendors(d.data || d.vendors || []);
      else toast.error(d.message || "Failed to load vendors");
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Filtered on the client: the whole vendor list is small and already in memory, so a
  // round-trip per keystroke would be slower than the filter itself.
  const term = search.trim().toLowerCase();
  const shown = term
    ? vendors.filter((v) =>
        [v.name, v.DealsIn, v.email, v.gstNumber, v.contact]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term)),
      )
    : vendors;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
              <p className="text-gray-600 mt-1 text-sm">
                Suppliers you buy from. A vendor here can be picked as the payee on a payable
                or the payer on a receivable.
              </p>
            </div>
            <Link
              href="/admin/vendors/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm"
            >
              <Plus className="w-4 h-4" />
              New Vendor
            </Link>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, category, email, GST or phone…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Deals In</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">GST</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin inline" />
                      </td>
                    </tr>
                  ) : !shown.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        {vendors.length
                          ? "No vendor matches that search."
                          : "No vendors yet — add the first one."}
                      </td>
                    </tr>
                  ) : (
                    shown.map((v) => (
                      <tr key={v._id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {initials(v.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {v.name || "Unnamed"}
                              </p>
                              {v.address && (
                                <p className="text-xs text-gray-400 truncate max-w-xs">{v.address}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {v.DealsIn ? (
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {v.DealsIn}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="space-y-0.5">
                            {v.contact ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Phone className="w-3 h-3 text-gray-400" />
                                <span className="font-mono">{v.contact}</span>
                              </div>
                            ) : null}
                            {v.email ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Mail className="w-3 h-3 text-gray-400" />
                                <span className="truncate max-w-45">{v.email}</span>
                              </div>
                            ) : null}
                            {!v.contact && !v.email && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {v.gstNumber ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-600">
                              <Hash className="w-3 h-3 text-gray-400" />
                              {v.gstNumber}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {/* Editing lives in the stocks section — the same record, one form,
                              rather than a second edit page that can drift from it. */}
                          <Link
                            href={`/stocks/vendors/edit/${v._id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!loading && vendors.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1.5">
              <Store className="w-3 h-3" />
              {shown.length} of {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
