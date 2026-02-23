import { useState, useEffect, useCallback } from "react";
import { useShop } from "../context/ShopContext";
import { supabase } from "../lib/supabaseClient";

type StaffProcurement = {
  id: string;
  itemName: string;
  category: "shop_use" | "future_stock";
  quantity: number;
  cost: number;
  supplierName: string;
  reason: string;
  submittedBy: string;
  submittedByShop: string;
  status: "pending" | "approved" | "rejected" | "sold";
  approvedBy?: string;
  approvedDate?: Date;
  rejectReason?: string;
  submittedDate: Date;
};

export default function StaffPurchases() {
  const { currentUser, shops } = useShop();
  const isAdmin = currentUser?.roles.includes("admin") || false;

  const [procurements, setProcurements] = useState<StaffProcurement[]>([]);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected" | "sold">("all");
  const [form, setForm] = useState({
    itemName: "",
    category: "shop_use" as "shop_use" | "future_stock",
    quantity: "1",
    cost: "",
    supplierName: "",
    reason: "",
  });

  const shopName = shops.find((s) => s.id === currentUser?.shopId)?.name || "Unknown";

  const loadProcurements = useCallback(async () => {
    const { data, error } = await supabase
      .from("staff_procurements")
      .select("*")
      .order("submitted_date", { ascending: false });

    if (error) {
      const tableMissing = error.code === "42P01";
      setTableError(
        tableMissing
          ? "Staff procurements table is missing. Run supabase/add_staff_procurements.sql in Supabase SQL Editor."
          : "Could not load procurements."
      );
      setProcurements([]);
      return;
    }

    setTableError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: StaffProcurement[] = (data || []).map((r: any) => ({
      id: r.id,
      itemName: r.item_name,
      category: r.category,
      quantity: Number(r.quantity) || 1,
      cost: Number(r.cost) || 0,
      supplierName: r.supplier_name || "",
      reason: r.reason || "",
      submittedBy: r.submitted_by,
      submittedByShop: r.submitted_by_shop || "",
      status: r.status,
      approvedBy: r.approved_by || undefined,
      approvedDate: r.approved_date ? new Date(r.approved_date) : undefined,
      rejectReason: r.reject_reason || undefined,
      submittedDate: new Date(r.submitted_date),
    }));
    setProcurements(mapped);
  }, []);

  useEffect(() => { loadProcurements(); }, [loadProcurements]);

  const handleSubmit = async () => {
    if (!form.itemName.trim()) { alert("Please enter the item name."); return; }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty < 1) { alert("Quantity must be at least 1."); return; }
    const cost = Number(form.cost);
    if (!Number.isFinite(cost) || cost < 0) { alert("Please enter a valid cost."); return; }
    if (!form.reason.trim()) { alert("Please describe why this item was purchased / why it is here."); return; }

    const { error } = await supabase.from("staff_procurements").insert({
      item_name: form.itemName.trim(),
      category: form.category,
      quantity: qty,
      cost,
      supplier_name: form.supplierName.trim() || null,
      reason: form.reason.trim(),
      submitted_by: currentUser?.name || "Staff",
      submitted_by_shop: shopName,
    });

    if (error) { alert("Failed to save. Please try again."); console.error("Insert procurement error:", error); return; }

    setForm({ itemName: "", category: "shop_use", quantity: "1", cost: "", supplierName: "", reason: "" });
    setIsAdding(false);
    await loadProcurements();
  };

  const filtered = filterStatus === "all" ? procurements : procurements.filter((p) => p.status === filterStatus);
  const myProcurements = isAdmin ? filtered : filtered.filter((p) => p.submittedBy === currentUser?.name);

  const statusLabel = (s: string): string => {
    const map: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", sold: "Sold" };
    return map[s] || s;
  };
  const statusColor = (s: string): string => {
    const map: Record<string, string> = { pending: "text-yellow-600 bg-yellow-50", approved: "text-green-700 bg-green-50", rejected: "text-red-600 bg-red-50", sold: "text-blue-600 bg-blue-50" };
    return map[s] || "";
  };
  const categoryLabel = (c: string) => c === "shop_use" ? "Shop Use (Not for Sale)" : "Future Stock (May Sell)";

  const myCounts = isAdmin ? procurements : procurements.filter((p) => p.submittedBy === currentUser?.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Staff Purchases</h1>
        <button onClick={() => setIsAdding(!isAdding)} className={`px4 py-2 rounded font-medium transition-colors ${isAdding ? "bg-gray-400 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
          {isAdding ? "Cancel" : "+ New Purchase"}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Record any item you have outsourced — whether for shop use (tools, supplies, customer-refused items) or future stock that might be sold later. Admin will review and approve on the Procurement Review page.
      </p>

      {tableError && <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">{tableError}</div>}

      {isAdding && (
        <div className="bg-white rounded-lg shadow p-5 border space-y-4">
          <h2 className="text-lg font-semibold">New Purchase Entry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Item Name *</label>
              <input className="w-full border rounded p-2" placeholder="e.g. Screen Protector, Charging Cable" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select className="w-full border rounded p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as "shop_use" | "future_stock" })} aria-label="Item category">
                <option value="shop_use">Shop Use (Not for Sale)</option>
                <option value="future_stock">Future Stock (May Sell Later)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantity *</label>
              <input type="number" min="1" className="w-full border rounded p-2" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cost (KES) *</label>
              <input type="number" min="0" className="w-full border rounded p-2" placeholder="Total cost" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Supplier</label>
              <input className="w-full border rounded p-2" placeholder="Where was it bought from?" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason / Description *</label>
            <textarea className="w-full border rounded p-2" rows={3} placeholder="Why was this item purchased? E.g. 'Customer ordered but refused to buy', 'Needed for shop repairs', 'Bought extra for stock'" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 font-medium">Submit Purchase</button>
            <button onClick={() => { setIsAdding(false); setForm({ itemName: "", category: "shop_use", quantity: "1", cost: "", supplierName: "", reason: "" }); }} className="bg-gray-200 text-gray-700 px-5 py-2 rounded hover:bg-gray-300">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected", "sold"] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 text-sm rounded-full border transition-colors ${filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
            {s === "all" ? "All" : statusLabel(s)}
          </button>
        ))}
      </div>

      {myProcurements.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{filterStatus === "all" ? "No purchases recorded yet." : `No ${filterStatus} purchases.`}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg shadow text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3 border-b font-semibold">Date</th>
                <th className="p-3 border-b font-semibold">Item</th>
                <th className="p-3 border-b font-semibold">Category</th>
                <th className="p-3 border-b font-semibold">Qty</th>
                <th className="p-3 border-b font-semibold">Cost (KES)</th>
                <th className="p-3 border-b font-semibold">Supplier</th>
                {isAdmin && <th className="p-3 border-b font-semibold">Submitted By</th>}
                <th className="p-3 border-b font-semibold">Reason</th>
                <th className="p-3 border-b font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {myProcurements.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 border-b last:border-0">
                  <td className="p-3 whitespace-nowrap">{p.submittedDate.toLocaleDateString()}</td>
                  <td className="p-3 font-medium">{p.itemName}</td>
                  <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${p.category === "shop_use" ? "bg-gray-100 text-gray-700" : "bg-purple-50 text-purple-700"}`}>{categoryLabel(p.category)}</span></td>
                  <td className="p-3">{p.quantity}</td>
                  <td className="p-3 font-medium">KES {p.cost.toLocaleString()}</td>
                  <td className="p-3">{p.supplierName || "\u2014"}</td>
                  {isAdmin && <td className="p-3">{p.submittedBy}{p.submittedByShop ? ` (${p.submittedByShop})` : ""}</td>}
                  <td className="p-3 max-w-xs truncate" title={p.reason}>{p.reason}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                    {p.status === "rejected" && p.rejectReason && <p className="text-xs text-red-500 mt-1" title={p.rejectReason}>{p.rejectReason}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-gray-500">Total Submitted</p>
          <p className="text-xl font-bold">{myCounts.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-xl font-bold text-yellow-700">{myCounts.filter((p) => p.status === "pending").length}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-xl font-bold text-green-700">{myCounts.filter((p) => p.status === "approved").length}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-blue-700">Total Value</p>
          <p className="text-xl font-bold text-blue-700">KES {myCounts.reduce((s, p) => s + p.cost, 0).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
