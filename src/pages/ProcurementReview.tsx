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

type PaymentMethod = "mpesa" | "bank" | "cash" | "other";

type ProcurementPayment = {
  id: string;
  procurementId: string;
  supplierName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  notes?: string;
  recordedBy?: string;
};

export default function ProcurementReview() {
  const { currentUser } = useShop();
  const isAdmin = currentUser?.roles.includes("admin") || false;

  const [procurements, setProcurements] = useState<StaffProcurement[]>([]);
  const [payments, setPayments] = useState<ProcurementPayment[]>([]);
  const [tableError, setTableError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected" | "sold">("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [paymentHistoryId, setPaymentHistoryId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "mpesa" as PaymentMethod,
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

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

  const loadPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from("procurement_payments")
      .select("*")
      .order("payment_date", { ascending: false });

    if (error) { setPayments([]); return; }

    const mapped: ProcurementPayment[] = (data || []).map((r: any) => ({
      id: r.id,
      procurementId: r.procurement_id,
      supplierName: r.supplier_name || "",
      amount: Number(r.amount) || 0,
      paymentMethod: r.payment_method as PaymentMethod,
      paymentDate: new Date(r.payment_date),
      notes: r.notes || undefined,
      recordedBy: r.recorded_by || undefined,
    }));
    setPayments(mapped);
  }, []);

  useEffect(() => { loadProcurements(); loadPayments(); }, [loadProcurements, loadPayments]);

  const getPaymentInfo = useCallback((procId: string, totalCost: number) => {
    const itemPayments = payments.filter((p) => p.procurementId === procId);
    const paidAmount = itemPayments.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, totalCost - paidAmount);
    const status: "pending" | "partial" | "fully_paid" =
      paidAmount <= 0 ? "pending" : balance > 0 ? "partial" : "fully_paid";
    return { itemPayments, paidAmount, balance, status };
  }, [payments]);

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("staff_procurements").update({
      status: "approved",
      approved_by: currentUser?.name || "Admin",
      approved_date: new Date().toISOString(),
    }).eq("id", id);
    if (error) { alert("Failed to approve."); return; }
    await loadProcurements();
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { alert("Please provide a reason for rejection."); return; }
    const { error } = await supabase.from("staff_procurements").update({
      status: "rejected",
      approved_by: currentUser?.name || "Admin",
      approved_date: new Date().toISOString(),
      reject_reason: rejectReason.trim(),
    }).eq("id", id);
    if (error) { alert("Failed to reject."); return; }
    setRejectingId(null);
    setRejectReason("");
    await loadProcurements();
  };

  const handleMarkSold = async (id: string) => {
    if (!window.confirm("Mark this item as sold?")) return;
    const { error } = await supabase.from("staff_procurements").update({ status: "sold" }).eq("id", id);
    if (error) { alert("Failed to update."); return; }
    await loadProcurements();
  };

  const resetPaymentForm = () => {
    setPaymentForm({ amount: "", method: "mpesa", paymentDate: new Date().toISOString().slice(0, 10), notes: "" });
  };

  const handleRecordPayment = async (proc: StaffProcurement) => {
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { alert("Please enter a valid payment amount."); return; }
    const { balance } = getPaymentInfo(proc.id, proc.cost);
    if (amount > balance) { alert("Amount cannot exceed outstanding balance (KES " + balance.toLocaleString() + ")."); return; }
    if (!paymentForm.paymentDate) { alert("Please select the payment date."); return; }

    const { error } = await supabase.from("procurement_payments").insert({
      procurement_id: proc.id,
      supplier_name: proc.supplierName || null,
      amount,
      payment_method: paymentForm.method,
      payment_date: new Date(paymentForm.paymentDate).toISOString(),
      notes: paymentForm.notes.trim() || null,
      recorded_by: currentUser?.name || "Admin",
    });
    if (error) { alert("Failed to save payment."); console.error("Payment insert error:", error); return; }

    await loadPayments();
    setActivePaymentId(null);
    resetPaymentForm();
  };

  const paymentStatusColor = (s: string) => {
    const map: Record<string, string> = { pending: "text-red-600 bg-red-50", partial: "text-orange-600 bg-orange-50", fully_paid: "text-green-700 bg-green-50" };
    return map[s] || "";
  };
  const paymentStatusLabel = (s: string) => {
    const map: Record<string, string> = { pending: "Unpaid", partial: "Partial", fully_paid: "Fully Paid" };
    return map[s] || s;
  };

  const filtered = filterStatus === "all" ? procurements : procurements.filter((p) => p.status === filterStatus);
  const statusLabel = (s: string): string => {
    const map: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", sold: "Sold" };
    return map[s] || s;
  };
  const statusColor = (s: string): string => {
    const map: Record<string, string> = { pending: "text-yellow-600 bg-yellow-50", approved: "text-green-700 bg-green-50", rejected: "text-red-600 bg-red-50", sold: "text-blue-600 bg-blue-50" };
    return map[s] || "";
  };
  const categoryLabel = (c: string) => c === "shop_use" ? "Shop Use" : "Future Stock";
  const methodLabel = (m: string) => {
    const map: Record<string, string> = { mpesa: "M-Pesa", bank: "Bank Transfer", cash: "Cash", other: "Other" };
    return map[m] || m;
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-700">Access Denied</h1>
        <p className="text-gray-500 mt-2">This page is only available to admins.</p>
      </div>
    );
  }

  const totalOutstanding = procurements
    .filter((p) => p.status !== "rejected")
    .reduce((sum, p) => sum + getPaymentInfo(p.id, p.cost).balance, 0);

  const historyProc = paymentHistoryId ? procurements.find((p) => p.id === paymentHistoryId) : null;
  const historyPayments = paymentHistoryId ? payments.filter((p) => p.procurementId === paymentHistoryId).sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Procurement Review</h1>
      </div>
      <p className="text-sm text-gray-500">Review items submitted by staff, approve or reject them, and track supplier payments. Items marked as "Future Stock" can be sold later.</p>
      {tableError && <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200">{tableError}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-yellow-50 rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-yellow-700">Pending Review</p>
          <p className="text-xl font-bold text-yellow-700">{procurements.filter((p) => p.status === "pending").length}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-xl font-bold text-green-700">{procurements.filter((p) => p.status === "approved").length}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-blue-700">Sold</p>
          <p className="text-xl font-bold text-blue-700">{procurements.filter((p) => p.status === "sold").length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-xl font-bold">KES {procurements.filter((p) => p.status !== "rejected").reduce((s, p) => s + p.cost, 0).toLocaleString()}</p>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4 border text-center">
          <p className="text-sm text-red-700">Outstanding Balance</p>
          <p className="text-xl font-bold text-red-700">KES {totalOutstanding.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected", "sold"] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={"px-3 py-1 text-sm rounded-full border transition-colors " + (filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")}>
            {s === "all" ? "All (" + procurements.length + ")" : statusLabel(s) + " (" + procurements.filter((pp) => pp.status === s).length + ")"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No {filterStatus === "all" ? "" : filterStatus + " "}items found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const pi = getPaymentInfo(p.id, p.cost);
            const isExpanded = expandedRow === p.id;
            return (
              <div key={p.id} className="bg-white rounded-lg shadow border">
                <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedRow(isExpanded ? null : p.id)}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold">{p.itemName}</span>
                      <span className={"text-xs px-2 py-1 rounded-full " + (p.category === "shop_use" ? "bg-gray-100 text-gray-700" : "bg-purple-50 text-purple-700")}>{categoryLabel(p.category)}</span>
                      <span className={"text-xs px-2 py-1 rounded-full font-medium " + statusColor(p.status)}>{statusLabel(p.status)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Qty: {p.quantity}</span>
                      <span className="font-medium text-gray-900">KES {p.cost.toLocaleString()}</span>
                      {p.status !== "rejected" && (
                        <span className={"text-xs px-2 py-1 rounded-full font-medium " + paymentStatusColor(pi.status)}>{paymentStatusLabel(pi.status)}</span>
                      )}
                      <span>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Submitted by <span className="font-medium text-gray-700">{p.submittedBy}</span>
                    {p.submittedByShop ? " (" + p.submittedByShop + ")" : ""} on {p.submittedDate.toLocaleDateString()}
                    {p.supplierName && <>{" \u00B7 Supplier: "}<span className="font-medium text-gray-700">{p.supplierName}</span></>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-4">
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reason / Description</p>
                      <p className="text-sm">{p.reason}</p>
                    </div>

                    {p.status === "pending" && (
                      <div className="flex gap-3 flex-wrap items-start">
                        <button onClick={() => handleApprove(p.id)} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 font-medium">Approve</button>
                        {rejectingId === p.id ? (
                          <div className="flex gap-2 items-start">
                            <input className="border rounded p-2 text-sm w-64" placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                            <button onClick={() => handleReject(p.id)} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">Confirm Reject</button>
                            <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setRejectingId(p.id)} className="bg-red-100 text-red-700 px-4 py-2 rounded text-sm hover:bg-red-200 font-medium">Reject</button>
                        )}
                      </div>
                    )}

                    {p.status === "approved" && p.category === "future_stock" && (
                      <button onClick={() => handleMarkSold(p.id)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 font-medium">Mark as Sold</button>
                    )}

                    {p.status === "rejected" && p.rejectReason && (
                      <div className="bg-red-50 rounded p-3">
                        <p className="text-xs font-semibold text-red-500 uppercase mb-1">Rejection Reason</p>
                        <p className="text-sm text-red-700">{p.rejectReason}</p>
                        <p className="text-xs text-gray-500 mt-1">Rejected by {p.approvedBy} on {p.approvedDate?.toLocaleDateString()}</p>
                      </div>
                    )}

                    {p.status !== "rejected" && (
                      <div className="border-t pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">Supplier Payment</h3>
                          <div className="flex gap-2">
                            <button onClick={() => { setActivePaymentId(activePaymentId === p.id ? null : p.id); resetPaymentForm(); }} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                              {activePaymentId === p.id ? "Cancel" : "Record Payment"}
                            </button>
                            <button onClick={() => setPaymentHistoryId(paymentHistoryId === p.id ? null : p.id)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300">
                              {"History (" + pi.itemPayments.length + ")"}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div className="bg-gray-50 rounded p-2 text-center">
                            <p className="text-xs text-gray-500">Total Cost</p>
                            <p className="font-semibold">KES {p.cost.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-50 rounded p-2 text-center">
                            <p className="text-xs text-green-600">Paid</p>
                            <p className="font-semibold text-green-700">KES {pi.paidAmount.toLocaleString()}</p>
                          </div>
                          <div className={"rounded p-2 text-center " + (pi.balance > 0 ? "bg-red-50" : "bg-green-50")}>
                            <p className={"text-xs " + (pi.balance > 0 ? "text-red-600" : "text-green-600")}>Balance</p>
                            <p className={"font-semibold " + (pi.balance > 0 ? "text-red-700" : "text-green-700")}>KES {pi.balance.toLocaleString()}</p>
                          </div>
                        </div>

                        {activePaymentId === p.id && pi.balance > 0 && (
                          <div className="bg-blue-50 rounded p-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium mb-1">Amount (KES) *</label>
                                <input type="number" min="1" className="w-full border rounded p-2 text-sm" placeholder={"Max: " + pi.balance.toLocaleString()} value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Method *</label>
                                <select className="w-full border rounded p-2 text-sm" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })} aria-label="Payment method">
                                  <option value="mpesa">M-Pesa</option>
                                  <option value="bank">Bank Transfer</option>
                                  <option value="cash">Cash</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Payment Date *</label>
                                <input type="date" className="w-full border rounded p-2 text-sm" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Notes</label>
                                <input className="w-full border rounded p-2 text-sm" placeholder="Optional notes..." value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                              </div>
                            </div>
                            <button onClick={() => handleRecordPayment(p)} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 font-medium">Save Payment</button>
                          </div>
                        )}

                        {activePaymentId === p.id && pi.balance <= 0 && (
                          <div className="bg-green-50 text-green-700 p-3 rounded text-sm font-medium">This item is fully paid.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {paymentHistoryId && historyProc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-5 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Payment History</h2>
                <button onClick={() => setPaymentHistoryId(null)} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{historyProc.itemName} {historyProc.supplierName ? " - " + historyProc.supplierName : ""}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-xs text-gray-500">Total Cost</p>
                  <p className="font-semibold">KES {historyProc.cost.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                  <p className="text-xs text-green-600">Total Paid</p>
                  <p className="font-semibold text-green-700">KES {getPaymentInfo(historyProc.id, historyProc.cost).paidAmount.toLocaleString()}</p>
                </div>
                <div className={"rounded p-2 text-center " + (getPaymentInfo(historyProc.id, historyProc.cost).balance > 0 ? "bg-red-50" : "bg-green-50")}>
                  <p className={"text-xs " + (getPaymentInfo(historyProc.id, historyProc.cost).balance > 0 ? "text-red-600" : "text-green-600")}>Balance</p>
                  <p className={"font-semibold " + (getPaymentInfo(historyProc.id, historyProc.cost).balance > 0 ? "text-red-700" : "text-green-700")}>KES {getPaymentInfo(historyProc.id, historyProc.cost).balance.toLocaleString()}</p>
                </div>
              </div>
              {historyPayments.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {historyPayments.map((pay) => (
                    <div key={pay.id} className="border rounded p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-green-700">KES {pay.amount.toLocaleString()}</span>
                        <span className="text-xs text-gray-500">{pay.paymentDate.toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{methodLabel(pay.paymentMethod)}</span>
                        <span>by {pay.recordedBy || "Admin"}</span>
                      </div>
                      {pay.notes && <p className="text-xs text-gray-400 mt-1">{pay.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
