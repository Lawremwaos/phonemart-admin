import { useState, useMemo, useEffect } from "react";
import { useInventory } from "../context/InventoryContext";
import { useSupplier } from "../context/SupplierContext";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";

export type ReturnRecord = {
  id: string;
  date: Date;
  customerName: string;
  customerPhone: string;
  repairId?: string;
  itemName: string;
  itemType: 'screen' | 'battery' | 'camera' | 'speaker' | 'charger' | 'protector' | 'other';
  faultDescription: string;
  supplierName: string;
  supplierId?: string;
  costPrice: number;
  status: 'pending' | 'resolved' | 'rejected';
  resolution?: string;
  shopId?: string;
};

// Load returns from localStorage
const loadReturnsFromStorage = (): ReturnRecord[] => {
  try {
    const stored = localStorage.getItem('phonemart_returns');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((ret: any) => ({
        ...ret,
        date: new Date(ret.date),
      }));
    }
  } catch (error) {
    console.error('Error loading returns from storage:', error);
  }
  return [];
};

// Save returns to localStorage
const saveReturnsToStorage = (returns: ReturnRecord[]) => {
  try {
    localStorage.setItem('phonemart_returns', JSON.stringify(returns));
  } catch (error) {
    console.error('Error saving returns to storage:', error);
  }
};

export default function Returns() {
  const { items, purchases } = useInventory();
  const { suppliers } = useSupplier();
  const { repairs } = useRepair();
  const { currentShop, currentUser } = useShop();
  
  const [returns, setReturns] = useState<ReturnRecord[]>(loadReturnsFromStorage());
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    repairId: "",
    itemName: "",
    itemType: 'screen' as ReturnRecord['itemType'],
    faultDescription: "",
    supplierName: "",
    supplierId: "",
    costPrice: 0,
  });

  // Save to localStorage whenever returns change
  useEffect(() => {
    saveReturnsToStorage(returns);
  }, [returns]);

  // Filter returns by shop
  const filteredReturns = useMemo(() => {
    if (currentUser?.roles.includes('admin')) {
      return returns;
    }
    return returns.filter(r => !r.shopId || r.shopId === currentShop?.id);
  }, [returns, currentShop, currentUser]);

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      customerName: "",
      customerPhone: "",
      repairId: "",
      itemName: "",
      itemType: 'screen',
      faultDescription: "",
      supplierName: "",
      supplierId: "",
      costPrice: 0,
    });
  };

  const handleSave = () => {
    if (!formData.customerName || !formData.itemName || !formData.supplierName || !formData.faultDescription) {
      alert("Please fill in all required fields");
      return;
    }
    // Require linking to a repair for warranty validation
    const repair = repairs.find(r => r.id === formData.repairId);
    if (!repair) {
      alert("Please select the original repair to record a return under warranty.");
      return;
    }
    // Enforce 30-day warranty window
    const daysSinceRepair = Math.floor((Date.now() - new Date(repair.date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceRepair > 30) {
      alert("Warranty window exceeded (30 days). Cannot record this return under warranty.");
      return;
    }
    // Ensure customer matches original repair
    if (repair.customerName !== formData.customerName || repair.phoneNumber !== formData.customerPhone) {
      alert("Customer details must match the original repair record.");
      return;
    }

    const newReturn: ReturnRecord = {
      id: Date.now().toString(),
      date: new Date(),
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      repairId: formData.repairId || undefined,
      itemName: formData.itemName,
      itemType: formData.itemType,
      faultDescription: formData.faultDescription,
      supplierName: formData.supplierName,
      supplierId: formData.supplierId || undefined,
      costPrice: formData.costPrice,
      status: 'pending',
      shopId: currentShop?.id,
    };

    const updatedReturns = [...returns, newReturn];
    setReturns(updatedReturns);
    saveReturnsToStorage(updatedReturns);

    setIsAdding(false);
    setFormData({
      customerName: "",
      customerPhone: "",
      repairId: "",
      itemName: "",
      itemType: 'screen',
      faultDescription: "",
      supplierName: "",
      supplierId: "",
      costPrice: 0,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setFormData({
      customerName: "",
      customerPhone: "",
      repairId: "",
      itemName: "",
      itemType: 'screen',
      faultDescription: "",
      supplierName: "",
      supplierId: "",
      costPrice: 0,
    });
  };

  const handleUpdateStatus = (id: string, status: ReturnRecord['status'], resolution?: string) => {
    const updatedReturns = returns.map(r =>
      r.id === id ? { ...r, status, resolution } : r
    );
    setReturns(updatedReturns);
    saveReturnsToStorage(updatedReturns);
  };

  // Get supplier cost from purchases or inventory
  const getSupplierCost = (supplierName: string, itemName: string): number => {
    // Try to find from inventory item
    const inventoryItem = items.find(i => i.name === itemName && i.supplier === supplierName);
    if (inventoryItem?.costPrice) {
      return inventoryItem.costPrice;
    }

    // Try to find from purchases
    const purchase = purchases
      .filter(p => p.supplier === supplierName)
      .flatMap(p => p.items)
      .find(item => item.itemName === itemName);
    
    return purchase?.costPrice || 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Returns & Warranty Tracking</h2>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Record Return
        </button>
      </div>

      {/* Add Return Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Record New Return</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer Phone</label>
              <input
                type="tel"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                placeholder="+254712345678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Repair ID (Optional)</label>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.repairId}
                onChange={(e) => {
                  setFormData({ ...formData, repairId: e.target.value });
                  // Auto-fill customer info if repair found
                  const repair = repairs.find(r => r.id === e.target.value);
                  if (repair) {
                    setFormData(prev => ({
                      ...prev,
                      customerName: repair.customerName,
                      customerPhone: repair.phoneNumber,
                    }));
                  }
                }}
              >
                <option value="">Select Repair (Optional)</option>
                {repairs.map(repair => (
                  <option key={repair.id} value={repair.id}>
                    {repair.customerName} - {repair.phoneModel} ({new Date(repair.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                placeholder="e.g., iPhone 14 Screen"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Type <span className="text-red-500">*</span>
              </label>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.itemType}
                onChange={(e) => setFormData({ ...formData, itemType: e.target.value as ReturnRecord['itemType'] })}
              >
                <option value="screen">Screen</option>
                <option value="battery">Battery</option>
                <option value="camera">Camera</option>
                <option value="speaker">Speaker</option>
                <option value="charger">Charger</option>
                <option value="protector">Protector</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.supplierId}
                onChange={(e) => {
                  const supplier = suppliers.find(s => s.id === e.target.value);
                  setFormData({
                    ...formData,
                    supplierId: e.target.value,
                    supplierName: supplier?.name || "",
                    costPrice: supplier ? getSupplierCost(supplier.name, formData.itemName) : 0,
                  });
                }}
              >
                <option value="">Select Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cost Price (KES)</label>
              <input
                type="number"
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                min="0"
                placeholder="Cost of the part"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fault Description <span className="text-red-500">*</span>
              </label>
              <textarea
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={formData.faultDescription}
                onChange={(e) => setFormData({ ...formData, faultDescription: e.target.value })}
                rows={3}
                placeholder="Describe the fault or issue with the part"
              />
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

      {/* Returns List */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">All Returns</h3>
        {filteredReturns.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No returns recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Item</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Type</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Fault</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Supplier</th>
                  <th className="p-3 text-right text-sm font-semibold text-gray-700">Cost</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map((returnRecord) => (
                  <tr key={returnRecord.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-sm">
                      {new Date(returnRecord.date).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-sm">
                      <div>{returnRecord.customerName}</div>
                      {returnRecord.customerPhone && (
                        <div className="text-xs text-gray-500">{returnRecord.customerPhone}</div>
                      )}
                    </td>
                    <td className="p-3 text-sm font-medium">{returnRecord.itemName}</td>
                    <td className="p-3 text-sm text-gray-600 capitalize">{returnRecord.itemType}</td>
                    <td className="p-3 text-sm text-gray-600 max-w-xs truncate">
                      {returnRecord.faultDescription}
                    </td>
                    <td className="p-3 text-sm text-gray-600">{returnRecord.supplierName}</td>
                    <td className="p-3 text-sm text-right font-semibold">
                      KES {returnRecord.costPrice.toLocaleString()}
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        returnRecord.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        returnRecord.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {returnRecord.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-2 justify-center">
                        {returnRecord.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                const resolution = prompt("Enter resolution details:");
                                if (resolution) {
                                  handleUpdateStatus(returnRecord.id, 'resolved', resolution);
                                }
                              }}
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt("Enter rejection reason:");
                                if (reason) {
                                  handleUpdateStatus(returnRecord.id, 'rejected', reason);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {returnRecord.resolution && (
                          <span className="text-xs text-gray-500" title={returnRecord.resolution}>
                            {returnRecord.status === 'resolved' ? '✓' : '✗'}
                          </span>
                        )}
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
