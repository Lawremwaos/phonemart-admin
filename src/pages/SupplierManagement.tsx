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
  const [activeTab, setActiveTab] = useState<'purchases' | 'parts_taken' | 'all'>('all');
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

  const supplierData = useMemo(() => {
    return suppliers.map(supplier => {
      // Purchases from this supplier
      const supplierPurchases = purchases.filter(p =>
        p.supplier.toLowerCase() === supplier.name.toLowerCase()
      );
      const totalPurchaseCost = supplierPurchases.reduce((sum, p) => sum + p.total, 0);
      const purchaseItemBreakdown: Record<string, { qty: number; totalCost: number }> = {};
      supplierPurchases.forEach(purchase => {
        purchase.items.forEach(item => {
          if (!purchaseItemBreakdown[item.itemName]) {
            purchaseItemBreakdown[item.itemName] = { qty: 0, totalCost: 0 };
          }
          purchaseItemBreakdown[item.itemName].qty += item.qty;
          purchaseItemBreakdown[item.itemName].totalCost += item.qty * item.costPrice;
        });
      });

      // Parts taken from this supplier (outsourced parts used in repairs)
      const partsTaken: Array<{
        repairId: string;
        date: Date;
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

      repairs.forEach(repair => {
        const fromThisSupplier = repair.partsUsed.filter(p =>
          p.supplierName?.toLowerCase() === supplier.name.toLowerCase() ||
          (p.source === 'outsourced' && p.supplierName?.toLowerCase() === supplier.name.toLowerCase())
        );
        fromThisSupplier.forEach(part => {
          partsTaken.push({
            repairId: repair.id,
            date: repair.date,
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

      return {
        supplier,
        supplierPurchases,
        totalPurchaseCost,
        purchaseItemBreakdown,
        partsTaken,
        totalPartsCost,
        grandTotal: totalPurchaseCost + totalPartsCost,
      };
    });
  }, [suppliers, purchases, repairs]);

  const overallStats = useMemo(() => {
    const totalPurchases = supplierData.reduce((sum, d) => sum + d.totalPurchaseCost, 0);
    const totalPartsCost = supplierData.reduce((sum, d) => sum + d.totalPartsCost, 0);
    const totalOrders = supplierData.reduce((sum, d) => sum + d.supplierPurchases.length, 0);
    const totalPartsTaken = supplierData.reduce((sum, d) => sum + d.partsTaken.length, 0);
    return { totalPurchases, totalPartsCost, totalOrders, totalPartsTaken, grandTotal: totalPurchases + totalPartsCost };
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
        <div className="bg-white p-4 rounded shadow border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Total Parts Taken (Outsourced)</p>
          <p className="text-2xl font-bold text-orange-700">KES {overallStats.totalPartsCost.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{overallStats.totalPartsTaken} parts used in repairs</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Active Suppliers</p>
          <p className="text-2xl font-bold text-purple-700">{suppliers.length}</p>
          <p className="text-xs text-gray-500">
            {suppliers.filter(s => s.categories.includes('spare_parts')).length} spare parts,{' '}
            {suppliers.filter(s => s.categories.includes('accessories')).length} accessories
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
          <p className="text-sm text-gray-600">Grand Total (Purchases + Parts)</p>
          <p className="text-2xl font-bold text-red-700">KES {overallStats.grandTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total spent with all suppliers</p>
        </div>
      </div>

      {/* Supplier Records */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-2">Supplier Records</h3>
        <p className="text-sm text-gray-600 mb-4">
          Track purchases from suppliers and outsourced spare parts taken by staff for repairs.
        </p>

        <div className="flex gap-2 mb-4 border-b pb-2">
          {(['all', 'purchases', 'parts_taken'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t text-sm font-medium ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab === 'all' ? 'All Records' : tab === 'purchases' ? 'Purchases' : 'Parts Taken'}
            </button>
          ))}
        </div>

        {supplierData.filter(d => d.supplierPurchases.length > 0 || d.partsTaken.length > 0).length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg font-medium mb-2">No supplier transactions yet</p>
            <p className="text-sm">Purchase orders and outsourced parts records will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {supplierData
              .filter(d => d.supplierPurchases.length > 0 || d.partsTaken.length > 0)
              .map((data) => {
                const isExpanded = expandedSupplierId === data.supplier.id;
                const showPurchases = activeTab === 'all' || activeTab === 'purchases';
                const showParts = activeTab === 'all' || activeTab === 'parts_taken';
                const hasPurchases = data.supplierPurchases.length > 0;
                const hasParts = data.partsTaken.length > 0;

                if ((activeTab === 'purchases' && !hasPurchases) || (activeTab === 'parts_taken' && !hasParts)) {
                  return null;
                }

                return (
                  <div key={data.supplier.id} className="border rounded-lg overflow-hidden">
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
                              <p className="text-gray-600">Purchases</p>
                              <p className="font-bold text-blue-700">KES {data.totalPurchaseCost.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">{data.supplierPurchases.length} orders</p>
                            </div>
                          )}
                          {hasParts && (
                            <div className="text-right">
                              <p className="text-gray-600">Parts Taken</p>
                              <p className="font-bold text-orange-700">KES {data.totalPartsCost.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">{data.partsTaken.length} parts</p>
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

                        {/* Parts Taken (Outsourced spare parts used in repairs) */}
                        {showParts && hasParts && (
                          <div>
                            <h5 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                              <span className="w-3 h-3 bg-orange-500 rounded-full inline-block"></span>
                              Parts Taken for Repairs ({data.partsTaken.length})
                            </h5>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-orange-50">
                                  <tr>
                                    <th className="p-2 text-left">Date</th>
                                    <th className="p-2 text-left">Staff</th>
                                    <th className="p-2 text-left">Customer</th>
                                    <th className="p-2 text-left">Phone</th>
                                    <th className="p-2 text-left">Part Name</th>
                                    <th className="p-2 text-center">Qty</th>
                                    <th className="p-2 text-right">Cost</th>
                                    <th className="p-2 text-center">Status</th>
                                    {currentUser?.roles.includes('admin') && <th className="p-2 text-center">Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.partsTaken.map((record, idx) => (
                                    <tr key={`${record.repairId}-${record.partName}-${idx}`} className="border-t hover:bg-orange-50/50">
                                      <td className="p-2">{formatDate(record.date)}</td>
                                      <td className="p-2">
                                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded font-medium">
                                          {record.staffName}
                                        </span>
                                      </td>
                                      <td className="p-2">
                                        <div className="font-medium">{record.customerName}</div>
                                        {record.ticketNumber && (
                                          <div className="text-xs text-gray-500 font-mono">{record.ticketNumber}</div>
                                        )}
                                      </td>
                                      <td className="p-2">{record.phoneModel}</td>
                                      <td className="p-2">
                                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-medium">
                                          {record.partName}
                                        </span>
                                      </td>
                                      <td className="p-2 text-center">{record.qty}</td>
                                      <td className="p-2 text-right font-bold">
                                        {record.cost > 0
                                          ? <span className="text-red-600">KES {record.cost.toLocaleString()}</span>
                                          : <span className="text-yellow-600 text-xs">Pending</span>
                                        }
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
                                              if (window.confirm(`Delete repair for ${record.customerName} (${record.phoneModel})? This removes the entire repair.`)) {
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
                                <tfoot className="bg-orange-50 font-semibold">
                                  <tr>
                                    <td className="p-2" colSpan={6}>Total Parts Cost</td>
                                    <td className="p-2 text-right text-orange-800">KES {data.totalPartsCost.toLocaleString()}</td>
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Purchase Orders</p>
                              <p className="text-lg font-bold text-blue-700">KES {data.totalPurchaseCost.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Parts Taken (Outsourced)</p>
                              <p className="text-lg font-bold text-orange-700">KES {data.totalPartsCost.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Grand Total</p>
                              <p className="text-lg font-bold text-red-700">KES {data.grandTotal.toLocaleString()}</p>
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
                      <td className="p-3 text-sm text-right font-bold text-red-700">
                        KES {(data?.grandTotal || 0).toLocaleString()}
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
