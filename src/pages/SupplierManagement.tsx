import { Fragment, useState, useMemo, useEffect, useCallback } from "react";
import { useSupplier, type SupplierType } from "../context/SupplierContext";
import { useInventory } from "../context/InventoryContext";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";
import { supabase } from "../lib/supabaseClient";

type Purchase = ReturnType<typeof useInventory>['purchases'][number];
type PaymentMethod = 'mpesa' | 'bank' | 'cash' | 'other';

type SupplierPayment = {
  id: string;
  purchaseId?: string;
  repairId?: string;
  partName?: string;
  supplierName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  notes?: string;
  recordedBy?: string;
};

export default function SupplierManagement() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplier();
  const { items: inventoryItems, purchases, deletePurchase } = useInventory();
  const { repairs, deleteRepair } = useRepair();
  const { currentUser, shops } = useShop();
  const isAdmin = currentUser?.roles.includes('admin') || false;
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'purchases' | 'parts_taken' | 'all'>(currentUser?.roles.includes('admin') ? 'all' : 'parts_taken');
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [paymentTableError, setPaymentTableError] = useState<string | null>(null);
  const [activePaymentPurchaseId, setActivePaymentPurchaseId] = useState<string | null>(null);
  const [paymentHistoryPurchase, setPaymentHistoryPurchase] = useState<Purchase | null>(null);
  const [activePaymentRepairKey, setActivePaymentRepairKey] = useState<string | null>(null);
  const [activeBulkRepairPaymentSupplierId, setActiveBulkRepairPaymentSupplierId] = useState<string | null>(null);
  const [paymentHistoryRepairKey, setPaymentHistoryRepairKey] = useState<{ repairId: string; partName: string; supplierName: string; cost: number } | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "mpesa" as PaymentMethod,
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [bulkRepairPaymentForm, setBulkRepairPaymentForm] = useState({
    amount: "",
    method: "mpesa" as PaymentMethod,
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    categories: ['spare_parts'] as ('accessories' | 'spare_parts')[],
    supplierType: 'local' as SupplierType,
  });

  // SupplierContext already hides wholesale suppliers from non-admin users.
  const visibleSuppliers = suppliers;

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ name: "", phone: "", email: "", address: "", categories: ['spare_parts'], supplierType: 'local' });
  };

  const handleEdit = (supplier: typeof suppliers[0]) => {
    setEditingId(supplier.id);
    setIsAdding(false);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      categories: [...supplier.categories],
      supplierType: supplier.supplierType || 'local',
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Please enter supplier name");
      return;
    }
    if (formData.categories.length === 0) {
      alert("Please select at least one category");
      return;
    }
    if (!isAdmin && formData.supplierType === 'wholesale') {
      alert("Only admin can create wholesale suppliers");
      return;
    }

    try {
      if (editingId) {
        await updateSupplier(editingId, formData);
      } else {
        await addSupplier(formData);
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Could not save supplier: ${err?.message || "Unknown error"}. Please try again.`);
      return;
    }

    setFormData({ name: "", phone: "", email: "", address: "", categories: ['spare_parts'], supplierType: 'local' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: "", phone: "", email: "", address: "", categories: ['spare_parts'], supplierType: 'local' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      deleteSupplier(id);
    }
  };

  const loadSupplierPayments = useCallback(async () => {
    // Only load supplier payments for admin users - staff should never see payment information
    if (!isAdmin) {
      setSupplierPayments([]);
      setPaymentTableError(null);
      return;
    }
    const { data, error } = await supabase
      .from("supplier_payments")
      .select("*")
      .order("payment_date", { ascending: false });

    if (error) {
      const tableMissing = error.code === "42P01";
      setPaymentTableError(
        tableMissing
          ? "Supplier payments table is missing. Run supabase/add_supplier_payments.sql in Supabase SQL Editor."
          : "Could not load supplier payments right now."
      );
      setSupplierPayments([]);
      return;
    }

    setPaymentTableError(null);
    const mapped: SupplierPayment[] = (data || []).map((row: any) => ({
      id: row.id,
      purchaseId: row.purchase_id || undefined,
      repairId: row.repair_id || undefined,
      partName: row.part_name || undefined,
      supplierName: row.supplier_name,
      amount: Number(row.amount) || 0,
      paymentMethod: row.payment_method as PaymentMethod,
      paymentDate: new Date(row.payment_date),
      notes: row.notes || undefined,
      recordedBy: row.recorded_by || undefined,
    }));
    setSupplierPayments(mapped);
  }, [isAdmin]);

  useEffect(() => {
    loadSupplierPayments();
  }, [loadSupplierPayments]);

  const getPurchasePaymentInfo = useCallback((purchaseId: string, purchaseTotal: number) => {
    const purchasePayments = supplierPayments.filter((p) => p.purchaseId === purchaseId);
    const paidAmount = purchasePayments.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, purchaseTotal - paidAmount);
    const status: 'pending' | 'partial' | 'fully_paid' =
      paidAmount <= 0 ? 'pending' : balance > 0 ? 'partial' : 'fully_paid';
    return { purchasePayments, paidAmount, balance, status };
  }, [supplierPayments]);

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: "",
      method: "mpesa",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const resetBulkRepairPaymentForm = () => {
    setBulkRepairPaymentForm({
      amount: "",
      method: "mpesa",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const handleRecordPayment = async (purchase: Purchase) => {
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const { balance } = getPurchasePaymentInfo(purchase.id, purchase.total);
    if (amount > balance) {
      alert(`Amount cannot be greater than outstanding balance (KES ${balance.toLocaleString()}).`);
      return;
    }

    if (!paymentForm.paymentDate) {
      alert("Please select the payment date.");
      return;
    }

    const { error } = await supabase.from("supplier_payments").insert({
      purchase_id: purchase.id,
      supplier_name: purchase.supplier,
      amount,
      payment_method: paymentForm.method,
      payment_date: new Date(paymentForm.paymentDate).toISOString(),
      notes: paymentForm.notes.trim() || null,
      recorded_by: currentUser?.name || "Admin",
    });

    if (error) {
      alert("Failed to save payment. Please try again.");
      console.error("Error recording supplier payment:", error);
      return;
    }

    await loadSupplierPayments();
    setActivePaymentPurchaseId(null);
    resetPaymentForm();
  };

  const getRepairPartPaymentInfo = useCallback((repairId: string, partName: string, totalCost: number) => {
    const partPayments = supplierPayments.filter(
      (p) => p.repairId === repairId && p.partName === partName
    );
    const paidAmount = partPayments.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, totalCost - paidAmount);
    const status: 'pending' | 'partial' | 'fully_paid' =
      paidAmount <= 0 ? 'pending' : balance > 0 ? 'partial' : 'fully_paid';
    return { partPayments, paidAmount, balance, status };
  }, [supplierPayments]);

  const handleRecordRepairPartPayment = async (record: { repairId: string; partName: string; cost: number; staffName: string }, supplierName: string) => {
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const { balance } = getRepairPartPaymentInfo(record.repairId, record.partName, record.cost);
    if (amount > balance) {
      alert(`Amount cannot be greater than outstanding balance (KES ${balance.toLocaleString()}).`);
      return;
    }

    if (!paymentForm.paymentDate) {
      alert("Please select the payment date.");
      return;
    }

    const { error } = await supabase.from("supplier_payments").insert({
      repair_id: record.repairId,
      part_name: record.partName,
      supplier_name: supplierName,
      amount,
      payment_method: paymentForm.method,
      payment_date: new Date(paymentForm.paymentDate).toISOString(),
      notes: paymentForm.notes.trim() || null,
      recorded_by: currentUser?.name || "Admin",
    });

    if (error) {
      alert("Failed to save payment. Please try again.");
      console.error("Error recording repair part payment:", error);
      return;
    }

    await loadSupplierPayments();
    setActivePaymentRepairKey(null);
    resetPaymentForm();
  };

  const handleRecordBulkRepairPayment = async (
    supplier: { id: string; name: string },
    partsTaken: Array<{ repairId: string; partName: string; cost: number; date: Date }>
  ) => {
    const amount = Number(bulkRepairPaymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid cumulative payment amount.");
      return;
    }
    if (!bulkRepairPaymentForm.paymentDate) {
      alert("Please select the payment date.");
      return;
    }

    const outstandingRecords = partsTaken
      .map((record) => {
        const info = getRepairPartPaymentInfo(record.repairId, record.partName, record.cost);
        return { ...record, balance: info.balance };
      })
      .filter((record) => record.balance > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalOutstanding = outstandingRecords.reduce((sum, record) => sum + record.balance, 0);
    if (totalOutstanding <= 0) {
      alert("No outstanding supplier spare balance for this supplier.");
      return;
    }
    if (amount > totalOutstanding) {
      alert(`Amount cannot exceed outstanding supplier spare balance (KES ${totalOutstanding.toLocaleString()}).`);
      return;
    }

    let remaining = amount;
    const inserts: Array<{
      repair_id: string;
      part_name: string;
      supplier_name: string;
      amount: number;
      payment_method: PaymentMethod;
      payment_date: string;
      notes: string | null;
      recorded_by: string;
    }> = [];

    for (const record of outstandingRecords) {
      if (remaining <= 0) break;
      const payAmount = Math.min(record.balance, remaining);
      if (payAmount <= 0) continue;
      inserts.push({
        repair_id: record.repairId,
        part_name: record.partName,
        supplier_name: supplier.name,
        amount: payAmount,
        payment_method: bulkRepairPaymentForm.method,
        payment_date: new Date(bulkRepairPaymentForm.paymentDate).toISOString(),
        notes: bulkRepairPaymentForm.notes.trim()
          ? `[Bulk repair spare payment] ${bulkRepairPaymentForm.notes.trim()}`
          : "[Bulk repair spare payment]",
        recorded_by: currentUser?.name || "Admin",
      });
      remaining -= payAmount;
    }

    if (inserts.length === 0) {
      alert("No outstanding records found to allocate this payment.");
      return;
    }

    const { error } = await supabase.from("supplier_payments").insert(inserts);
    if (error) {
      alert("Failed to save cumulative payment. Please try again.");
      console.error("Error recording cumulative supplier spare payment:", error);
      return;
    }

    await loadSupplierPayments();
    setActiveBulkRepairPaymentSupplierId(null);
    resetBulkRepairPaymentForm();
  };

  const supplierData = useMemo(() => {
    const inventoryCategoryByName = new Map(
      inventoryItems.map((item) => [item.name.toLowerCase(), item.category])
    );
    const shopNameById = new Map(shops.map((shop) => [shop.id, shop.name]));
    const relevantRepairs = isAdmin
      ? repairs
      : repairs.filter((repair) => repair.shopId === currentUser?.shopId);

    return visibleSuppliers.map(supplier => {
      // Purchases from this supplier
      const supplierPurchases = purchases.filter(p =>
        p.supplier.toLowerCase() === supplier.name.toLowerCase()
      );
      const totalPurchaseCost = supplierPurchases.reduce((sum, p) => sum + p.total, 0);
      const purchaseItemBreakdown: Record<string, { qty: number; totalCost: number }> = {};
      let accessoryPurchaseCost = 0;
      supplierPurchases.forEach(purchase => {
        purchase.items.forEach(item => {
          if (!purchaseItemBreakdown[item.itemName]) {
            purchaseItemBreakdown[item.itemName] = { qty: 0, totalCost: 0 };
          }
          purchaseItemBreakdown[item.itemName].qty += item.qty;
          const itemTotalCost = item.qty * item.costPrice;
          purchaseItemBreakdown[item.itemName].totalCost += itemTotalCost;
          const invCategory = inventoryCategoryByName.get(item.itemName.toLowerCase());
          if (invCategory === 'Accessory') {
            accessoryPurchaseCost += itemTotalCost;
          }
        });
      });

      // Parts taken from this supplier (outsourced parts used in repairs)
      const partsTaken: Array<{
        repairId: string;
        date: Date;
        shopId?: string;
        shopName: string;
        staffName: string;
        customerName: string;
        phoneModel: string;
        issue: string;
        partName: string;
        qty: number;
        cost: number;
        ticketNumber?: string;
        status: string;
      }> = [];

      relevantRepairs.forEach(repair => {
        const shopName = repair.shopId ? (shopNameById.get(repair.shopId) || repair.shopId) : 'Unassigned';
        const fromThisSupplier = repair.partsUsed.filter(p =>
          p.supplierName?.toLowerCase() === supplier.name.toLowerCase() ||
          (p.source === 'outsourced' && p.supplierName?.toLowerCase() === supplier.name.toLowerCase())
        );
        fromThisSupplier.forEach(part => {
          partsTaken.push({
            repairId: repair.id,
            date: repair.date,
            shopId: repair.shopId,
            shopName,
            staffName: repair.technician || 'Unknown',
            customerName: repair.customerName,
            phoneModel: repair.phoneModel,
            issue: repair.issue,
            partName: part.itemName,
            qty: part.qty,
            cost: part.cost * part.qty,
            ticketNumber: repair.ticketNumber,
            status: repair.status,
          });
        });

        // Also check additional outsourced items
        if (repair.additionalItems) {
          repair.additionalItems
            .filter(item =>
              item.source === 'outsourced' &&
              item.supplierName?.toLowerCase() === supplier.name.toLowerCase()
            )
            .forEach(item => {
              const alreadyListed = fromThisSupplier.some(p => p.itemName === item.itemName);
              if (!alreadyListed) {
                const partInParts = repair.partsUsed.find(p => p.itemName === item.itemName);
                partsTaken.push({
                  repairId: repair.id,
                  date: repair.date,
                  shopId: repair.shopId,
                  shopName,
                  staffName: repair.technician || 'Unknown',
                  customerName: repair.customerName,
                  phoneModel: repair.phoneModel,
                  issue: repair.issue,
                  partName: item.itemName,
                  qty: 1,
                  cost: partInParts ? partInParts.cost : 0,
                  ticketNumber: repair.ticketNumber,
                  status: repair.status,
                });
              }
            });
        }
      });

      partsTaken.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totalPartsCost = partsTaken.reduce((sum, p) => sum + p.cost, 0);
      const repairCostByShop = Object.entries(
        partsTaken.reduce<Record<string, number>>((acc, part) => {
          const key = part.shopName;
          acc[key] = (acc[key] || 0) + part.cost;
          return acc;
        }, {})
      )
        .map(([shopName, totalCost]) => ({ shopName, totalCost }))
        .sort((a, b) => b.totalCost - a.totalCost);
      const repairCostByStaff = Object.entries(
        partsTaken.reduce<Record<string, number>>((acc, part) => {
          const key = part.staffName || 'Unknown';
          acc[key] = (acc[key] || 0) + part.cost;
          return acc;
        }, {})
      )
        .map(([staffName, totalCost]) => ({ staffName, totalCost }))
        .sort((a, b) => b.totalCost - a.totalCost);

      return {
        supplier,
        supplierPurchases,
        totalPurchaseCost,
        accessoryPurchaseCost,
        purchaseItemBreakdown,
        partsTaken,
        repairCostByShop,
        repairCostByStaff,
        totalPartsCost,
        grandTotal: totalPurchaseCost + totalPartsCost,
      };
    });
  }, [inventoryItems, visibleSuppliers, purchases, repairs, shops, isAdmin, currentUser?.shopId]);

  const overallStats = useMemo(() => {
    const totalPurchases = supplierData.reduce((sum, d) => sum + d.totalPurchaseCost, 0);
    const totalAccessoriesCost = supplierData.reduce((sum, d) => sum + d.accessoryPurchaseCost, 0);
    const totalPartsCost = supplierData.reduce((sum, d) => sum + d.totalPartsCost, 0);
    const totalOrders = supplierData.reduce((sum, d) => sum + d.supplierPurchases.length, 0);
    const totalPartsTaken = supplierData.reduce((sum, d) => sum + d.partsTaken.length, 0);
    const totalPaidToSuppliers = supplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const grandTotal = totalPurchases + totalPartsCost;
    const totalOutstandingSupplierBalance = Math.max(0, grandTotal - totalPaidToSuppliers);
    return {
      totalPurchases,
      totalAccessoriesCost,
      totalRepairSupplierCost: totalPartsCost,
      totalPartsCost,
      totalOrders,
      totalPartsTaken,
      totalPaidToSuppliers,
      totalOutstandingSupplierBalance,
      grandTotal,
    };
  }, [supplierData, supplierPayments]);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatPaymentMethod = (method: PaymentMethod) => {
    if (method === "mpesa") return "M-Pesa";
    if (method === "bank") return "Bank";
    if (method === "cash") return "Cash";
    return "Other";
  };

  return (
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Suppliers</p>
          <h2 className="pm-page-title">Supplier Management</h2>
          <p className="pm-page-desc">Manage suppliers, costs, and supplier payment tracking.</p>
        </div>
        <button onClick={handleAdd} className="pm-btn pm-btn-primary">Add Supplier</button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="pm-card pm-pad-lg">
          <h3 className="text-lg font-semibold mb-4">{editingId ? "Edit Supplier" : "Add New Supplier"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="pm-label">Supplier Name <span className="text-red-500">*</span></label>
              <input type="text" className="pm-input" placeholder="Enter supplier name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label className="pm-label">Phone</label>
              <input type="tel" className="pm-input" placeholder="+254712345678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div>
              <label className="pm-label">Email</label>
              <input type="email" className="pm-input" placeholder="supplier@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <label className="pm-label">Address</label>
              <input type="text" className="pm-input" placeholder="Supplier address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="pm-label">Categories <span className="text-red-500">*</span></label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" checked={formData.categories.includes('accessories')} onChange={(e) => { setFormData({ ...formData, categories: e.target.checked ? [...formData.categories, 'accessories'] : formData.categories.filter(c => c !== 'accessories') }); }} />
                  <span>Accessories</span>
                </label>
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2" checked={formData.categories.includes('spare_parts')} onChange={(e) => { setFormData({ ...formData, categories: e.target.checked ? [...formData.categories, 'spare_parts'] : formData.categories.filter(c => c !== 'spare_parts') }); }} />
                  <span>Spare Parts</span>
                </label>
              </div>
            </div>
            {isAdmin && (
              <div>
                <label className="pm-label">Supplier type</label>
                <select className="pm-input" value={formData.supplierType} onChange={(e) => setFormData({ ...formData, supplierType: e.target.value as SupplierType })} aria-label="Supplier type">
                  <option value="local">Local (visible to staff)</option>
                  <option value="wholesale">Wholesale (admin only)</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-4">
            <button onClick={handleSave} className="pm-btn pm-btn-primary">Save</button>
            <button onClick={handleCancel} className="pm-btn pm-btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Overall Summary - Staff see only Parts Taken and Active Suppliers; Admin sees all */}
      <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-2'}`}>
        {isAdmin && (
          <div className="pm-card pm-pad border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Total Supplier Purchases</p>
            <p className="text-2xl font-bold text-blue-700">KES {overallStats.totalPurchases.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{overallStats.totalOrders} purchase orders</p>
          </div>
        )}
        <div className="pm-card pm-pad border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Repair Supplier Cost</p>
          <p className="text-2xl font-bold text-orange-700">KES {overallStats.totalRepairSupplierCost.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{overallStats.totalPartsTaken} outsourced parts used in repairs</p>
        </div>
        {isAdmin && (
          <div className="pm-card pm-pad border-l-4 border-emerald-500">
            <p className="text-sm text-gray-600">Accessories Supplier Cost</p>
            <p className="text-2xl font-bold text-emerald-700">KES {overallStats.totalAccessoriesCost.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Accessory purchases only</p>
          </div>
        )}
        <div className="pm-card pm-pad border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Active Suppliers</p>
          <p className="text-2xl font-bold text-purple-700">{visibleSuppliers.length}</p>
          <p className="text-xs text-gray-500">
            {visibleSuppliers.filter(s => s.categories.includes('spare_parts')).length} spare parts,{' '}
            {visibleSuppliers.filter(s => s.categories.includes('accessories')).length} accessories
          </p>
        </div>
        {isAdmin && (
          <div className="pm-card pm-pad border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Outstanding Supplier Balance</p>
            <p className="text-2xl font-bold text-red-700">KES {overallStats.totalOutstandingSupplierBalance.toLocaleString()}</p>
            <p className="text-xs text-gray-500">
              Paid so far: KES {overallStats.totalPaidToSuppliers.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Supplier Records - Staff see only Parts Taken; Admin sees All / Purchases / Parts Taken */}
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-2">Supplier Records</h3>
        <p className="text-sm text-gray-600 mb-4">
          {isAdmin
            ? 'Track purchases from suppliers and outsourced spare parts taken by staff for repairs.'
            : 'Outsourced parts you have used in repairs. Fill in cost in Cost of Parts so amounts show here.'}
        </p>
        {paymentTableError && isAdmin && (
          <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
            {paymentTableError}
          </div>
        )}

        {isAdmin && (
          <div className="flex gap-2 mb-4 border-b pb-2">
            {(['all', 'purchases', 'parts_taken'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-t text-sm font-medium ${
                  activeTab === tab ? 'bg-[var(--pm-accent)] text-white' : 'bg-[var(--pm-surface-soft)] text-[var(--pm-ink-soft)] hover:text-[var(--pm-ink)]'
                }`}
              >
                {tab === 'all' ? 'All Records' : tab === 'purchases' ? 'Purchases' : 'Parts Taken'}
              </button>
            ))}
          </div>
        )}

        {supplierData.filter(d => isAdmin ? (d.supplierPurchases.length > 0 || d.partsTaken.length > 0) : d.partsTaken.length > 0).length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg font-medium mb-2">{isAdmin ? 'No supplier transactions yet' : 'No outsourced parts taken yet'}</p>
            <p className="text-sm">{isAdmin ? 'Purchase orders and outsourced parts records will appear here.' : 'When you use outsourced parts in repairs and fill in their cost in Cost of Parts, they will appear here.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {supplierData
              .filter(d => isAdmin ? (d.supplierPurchases.length > 0 || d.partsTaken.length > 0) : d.partsTaken.length > 0)
              .map((data) => {
                const isExpanded = expandedSupplierId === data.supplier.id;
                const showPurchases = isAdmin && (activeTab === 'all' || activeTab === 'purchases');
                const showParts = activeTab === 'all' || activeTab === 'parts_taken';
                const hasPurchases = data.supplierPurchases.length > 0;
                const hasParts = data.partsTaken.length > 0;

                if (isAdmin && ((activeTab === 'purchases' && !hasPurchases) || (activeTab === 'parts_taken' && !hasParts))) {
                  return null;
                }

                return (
                  <div key={data.supplier.id} className="border border-[var(--pm-border)] rounded-lg overflow-hidden">
                    <div
                      className="p-4 bg-[var(--pm-surface-soft)] cursor-pointer hover:bg-[var(--pm-surface)] transition"
                      onClick={() => setExpandedSupplierId(isExpanded ? null : data.supplier.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                          <div>
                            <h4 className="font-bold text-lg">{data.supplier.name}</h4>
                            <div className="flex gap-1 mt-1">
                              {data.supplier.categories.map(cat => (
                                <span key={cat} className={`px-2 py-0.5 text-xs rounded ${cat === 'spare_parts' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                  {cat === 'spare_parts' ? 'Spare Parts' : 'Accessories'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-6 text-sm">
                          {isAdmin && hasPurchases && (
                            <div className="text-right">
                              <p className="text-[var(--pm-ink-soft)]">Purchases</p>
                              <p className="font-bold text-blue-700">KES {data.totalPurchaseCost.toLocaleString()}</p>
                              <p className="text-xs text-[var(--pm-ink-soft)]">{data.supplierPurchases.length} orders</p>
                            </div>
                          )}
                          {isAdmin && (
                            <div className="text-right">
                              <p className="text-[var(--pm-ink-soft)]">Accessories Cost</p>
                              <p className="font-bold text-emerald-700">KES {data.accessoryPurchaseCost.toLocaleString()}</p>
                              <p className="text-xs text-[var(--pm-ink-soft)]">Accessory purchases</p>
                            </div>
                          )}
                          {hasParts && (
                            <div className="text-right">
                              <p className="text-[var(--pm-ink-soft)]">Repair Supplier Cost</p>
                              <p className="font-bold text-orange-700">KES {data.totalPartsCost.toLocaleString()}</p>
                              <p className="text-xs text-[var(--pm-ink-soft)]">{data.partsTaken.length} parts</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 space-y-4">
                        {/* Purchase Orders */}
                        {showPurchases && hasPurchases && (
                          <div>
                            <h5 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                              <span className="w-3 h-3 bg-blue-500 rounded-full inline-block"></span>
                              Purchase Orders ({data.supplierPurchases.length})
                            </h5>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-blue-50">
                                  <tr>
                                    <th className="p-2 text-left">Date</th>
                                    <th className="p-2 text-left">Items</th>
                                    <th className="p-2 text-right">Total Qty</th>
                                    <th className="p-2 text-right">Total Cost</th>
                                    <th className="p-2 text-right">Paid</th>
                                    <th className="p-2 text-right">Balance</th>
                                    <th className="p-2 text-center">Payment Status</th>
                                    {currentUser?.roles.includes('admin') && <th className="p-2 text-center">Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.supplierPurchases.map((purchase: Purchase) => {
                                    const paymentInfo = getPurchasePaymentInfo(purchase.id, purchase.total);
                                    const isPaymentFormOpen = activePaymentPurchaseId === purchase.id;
                                    const paymentBadgeClass =
                                      paymentInfo.status === 'fully_paid'
                                        ? 'bg-green-100 text-green-800'
                                        : paymentInfo.status === 'partial'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-yellow-100 text-yellow-800';
                                    const paymentBadgeText =
                                      paymentInfo.status === 'fully_paid'
                                        ? 'Fully Paid'
                                        : paymentInfo.status === 'partial'
                                          ? 'Partially Paid'
                                          : 'Unpaid';

                                    return (
                                      <Fragment key={purchase.id}>
                                        <tr className="border-t hover:bg-blue-50/50">
                                          <td className="p-2">{formatDate(purchase.date)}</td>
                                          <td className="p-2">
                                            <div className="space-y-1">
                                              {purchase.items.map((item, idx) => (
                                                <div key={idx} className="text-xs">
                                                  <span className="font-medium">{item.itemName}</span>
                                                  <span className="text-gray-500"> x{item.qty} @ KES {item.costPrice.toLocaleString()}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="p-2 text-right font-medium">
                                            {purchase.items.reduce((s, i) => s + i.qty, 0)}
                                          </td>
                                          <td className="p-2 text-right font-bold">KES {purchase.total.toLocaleString()}</td>
                                          <td className="p-2 text-right text-green-700 font-semibold">
                                            KES {paymentInfo.paidAmount.toLocaleString()}
                                          </td>
                                          <td className="p-2 text-right text-red-700 font-semibold">
                                            KES {paymentInfo.balance.toLocaleString()}
                                          </td>
                                          <td className="p-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${paymentBadgeClass}`}>
                                              {paymentBadgeText}
                                            </span>
                                          </td>
                                          {isAdmin && (
                                            <td className="p-2 text-center">
                                              <div className="flex items-center justify-center gap-2">
                                                {isPaymentFormOpen ? (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePaymentPurchaseId(null);
                                                      resetPaymentForm();
                                                    }}
                                                    className="text-gray-700 hover:text-gray-900 text-xs font-semibold hover:bg-gray-100 px-2 py-1 rounded"
                                                  >
                                                    Cancel Payment
                                                  </button>
                                                ) : (
                                                  <>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActivePaymentPurchaseId(purchase.id);
                                                        setPaymentForm({
                                                          amount: paymentInfo.balance.toString(),
                                                          method: "mpesa",
                                                          paymentDate: new Date().toISOString().slice(0, 10),
                                                          notes: "Full supplier payment",
                                                        });
                                                      }}
                                                      disabled={paymentInfo.balance <= 0}
                                                      className="text-green-700 hover:text-green-900 text-xs font-semibold hover:bg-green-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                      Confirm Full Payment
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActivePaymentPurchaseId(purchase.id);
                                                        resetPaymentForm();
                                                      }}
                                                      disabled={paymentInfo.balance <= 0}
                                                      className="text-orange-700 hover:text-orange-900 text-xs font-semibold hover:bg-orange-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                      Partial Payment
                                                    </button>
                                                  </>
                                                )}
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setPaymentHistoryPurchase(purchase);
                                                }}
                                                className="text-blue-700 hover:text-blue-900 text-xs font-semibold hover:bg-blue-50 px-2 py-1 rounded"
                                              >
                                                History ({paymentInfo.purchasePayments.length})
                                              </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm(`Delete this purchase of KES ${purchase.total.toLocaleString()} from ${data.supplier.name}?`)) {
                                                      deletePurchase(purchase.id);
                                                    }
                                                  }}
                                                  className="text-red-600 hover:text-red-800 text-xs font-semibold hover:bg-red-50 px-2 py-1 rounded"
                                                >
                                                  Delete
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                        {isAdmin && isPaymentFormOpen && (
                                          <tr className="bg-green-50/40 border-t">
                                            <td className="p-3" colSpan={8}>
                                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (KES)</label>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    aria-label="Payment amount in Kenya shillings"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.amount}
                                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                                                    placeholder={`Max ${paymentInfo.balance.toLocaleString()}`}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                                                  <select
                                                    aria-label="Payment method"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.method}
                                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))}
                                                  >
                                                    <option value="mpesa">M-Pesa</option>
                                                    <option value="bank">Bank</option>
                                                    <option value="cash">Cash</option>
                                                    <option value="other">Other</option>
                                                  </select>
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                                                  <input
                                                    type="date"
                                                    aria-label="Date the supplier was paid"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.paymentDate}
                                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (Optional)</label>
                                                  <input
                                                    type="text"
                                                    aria-label="Payment notes"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.notes}
                                                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                                                    placeholder="Txn code, bank ref, etc."
                                                  />
                                                </div>
                                                <div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleRecordPayment(purchase);
                                                    }}
                                                    className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 w-full"
                                                  >
                                                    Confirm Payment
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="mt-2 text-xs text-gray-600">
                                                Use Partial Payment for amount less than balance, or Confirm Full Payment to clear balance in one step.
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="bg-blue-50 font-semibold">
                                  <tr>
                                    <td className="p-2" colSpan={3}>Total Purchases</td>
                                    <td className="p-2 text-right text-blue-800">KES {data.totalPurchaseCost.toLocaleString()}</td>
                                    <td className="p-2 text-right text-green-800">
                                      KES {data.supplierPurchases.reduce((sum, purchase) => {
                                        return sum + getPurchasePaymentInfo(purchase.id, purchase.total).paidAmount;
                                      }, 0).toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right text-red-800">
                                      KES {data.supplierPurchases.reduce((sum, purchase) => {
                                        return sum + getPurchasePaymentInfo(purchase.id, purchase.total).balance;
                                      }, 0).toLocaleString()}
                                    </td>
                                    <td></td>
                                    {currentUser?.roles.includes('admin') && <td></td>}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {Object.keys(data.purchaseItemBreakdown).length > 0 && (
                              <div className="mt-3 bg-blue-50/50 rounded p-3">
                                <p className="text-xs font-semibold text-blue-800 mb-2">Item Summary:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {Object.entries(data.purchaseItemBreakdown).map(([name, info]) => (
                                    <div key={name} className="bg-white rounded p-2 text-xs border">
                                      <p className="font-semibold truncate" title={name}>{name}</p>
                                      <p className="text-gray-600">Qty: {info.qty} | KES {info.totalCost.toLocaleString()}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Parts Taken (Outsourced spare parts used in repairs) - Staff: list + prices + total only; Admin: full with payments */}
                        {showParts && hasParts && (
                          <div>
                            <h5 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                              <span className="w-3 h-3 bg-orange-500 rounded-full inline-block"></span>
                              Parts Taken for Repairs ({data.partsTaken.length})
                            </h5>
                            {isAdmin && (
                              <div className="mb-3 border rounded p-3 bg-orange-50/40">
                                {(() => {
                                  const supplierRepairPaid = data.partsTaken.reduce(
                                    (sum, record) => sum + getRepairPartPaymentInfo(record.repairId, record.partName, record.cost).paidAmount,
                                    0
                                  );
                                  const supplierRepairBalance = data.partsTaken.reduce(
                                    (sum, record) => sum + getRepairPartPaymentInfo(record.repairId, record.partName, record.cost).balance,
                                    0
                                  );
                                  const isBulkFormOpen = activeBulkRepairPaymentSupplierId === data.supplier.id;
                                  return (
                                    <>
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="text-xs">
                                          <span className="font-semibold text-green-700">Paid: KES {supplierRepairPaid.toLocaleString()}</span>
                                          <span className="mx-2 text-gray-400">|</span>
                                          <span className="font-semibold text-red-700">Outstanding: KES {supplierRepairBalance.toLocaleString()}</span>
                                        </div>
                                        <div className="flex gap-2">
                                          {isBulkFormOpen ? (
                                            <button
                                              onClick={() => {
                                                setActiveBulkRepairPaymentSupplierId(null);
                                                resetBulkRepairPaymentForm();
                                              }}
                                              className="text-gray-700 hover:text-gray-900 text-xs font-semibold hover:bg-gray-100 px-2 py-1 rounded"
                                            >
                                              Cancel
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => {
                                                  setActiveBulkRepairPaymentSupplierId(data.supplier.id);
                                                  setBulkRepairPaymentForm({
                                                    amount: supplierRepairBalance.toString(),
                                                    method: "mpesa",
                                                    paymentDate: new Date().toISOString().slice(0, 10),
                                                    notes: "Bulk full payment for supplier repair spares",
                                                  });
                                                }}
                                                disabled={supplierRepairBalance <= 0}
                                                className="text-green-700 hover:text-green-900 text-xs font-semibold hover:bg-green-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                              >
                                                Confirm Full (All Spares)
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setActiveBulkRepairPaymentSupplierId(data.supplier.id);
                                                  resetBulkRepairPaymentForm();
                                                }}
                                                disabled={supplierRepairBalance <= 0}
                                                className="text-orange-700 hover:text-orange-900 text-xs font-semibold hover:bg-orange-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                              >
                                                Partial Cumulative Payment
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {isBulkFormOpen && (
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mt-3">
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Amount (KES)</label>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              className="pm-input py-1.5 text-sm"
                                              value={bulkRepairPaymentForm.amount}
                                              onChange={(e) => setBulkRepairPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                                              placeholder={`Max ${supplierRepairBalance.toLocaleString()}`}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                                            <select
                                              className="pm-input py-1.5 text-sm"
                                              value={bulkRepairPaymentForm.method}
                                              onChange={(e) => setBulkRepairPaymentForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))}
                                            >
                                              <option value="mpesa">M-Pesa</option>
                                              <option value="bank">Bank</option>
                                              <option value="cash">Cash</option>
                                              <option value="other">Other</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                                            <input
                                              type="date"
                                              className="pm-input py-1.5 text-sm"
                                              value={bulkRepairPaymentForm.paymentDate}
                                              onChange={(e) => setBulkRepairPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (Optional)</label>
                                            <input
                                              type="text"
                                              className="pm-input py-1.5 text-sm"
                                              value={bulkRepairPaymentForm.notes}
                                              onChange={(e) => setBulkRepairPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                                              placeholder="Reference / reason"
                                            />
                                          </div>
                                          <div>
                                            <button
                                              onClick={() => handleRecordBulkRepairPayment(
                                                { id: data.supplier.id, name: data.supplier.name },
                                                data.partsTaken.map((record) => ({
                                                  repairId: record.repairId,
                                                  partName: record.partName,
                                                  cost: record.cost,
                                                  date: record.date,
                                                }))
                                              )}
                                              className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 w-full"
                                            >
                                              Confirm Cumulative Payment
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-orange-50">
                                  <tr>
                                    <th className="p-2 text-left">Date</th>
                                    {isAdmin && <th className="p-2 text-left">Shop</th>}
                                    <th className="p-2 text-left">Staff</th>
                                    <th className="p-2 text-left">Customer</th>
                                    <th className="p-2 text-left">Part Name</th>
                                    <th className="p-2 text-right">Cost</th>
                                    {isAdmin && (
                                      <>
                                        <th className="p-2 text-right">Paid</th>
                                        <th className="p-2 text-right">Balance</th>
                                        <th className="p-2 text-center">Payment Status</th>
                                        <th className="p-2 text-center">Actions</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.partsTaken.map((record, idx) => {
                                    const repairKey = `${record.repairId}-${record.partName}`;
                                    const rpInfo = getRepairPartPaymentInfo(record.repairId, record.partName, record.cost);
                                    const isRepairPaymentOpen = activePaymentRepairKey === repairKey;
                                    const rpBadgeClass =
                                      rpInfo.status === 'fully_paid' ? 'bg-green-100 text-green-800' :
                                      rpInfo.status === 'partial' ? 'bg-orange-100 text-orange-800' :
                                      'bg-yellow-100 text-yellow-800';
                                    const rpBadgeText =
                                      rpInfo.status === 'fully_paid' ? 'Fully Paid' :
                                      rpInfo.status === 'partial' ? 'Partially Paid' : 'Unpaid';

                                    return (
                                      <Fragment key={`${repairKey}-${idx}`}>
                                        <tr className="border-t hover:bg-orange-50/50">
                                          <td className="p-2">
                                            {formatDate(record.date)}
                                          </td>
                                          {isAdmin && (
                                            <td className="p-2">
                                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-medium">
                                                {record.shopName}
                                              </span>
                                            </td>
                                          )}
                                          <td className="p-2">
                                            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded font-medium">
                                              {record.staffName}
                                            </span>
                                          </td>
                                          <td className="p-2">
                                            <div className="font-medium">{record.customerName}</div>
                                            <div className="text-xs text-gray-500">{record.phoneModel}</div>
                                            {record.ticketNumber && (
                                              <div className="text-xs text-gray-400 font-mono">{record.ticketNumber}</div>
                                            )}
                                          </td>
                                          <td className="p-2">
                                            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-medium">
                                              {record.partName}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-1">x{record.qty}</span>
                                          </td>
                                          <td className="p-2 text-right font-bold">
                                            {record.cost > 0
                                              ? <span className="text-red-600">KES {record.cost.toLocaleString()}</span>
                                              : <span className="text-yellow-600 text-xs">Pending</span>
                                            }
                                          </td>
                                          {isAdmin && (
                                            <>
                                              <td className="p-2 text-right text-green-700 font-semibold">
                                                KES {rpInfo.paidAmount.toLocaleString()}
                                              </td>
                                              <td className="p-2 text-right text-red-700 font-semibold">
                                                KES {rpInfo.balance.toLocaleString()}
                                              </td>
                                              <td className="p-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${rpBadgeClass}`}>
                                                  {rpBadgeText}
                                                </span>
                                              </td>
                                              <td className="p-2 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActivePaymentRepairKey(repairKey);
                                                      setPaymentForm({
                                                        amount: rpInfo.balance.toString(),
                                                        method: "mpesa",
                                                        paymentDate: new Date().toISOString().slice(0, 10),
                                                        notes: "Full supplier payment",
                                                      });
                                                    }}
                                                    disabled={rpInfo.balance <= 0}
                                                    className="text-green-700 hover:text-green-900 text-xs font-semibold hover:bg-green-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                                  >
                                                    Confirm Full Payment
                                                  </button>
                                                  {isRepairPaymentOpen ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActivePaymentRepairKey(null);
                                                        resetPaymentForm();
                                                      }}
                                                      className="text-gray-700 hover:text-gray-900 text-xs font-semibold hover:bg-gray-100 px-2 py-1 rounded"
                                                    >
                                                      Cancel
                                                    </button>
                                                  ) : (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActivePaymentRepairKey(repairKey);
                                                        resetPaymentForm();
                                                      }}
                                                      disabled={rpInfo.balance <= 0}
                                                      className="text-orange-700 hover:text-orange-900 text-xs font-semibold hover:bg-orange-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                      Partial Payment
                                                    </button>
                                                  )}
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setPaymentHistoryRepairKey({
                                                        repairId: record.repairId,
                                                        partName: record.partName,
                                                        supplierName: data.supplier.name,
                                                        cost: record.cost,
                                                      });
                                                    }}
                                                    className="text-blue-700 hover:text-blue-900 text-xs font-semibold hover:bg-blue-50 px-2 py-1 rounded"
                                                  >
                                                    History ({rpInfo.partPayments.length})
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (window.confirm(`Delete repair for ${record.customerName} (${record.phoneModel})?`)) {
                                                        deleteRepair(record.repairId);
                                                      }
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-xs font-semibold hover:bg-red-50 px-2 py-1 rounded"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </td>
                                            </>
                                          )}
                                        </tr>
                                        {isAdmin && isRepairPaymentOpen && (
                                          <tr className="bg-green-50/40 border-t">
                                            <td className="p-3" colSpan={10}>
                                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (KES)</label>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    aria-label="Payment amount"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.amount}
                                                    onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                                                    placeholder={`Max ${rpInfo.balance.toLocaleString()}`}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                                                  <select
                                                    aria-label="Payment method"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.method}
                                                    onChange={(e) => setPaymentForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                                                  >
                                                    <option value="mpesa">M-Pesa</option>
                                                    <option value="bank">Bank</option>
                                                    <option value="cash">Cash</option>
                                                    <option value="other">Other</option>
                                                  </select>
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                                                  <input
                                                    type="date"
                                                    aria-label="Payment date"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.paymentDate}
                                                    onChange={(e) => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (Optional)</label>
                                                  <input
                                                    type="text"
                                                    aria-label="Payment notes"
                                                    className="pm-input py-1.5 text-sm"
                                                    value={paymentForm.notes}
                                                    onChange={(e) => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                                                    placeholder="Txn code, ref, etc."
                                                  />
                                                </div>
                                                <div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleRecordRepairPartPayment(record, data.supplier.name);
                                                    }}
                                                    className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 w-full"
                                                  >
                                                    Confirm Payment
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="mt-2 text-xs text-gray-600">
                                                Enter a smaller amount for partial payment, or use Confirm Full Payment button to clear all balance.
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="bg-orange-50 font-semibold">
                                  <tr>
                                    <td className="p-2" colSpan={4}>Total Parts Cost</td>
                                    <td className="p-2 text-right text-orange-800">KES {data.totalPartsCost.toLocaleString()}</td>
                                    {isAdmin && (
                                      <>
                                        <td className="p-2 text-right text-green-800">
                                          KES {data.partsTaken.reduce((s, r) => s + getRepairPartPaymentInfo(r.repairId, r.partName, r.cost).paidAmount, 0).toLocaleString()}
                                        </td>
                                        <td className="p-2 text-right text-red-800">
                                          KES {data.partsTaken.reduce((s, r) => s + getRepairPartPaymentInfo(r.repairId, r.partName, r.cost).balance, 0).toLocaleString()}
                                        </td>
                                        <td></td>
                                        <td></td>
                                      </>
                                    )}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Summary for this supplier - Admin: all; Staff: Parts Taken only */}
                        <div className="bg-[var(--pm-surface-soft)] rounded p-4 border border-[var(--pm-border)]">
                          <h5 className="font-semibold mb-2">Summary: {data.supplier.name}</h5>
                          <div className={`grid grid-cols-1 text-sm ${isAdmin ? 'md:grid-cols-3 gap-4' : ''}`}>
                            {isAdmin && (
                              <div>
                                <p className="text-[var(--pm-ink-soft)]">Purchase Orders</p>
                                <p className="text-lg font-bold text-blue-700">KES {data.totalPurchaseCost.toLocaleString()}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[var(--pm-ink-soft)]">Parts Taken (Outsourced)</p>
                              <p className="text-lg font-bold text-orange-700">KES {data.totalPartsCost.toLocaleString()}</p>
                            </div>
                            {isAdmin && (
                              <div>
                                <p className="text-[var(--pm-ink-soft)]">Grand Total</p>
                                <p className="text-lg font-bold text-red-700">KES {data.grandTotal.toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div>
                                <p className="text-xs font-semibold text-gray-700 mb-2">Repair Supplier Cost by Shop</p>
                                {data.repairCostByShop.length === 0 ? (
                                  <p className="text-xs text-gray-500">No outsourced parts recorded.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {data.repairCostByShop.map((entry) => (
                                      <div key={entry.shopName} className="text-xs flex justify-between">
                                        <span>{entry.shopName}</span>
                                        <span className="font-semibold text-orange-700">KES {entry.totalCost.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-700 mb-2">Repair Supplier Cost by Staff</p>
                                {data.repairCostByStaff.length === 0 ? (
                                  <p className="text-xs text-gray-500">No staff records yet.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {data.repairCostByStaff.map((entry) => (
                                      <div key={entry.staffName} className="text-xs flex justify-between">
                                        <span>{entry.staffName}</span>
                                        <span className="font-semibold text-indigo-700">KES {entry.totalCost.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Suppliers List */}
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-4">All Suppliers</h3>
        {suppliers.length === 0 ? (
          <p className="text-[var(--pm-ink-soft)] text-center py-4">No suppliers added yet.</p>
        ) : (
          <div className="pm-table-shell rounded-none border-x-0 border-b-0 border-t-0 shadow-none">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Address</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Categories</th>
                  {isAdmin ? (
                    <>
                      <th className="p-3 text-right text-sm font-semibold text-gray-700">Accessories Cost</th>
                      <th className="p-3 text-right text-sm font-semibold text-gray-700">Repair Supplier Cost</th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700">Repair Cost by Shop</th>
                    </>
                  ) : (
                    <th className="p-3 text-right text-sm font-semibold text-gray-700">Parts Taken Total</th>
                  )}
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleSuppliers.map((supplier) => {
                  const data = supplierData.find(d => d.supplier.id === supplier.id);
                  return (
                    <tr key={supplier.id} className="border-t border-[var(--pm-border)] hover:bg-[var(--pm-surface-soft)]">
                      <td className="p-3 text-sm font-medium">{supplier.name}</td>
                      <td className="p-3 text-sm text-[var(--pm-ink-soft)]">{supplier.phone || "-"}</td>
                      <td className="p-3 text-sm text-[var(--pm-ink-soft)]">{supplier.email || "-"}</td>
                      <td className="p-3 text-sm text-[var(--pm-ink-soft)]">{supplier.address || "-"}</td>
                      <td className="p-3 text-sm text-[var(--pm-ink-soft)]">
                        <div className="flex flex-wrap gap-1">
                          {supplier.categories.map((cat) => (
                            <span key={cat} className={`px-2 py-1 text-xs rounded ${cat === 'spare_parts' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                              {cat === 'accessories' ? 'Accessories' : 'Spare Parts'}
                            </span>
                          ))}
                        </div>
                      </td>
                      {isAdmin ? (
                        <>
                          <td className="p-3 text-sm text-right font-bold text-emerald-700">
                            KES {(data?.accessoryPurchaseCost || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-sm text-right font-bold text-orange-700">
                            KES {(data?.totalPartsCost || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-sm text-gray-700">
                            {data?.repairCostByShop && data.repairCostByShop.length > 0 ? (
                              <div className="space-y-1">
                                {data.repairCostByShop.slice(0, 2).map((shop) => (
                                  <div key={shop.shopName} className="text-xs">
                                    <span className="font-semibold">{shop.shopName}</span>: KES {shop.totalCost.toLocaleString()}
                                  </div>
                                ))}
                                {data.repairCostByShop.length > 2 && (
                                  <div className="text-xs text-gray-500">+{data.repairCostByShop.length - 2} more shops</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="p-3 text-sm text-right font-bold text-red-700">
                          KES {(data?.totalPartsCost || 0).toLocaleString()}
                        </td>
                      )}
                      <td className="p-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => handleEdit(supplier)} className="text-blue-600 hover:text-blue-800 text-sm">
                            Edit
                          </button>
                          {currentUser?.roles.includes('admin') && (
                            <button onClick={() => handleDelete(supplier.id)} className="text-red-600 hover:text-red-800 text-sm">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paymentHistoryRepairKey && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h4 className="font-bold text-lg">Repair Part Payment History</h4>
                <p className="text-sm text-gray-600">
                  {paymentHistoryRepairKey.supplierName} &mdash; {paymentHistoryRepairKey.partName} (KES {paymentHistoryRepairKey.cost.toLocaleString()})
                </p>
              </div>
              <button onClick={() => setPaymentHistoryRepairKey(null)} className="text-gray-500 hover:text-gray-700">Close</button>
            </div>
            <div className="p-4">
              {(() => {
                const rpInfo = getRepairPartPaymentInfo(paymentHistoryRepairKey.repairId, paymentHistoryRepairKey.partName, paymentHistoryRepairKey.cost);
                const sorted = [...rpInfo.partPayments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
                if (sorted.length === 0) {
                  return <p className="text-sm text-gray-500">No payments recorded yet for this part.</p>;
                }
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded border">
                      <p><span className="text-gray-600">Total:</span> <span className="font-semibold">KES {paymentHistoryRepairKey.cost.toLocaleString()}</span></p>
                      <p><span className="text-gray-600">Paid:</span> <span className="font-semibold text-green-700">KES {rpInfo.paidAmount.toLocaleString()}</span></p>
                      <p><span className="text-gray-600">Balance:</span> <span className="font-semibold text-red-700">KES {rpInfo.balance.toLocaleString()}</span></p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-orange-50">
                          <tr>
                            <th className="p-2 text-left">Payment Date</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2 text-left">Method</th>
                            <th className="p-2 text-left">Recorded By</th>
                            <th className="p-2 text-left">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((payment) => (
                            <tr key={payment.id} className="border-t">
                              <td className="p-2">{formatDate(payment.paymentDate)}</td>
                              <td className="p-2 text-right font-semibold">KES {payment.amount.toLocaleString()}</td>
                              <td className="p-2">{formatPaymentMethod(payment.paymentMethod)}</td>
                              <td className="p-2">{payment.recordedBy || "Admin"}</td>
                              <td className="p-2">{payment.notes || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {paymentHistoryPurchase && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h4 className="font-bold text-lg">Payment History</h4>
                <p className="text-sm text-gray-600">
                  {paymentHistoryPurchase.supplier} - Purchase total: KES {paymentHistoryPurchase.total.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setPaymentHistoryPurchase(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              {(() => {
                const paymentInfo = getPurchasePaymentInfo(paymentHistoryPurchase.id, paymentHistoryPurchase.total);
                const sortedPayments = [...paymentInfo.purchasePayments].sort(
                  (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
                );
                if (sortedPayments.length === 0) {
                  return <p className="text-sm text-gray-500">No payments recorded yet for this purchase.</p>;
                }
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded border">
                      <p><span className="text-gray-600">Total:</span> <span className="font-semibold">KES {paymentHistoryPurchase.total.toLocaleString()}</span></p>
                      <p><span className="text-gray-600">Paid:</span> <span className="font-semibold text-green-700">KES {paymentInfo.paidAmount.toLocaleString()}</span></p>
                      <p><span className="text-gray-600">Balance:</span> <span className="font-semibold text-red-700">KES {paymentInfo.balance.toLocaleString()}</span></p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="p-2 text-left">Payment Date</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2 text-left">Method</th>
                            <th className="p-2 text-left">Recorded By</th>
                            <th className="p-2 text-left">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPayments.map((payment) => (
                            <tr key={payment.id} className="border-t">
                              <td className="p-2">{formatDate(payment.paymentDate)}</td>
                              <td className="p-2 text-right font-semibold">KES {payment.amount.toLocaleString()}</td>
                              <td className="p-2">{formatPaymentMethod(payment.paymentMethod)}</td>
                              <td className="p-2">{payment.recordedBy || "Admin"}</td>
                              <td className="p-2">{payment.notes || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
