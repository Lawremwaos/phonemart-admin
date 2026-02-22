import { useState, useMemo } from "react";
import { useSupplier } from "../context/SupplierContext";
import { useInventory } from "../context/InventoryContext";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";

type Purchase = ReturnType<typeof useInventory>['purchases'][number];

export default function SupplierManagement() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplier();
  const { purchases, deletePurchase } = useInventory();
  const { repairs, deleteRepair } = useRepair();
  const { currentUser } = useShop();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'purchases' | 'repairs' | 'all'>('all');
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    categories: ['spare_parts'] as ('accessories' | 'spare_parts')[],
  });

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ name: "", phone: "", email: "", address: "", categories: ['spare_parts'] });
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
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Please enter supplier name");
      return;
    }
    if (formData.categories.length === 0) {
      alert("Please select at least one category");
      return;
    }

    if (editingId) {
      updateSupplier(editingId, formData);
    } else {
      addSupplier(formData);
    }

    setFormData({ name: "", phone: "", email: "", address: "", categories: ['spare_parts'] });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: "", phone: "", email: "", address: "", categories: ['spare_parts'] });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      deleteSupplier(id);
    }
  };

  // Build comprehensive supplier data from purchases + repairs
  const supplierData = useMemo(() => {
    return suppliers.map(supplier => {
      // --- PURCHASES DATA (Accessories & Spare Parts bought from this supplier) ---
      const supplierPurchases = purchases.filter(p =>
        p.supplier.toLowerCase() === supplier.name.toLowerCase()
      );
      const totalPurchaseCost = supplierPurchases.reduce((sum, p) => sum + p.total, 0);
      const purchaseItemBreakdown: Record<string, { qty: number; totalCost: number; prices: number[] }> = {};
      supplierPurchases.forEach(purchase => {
        purchase.items.forEach(item => {
          if (!purchaseItemBreakdown[item.itemName]) {
            purchaseItemBreakdown[item.itemName] = { qty: 0, totalCost: 0, prices: [] };
          }
          purchaseItemBreakdown[item.itemName].qty += item.qty;
          purchaseItemBreakdown[item.itemName].totalCost += item.qty * item.costPrice;
          purchaseItemBreakdown[item.itemName].prices.push(item.costPrice);
        });
      });

      // --- REPAIR DATA (Parts from this supplier used in repairs) ---
      const repairRecords: Array<{
        repairId: string;
        customerName: string;
        phoneModel: string;
        date: Date;
        issue: string;
        revenue: number;
        partsCost: number;
        profit: number;
        parts: Array<{ itemName: string; qty: number; cost: number }>;
        status: string;
        ticketNumber?: string;
      }> = [];

      repairs.forEach(repair => {
        // Only include parts from this specific supplier
        const supplierParts = repair.partsUsed.filter(p =>
          p.cost > 0 && p.supplierName?.toLowerCase() === supplier.name.toLowerCase()
        );
        if (supplierParts.length === 0) return;

        const revenue = repair.totalAgreedAmount || repair.totalCost;
        const partsCost = supplierParts.reduce((sum, p) => sum + (p.cost * p.qty), 0);
        const profit = revenue - partsCost;

        repairRecords.push({
          repairId: repair.id,
          customerName: repair.customerName,
          phoneModel: repair.phoneModel,
          date: repair.date,
          issue: repair.issue,
          revenue,
          partsCost,
          profit,
          parts: supplierParts.map(p => ({ itemName: p.itemName, qty: p.qty, cost: p.cost })),
          status: repair.status,
          ticketNumber: repair.ticketNumber,
        });
      });

      const totalRepairOutsourcing = repairRecords.length;
      const totalRepairRevenue = repairRecords.reduce((sum, r) => sum + r.revenue, 0);
      const totalRepairCost = repairRecords.reduce((sum, r) => sum + r.partsCost, 0);
      const totalRepairProfit = repairRecords.reduce((sum, r) => sum + r.profit, 0);
      const grandTotal = totalPurchaseCost;

      return {
        supplier,
        // Purchases
        supplierPurchases,
        totalPurchaseCost,
        purchaseItemBreakdown,
        // Repairs
        repairRecords,
        totalRepairOutsourcing,
        totalRepairRevenue,
        totalRepairCost,
        totalRepairProfit,
        // Combined
        grandTotal,
      };
    });
  }, [suppliers, purchases, repairs]);

  // Overall summary stats
  const overallStats = useMemo(() => {
    const totalPurchases = supplierData.reduce((sum, d) => sum + d.totalPurchaseCost, 0);
    const totalRepairRevenue = supplierData.reduce((sum, d) => sum + d.totalRepairRevenue, 0);
    const totalRepairCost = supplierData.reduce((sum, d) => sum + d.totalRepairCost, 0);
    const totalRepairProfit = supplierData.reduce((sum, d) => sum + d.totalRepairProfit, 0);
    const totalOrders = supplierData.reduce((sum, d) => sum + d.supplierPurchases.length, 0);
    const totalRepairJobs = supplierData.reduce((sum, d) => sum + d.totalRepairOutsourcing, 0);
    return { totalPurchases, totalRepairRevenue, totalRepairCost, totalRepairProfit, totalOrders, totalRepairJobs };
  }, [supplierData]);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Supplier Management</h2>
        <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add Supplier
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">{editingId ? "Edit Supplier" : "Add New Supplier"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Name <span className="text-red-500">*</span></label>
              <input type="text" className="border border-gray-300 rounded-md px-3 py-2 w-full" placeholder="Enter supplier name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input type="tel" className="border border-gray-300 rounded-md px-3 py-2 w-full" placeholder="+254712345678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" className="border border-gray-300 rounded-md px-3 py-2 w-full" placeholder="supplier@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input type="text" className="border border-gray-300 rounded-md px-3 py-2 w-full" placeholder="Supplier address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Categories <span className="text-red-500">*</span></label>
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
          </div>
          <div className="flex gap-4 mt-4">
            <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
            <button onClick={handleCancel} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Total Paid to Suppliers</p>
          <p className="text-2xl font-bold text-blue-700">KES {overallStats.totalPurchases.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{overallStats.totalOrders} purchase orders</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Repair Revenue</p>
          <p className="text-2xl font-bold text-green-700">KES {overallStats.totalRepairRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{overallStats.totalRepairJobs} repairs | Cost: KES {overallStats.totalRepairCost.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Active Suppliers</p>
          <p className="text-2xl font-bold text-purple-700">{suppliers.length}</p>
          <p className="text-xs text-gray-500">
            {suppliers.filter(s => s.categories.includes('spare_parts')).length} spare parts,{' '}
            {suppliers.filter(s => s.categories.includes('accessories')).length} accessories
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Repair Profit</p>
          <p className={`text-2xl font-bold ${overallStats.totalRepairProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            KES {overallStats.totalRepairProfit.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Revenue - Parts Cost</p>
        </div>
      </div>

      {/* Supplier Costs & Sales Tracking */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-2">Supplier Costs & Sales Tracking</h3>
        <p className="text-sm text-gray-600 mb-4">
          Complete records of purchases from suppliers (spare parts + accessories) and repair outsourcing revenue.
        </p>

        {/* Tab filters */}
        <div className="flex gap-2 mb-4 border-b pb-2">
          {(['all', 'purchases', 'repairs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t text-sm font-medium ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab === 'all' ? 'All Records' : tab === 'purchases' ? 'Purchases' : 'Repair Outsourcing'}
            </button>
          ))}
        </div>

        {supplierData.filter(d => d.supplierPurchases.length > 0 || d.repairRecords.length > 0).length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg font-medium mb-2">No supplier transactions yet</p>
            <p className="text-sm">Purchase orders and repair outsourcing records will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {supplierData
              .filter(d => d.supplierPurchases.length > 0 || d.repairRecords.length > 0)
              .map((data) => {
                const isExpanded = expandedSupplierId === data.supplier.id;
                const showPurchases = activeTab === 'all' || activeTab === 'purchases';
                const showRepairs = activeTab === 'all' || activeTab === 'repairs';
                const hasPurchases = data.supplierPurchases.length > 0;
                const hasRepairs = data.repairRecords.length > 0;

                if ((activeTab === 'purchases' && !hasPurchases) || (activeTab === 'repairs' && !hasRepairs)) {
                  return null;
                }

                return (
                  <div key={data.supplier.id} className="border rounded-lg overflow-hidden">
                    {/* Supplier Header */}
                    <div
                      className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
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
                          {hasPurchases && (
                            <div className="text-right">
                              <p className="text-gray-600">Total Purchased</p>
                              <p className="font-bold text-blue-700">KES {data.totalPurchaseCost.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">{data.supplierPurchases.length} orders</p>
                            </div>
                          )}
                          {hasRepairs && (
                            <div className="text-right">
                              <p className="text-gray-600">Repairs: Revenue / Cost / Profit</p>
                              <p className="text-sm">
                                <span className="font-bold text-green-700">KES {data.totalRepairRevenue.toLocaleString()}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className="font-bold text-red-600">KES {data.totalRepairCost.toLocaleString()}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className={`font-bold ${data.totalRepairProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>KES {data.totalRepairProfit.toLocaleString()}</span>
                              </p>
                              <p className="text-xs text-gray-500">{data.totalRepairOutsourcing} repairs</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
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
                                    <th className="p-2 text-center">Status</th>
                                    {currentUser?.roles.includes('admin') && <th className="p-2 text-center">Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.supplierPurchases.map((purchase: Purchase) => (
                                    <tr key={purchase.id} className="border-t hover:bg-blue-50/50">
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
                                      <td className="p-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${purchase.confirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                          {purchase.confirmed ? 'Confirmed' : 'Pending'}
                                        </span>
                                      </td>
                                      {currentUser?.roles.includes('admin') && (
                                        <td className="p-2 text-center">
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
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-blue-50 font-semibold">
                                  <tr>
                                    <td className="p-2" colSpan={3}>Total Purchases</td>
                                    <td className="p-2 text-right text-blue-800">KES {data.totalPurchaseCost.toLocaleString()}</td>
                                    <td></td>
                                    {currentUser?.roles.includes('admin') && <td></td>}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Item Breakdown */}
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

                        {/* Repair Outsourcing Records */}
                        {showRepairs && hasRepairs && (
                          <div>
                            <h5 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                              <span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span>
                              Repair Outsourcing ({data.repairRecords.length})
                            </h5>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-green-50">
                                  <tr>
                                    <th className="p-2 text-left">Date</th>
                                    <th className="p-2 text-left">Customer</th>
                                    <th className="p-2 text-left">Phone Model</th>
                                    <th className="p-2 text-left">Parts Used</th>
                                    <th className="p-2 text-right">Revenue</th>
                                    <th className="p-2 text-right">Parts Cost</th>
                                    <th className="p-2 text-right">Profit</th>
                                    <th className="p-2 text-center">Status</th>
                                    {currentUser?.roles.includes('admin') && <th className="p-2 text-center">Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.repairRecords.map(record => (
                                    <tr key={record.repairId} className="border-t hover:bg-green-50/50">
                                      <td className="p-2">{formatDate(record.date)}</td>
                                      <td className="p-2">
                                        <div className="font-medium">{record.customerName}</div>
                                        {record.ticketNumber && (
                                          <div className="text-xs text-gray-500 font-mono">{record.ticketNumber}</div>
                                        )}
                                      </td>
                                      <td className="p-2">{record.phoneModel}</td>
                                      <td className="p-2">
                                        <div className="space-y-1">
                                          {record.parts.map((part, idx) => (
                                            <span key={idx} className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded mr-1">
                                              {part.itemName} x{part.qty} @ KES {part.cost.toLocaleString()}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="p-2 text-right font-bold text-green-700">KES {record.revenue.toLocaleString()}</td>
                                      <td className="p-2 text-right font-bold text-red-600">KES {record.partsCost.toLocaleString()}</td>
                                      <td className={`p-2 text-right font-bold ${record.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                        KES {record.profit.toLocaleString()}
                                      </td>
                                      <td className="p-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                          record.status === 'COLLECTED' ? 'bg-gray-100 text-gray-800' :
                                          record.status === 'FULLY_PAID' ? 'bg-green-100 text-green-800' :
                                          'bg-yellow-100 text-yellow-800'
                                        }`}>
                                          {record.status === 'COLLECTED' ? 'Collected' : record.status === 'FULLY_PAID' ? 'Fully Paid' : 'Pending'}
                                        </span>
                                      </td>
                                      {currentUser?.roles.includes('admin') && (
                                        <td className="p-2 text-center">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (window.confirm(`Delete repair record for ${record.customerName} (${record.phoneModel})? This will permanently remove the repair sale.`)) {
                                                deleteRepair(record.repairId);
                                              }
                                            }}
                                            className="text-red-600 hover:text-red-800 text-xs font-semibold hover:bg-red-50 px-2 py-1 rounded"
                                          >
                                            Delete
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-green-50 font-semibold">
                                  <tr>
                                    <td className="p-2" colSpan={4}>Totals</td>
                                    <td className="p-2 text-right text-green-800">KES {data.totalRepairRevenue.toLocaleString()}</td>
                                    <td className="p-2 text-right text-red-700">KES {data.totalRepairCost.toLocaleString()}</td>
                                    <td className={`p-2 text-right ${data.totalRepairProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>KES {data.totalRepairProfit.toLocaleString()}</td>
                                    <td></td>
                                    {currentUser?.roles.includes('admin') && <td></td>}
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Summary for this supplier */}
                        <div className="bg-gray-50 rounded p-4 border">
                          <h5 className="font-semibold mb-2">Summary: {data.supplier.name}</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Purchase Orders</p>
                              <p className="text-lg font-bold text-blue-700">KES {data.totalPurchaseCost.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Repair Revenue</p>
                              <p className="text-lg font-bold text-green-700">KES {data.totalRepairRevenue.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Parts Cost</p>
                              <p className="text-lg font-bold text-red-600">KES {data.totalRepairCost.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Repair Profit</p>
                              <p className={`text-lg font-bold ${data.totalRepairProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                KES {data.totalRepairProfit.toLocaleString()}
                              </p>
                            </div>
                          </div>
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
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">All Suppliers</h3>
        {suppliers.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No suppliers added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Address</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Categories</th>
                  <th className="p-3 text-right text-sm font-semibold text-gray-700">Total Spent</th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const data = supplierData.find(d => d.supplier.id === supplier.id);
                  return (
                    <tr key={supplier.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 text-sm font-medium">{supplier.name}</td>
                      <td className="p-3 text-sm text-gray-600">{supplier.phone || "-"}</td>
                      <td className="p-3 text-sm text-gray-600">{supplier.email || "-"}</td>
                      <td className="p-3 text-sm text-gray-600">{supplier.address || "-"}</td>
                      <td className="p-3 text-sm text-gray-600">
                        <div className="flex flex-wrap gap-1">
                          {supplier.categories.map((cat) => (
                            <span key={cat} className={`px-2 py-1 text-xs rounded ${cat === 'spare_parts' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                              {cat === 'accessories' ? 'Accessories' : 'Spare Parts'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-right font-bold text-blue-700">
                        KES {(data?.totalPurchaseCost || 0).toLocaleString()}
                      </td>
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
    </div>
  );
}
