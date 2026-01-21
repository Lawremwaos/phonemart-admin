import { useState, useMemo } from "react";
import { useSupplier } from "../context/SupplierContext";
import { useInventory } from "../context/InventoryContext";
import { useRepair } from "../context/RepairContext";
import { useSupplierDebt } from "../context/SupplierDebtContext";
import { useShop } from "../context/ShopContext";

export default function SupplierManagement() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplier();
  const { purchases } = useInventory();
  const { repairs } = useRepair();
  const { debts, updateDebtCost, markAsPaid, getTodaysDebtsBySupplier } = useSupplierDebt();
  const { currentUser } = useShop();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // Calculate supplier analytics
  const supplierAnalytics = useMemo(() => {
    return suppliers.map(supplier => {
      const supplierPurchases = purchases.filter(p => p.supplier === supplier.name);
      const totalSpent = supplierPurchases.reduce((sum, p) => sum + p.total, 0);
      
      // Count items purchased
      const itemCounts: Record<string, { qty: number; totalCost: number; prices: number[] }> = {};
      supplierPurchases.forEach(purchase => {
        purchase.items.forEach(item => {
          if (!itemCounts[item.itemName]) {
            itemCounts[item.itemName] = { qty: 0, totalCost: 0, prices: [] };
          }
          itemCounts[item.itemName].qty += item.qty;
          itemCounts[item.itemName].totalCost += item.qty * item.costPrice;
          itemCounts[item.itemName].prices.push(item.costPrice);
        });
      });

      // Find most bought item
      const mostBoughtItem = Object.entries(itemCounts).reduce((max, [name, data]) => {
        return data.qty > (max ? itemCounts[max].qty : 0) ? name : max;
      }, "" as string);

      // Calculate average prices
      const itemPriceAverages: Record<string, { avg: number; min: number; max: number }> = {};
      Object.entries(itemCounts).forEach(([name, data]) => {
        itemPriceAverages[name] = {
          avg: data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
          min: Math.min(...data.prices),
          max: Math.max(...data.prices),
        };
      });

      return {
        supplier,
        totalSpent,
        purchaseCount: supplierPurchases.length,
        mostBoughtItem,
        itemCounts,
        itemPriceAverages,
      };
    });
  }, [suppliers, purchases]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Supplier Management</h2>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Supplier
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? "Edit Supplier" : "Add New Supplier"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                placeholder="Enter supplier name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                placeholder="+254712345678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                placeholder="supplier@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                placeholder="Supplier address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categories <span className="text-red-500">*</span> (Select one or both)
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={formData.categories.includes('accessories')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          categories: [...formData.categories, 'accessories'],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          categories: formData.categories.filter(c => c !== 'accessories'),
                        });
                      }
                    }}
                  />
                  <span>Accessories</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={formData.categories.includes('spare_parts')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          categories: [...formData.categories, 'spare_parts'],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          categories: formData.categories.filter(c => c !== 'spare_parts'),
                        });
                      }
                    }}
                  />
                  <span>Spare Parts</span>
                </label>
              </div>
              {formData.categories.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Please select at least one category</p>
              )}
            </div>
          </div>
          <div className="flex gap-4 mt-4">
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Supplier Analytics */}
      {supplierAnalytics.length > 0 && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Supplier Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supplierAnalytics.map((analytics) => (
              <div key={analytics.supplier.id} className="border rounded-lg p-4 hover:shadow-md transition">
                <h4 className="font-bold text-lg mb-2">{analytics.supplier.name}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Purchases:</span>
                    <span className="font-semibold">KES {analytics.totalSpent.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Purchase Orders:</span>
                    <span className="font-semibold">{analytics.purchaseCount}</span>
                  </div>
                  {analytics.mostBoughtItem && (
                    <div className="pt-2 border-t">
                      <span className="text-gray-600 text-xs">Most Bought:</span>
                      <div className="font-semibold">{analytics.mostBoughtItem}</div>
                      <div className="text-xs text-gray-500">
                        Qty: {analytics.itemCounts[analytics.mostBoughtItem].qty} | 
                        Total: KES {analytics.itemCounts[analytics.mostBoughtItem].totalCost.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSupplierId(
                    selectedSupplierId === analytics.supplier.id ? null : analytics.supplier.id
                  )}
                  className="mt-3 text-blue-600 hover:text-blue-800 text-sm"
                >
                  {selectedSupplierId === analytics.supplier.id ? 'Hide' : 'View'} Details
                </button>
              </div>
            ))}
          </div>

          {/* Detailed View */}
          {selectedSupplierId && (() => {
            const analytics = supplierAnalytics.find(a => a.supplier.id === selectedSupplierId);
            if (!analytics) return null;
            return (
              <div className="mt-6 border-t pt-6">
                <h4 className="font-bold text-lg mb-4">Detailed Analytics: {analytics.supplier.name}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-right">Total Qty</th>
                        <th className="p-2 text-right">Total Cost</th>
                        <th className="p-2 text-right">Avg Price</th>
                        <th className="p-2 text-right">Min Price</th>
                        <th className="p-2 text-right">Max Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(analytics.itemCounts).map(([itemName, data]) => {
                        const priceData = analytics.itemPriceAverages[itemName];
                        return (
                          <tr key={itemName} className="border-t">
                            <td className="p-2 font-medium">{itemName}</td>
                            <td className="p-2 text-right">{data.qty}</td>
                            <td className="p-2 text-right">KES {data.totalCost.toLocaleString()}</td>
                            <td className="p-2 text-right">KES {priceData.avg.toFixed(0)}</td>
                            <td className="p-2 text-right">KES {priceData.min.toLocaleString()}</td>
                            <td className="p-2 text-right">KES {priceData.max.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Supplier Costs & Sales Tracking */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Supplier Costs & Sales Tracking</h3>
        <p className="text-sm text-gray-600 mb-4">
          Fill in the cost of items sold by suppliers from repair sales and accessory sales. This will calculate net profit.
        </p>
        
        {suppliers.map((supplier) => {
          // Get repairs linked to this supplier
          const supplierRepairs = repairs.filter(repair => {
            // Check if repair has parts or items from this supplier
            const hasOutsourcedParts = repair.partsUsed.some(part => {
              const debt = debts.find(d => d.repairId === repair.id && d.supplierId === supplier.id && d.itemName === part.itemName);
              return debt !== undefined;
            });
            const hasOutsourcedItems = repair.additionalItems?.some(item => {
              const debt = debts.find(d => d.repairId === repair.id && d.supplierId === supplier.id && d.itemName === item.itemName);
              return debt !== undefined;
            });
            return hasOutsourcedParts || hasOutsourcedItems;
          });

          // Get today's unpaid debts for this supplier
          const todaysDebts = getTodaysDebtsBySupplier(supplier.id);
          const totalOwedToday = todaysDebts.reduce((sum: number, debt: any) => sum + debt.totalCost, 0);

          if (supplierRepairs.length === 0 && todaysDebts.length === 0) {
            return null;
          }

          return (
            <div key={supplier.id} className="mb-6 border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg">{supplier.name}</h4>
                {currentUser?.roles.includes('admin') && totalOwedToday > 0 && (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      Today's Debt: <span className="font-bold text-red-600">KES {totalOwedToday.toLocaleString()}</span>
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm(`Confirm payment of KES ${totalOwedToday.toLocaleString()} to ${supplier.name}?`)) {
                          todaysDebts.forEach(debt => {
                            markAsPaid(debt.id, currentUser.name);
                          });
                          alert('Payment confirmed!');
                        }
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                    >
                      Confirm Payment
                    </button>
                  </div>
                )}
              </div>

              {/* Repairs with this supplier */}
              {supplierRepairs.map((repair) => {
                const repairDebts = debts.filter(d => d.repairId === repair.id && d.supplierId === supplier.id);
                const repairRevenue = repair.totalAgreedAmount || repair.totalCost;
                const repairCosts = repairDebts.reduce((sum, d) => sum + d.totalCost, 0);
                const netProfit = repairRevenue - repairCosts;

                return (
                  <div key={repair.id} className="mb-4 p-4 bg-gray-50 rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">Repair Sale - {repair.customerName}</p>
                        <p className="text-sm text-gray-600">{repair.phoneModel} | {new Date(repair.date).toLocaleDateString()}</p>
                        <p className="text-sm">Revenue: <span className="font-bold">KES {repairRevenue.toLocaleString()}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Costs: <span className="font-bold">KES {repairCosts.toLocaleString()}</span></p>
                        <p className="text-sm font-bold text-green-600">Net Profit: KES {netProfit.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      {repairDebts.map((debt: any) => (
                        <div key={debt.id} className="flex items-center gap-4 p-2 bg-white rounded">
                          <span className="flex-1 text-sm">{debt.itemName} x {debt.quantity}</span>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Cost per unit:</label>
                            <input
                              type="number"
                              value={debt.costPerUnit || ''}
                              onChange={(e) => {
                                const cost = Number(e.target.value) || 0;
                                updateDebtCost(debt.id, cost);
                              }}
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-600">KES</span>
                            <span className="text-sm font-semibold w-24 text-right">
                              Total: KES {debt.totalCost.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
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
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium">{supplier.name}</td>
                    <td className="p-3 text-sm text-gray-600">{supplier.phone || "-"}</td>
                    <td className="p-3 text-sm text-gray-600">{supplier.email || "-"}</td>
                    <td className="p-3 text-sm text-gray-600">{supplier.address || "-"}</td>
                    <td className="p-3 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {supplier.categories.map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                          >
                            {cat === 'accessories' ? 'Accessories' : 'Spare Parts'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
