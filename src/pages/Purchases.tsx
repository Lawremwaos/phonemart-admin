import { useMemo, useState } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { useSupplier } from "../context/SupplierContext";

type PurchaseItem = {
  itemId: number;
  itemName: string;
  itemCategory: 'Spare' | 'Accessory';
  qty: number;
  costPrice: number;
};

export default function Purchases() {
  const { items, purchases, addPurchase, confirmPurchase, deletePurchase } = useInventory();
  const { suppliers, addSupplier } = useSupplier();
  const { currentShop, currentUser } = useShop();

  // Admin only - redirect non-admins
  if (!currentUser || !currentUser.roles.includes('admin')) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p>Only administrators can access the purchases page.</p>
        </div>
      </div>
    );
  }
  
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState<'Spare' | 'Accessory'>('Spare');
  const [qty, setQty] = useState(1);
  const [costPrice, setCostPrice] = useState(0);

  // Filter purchases by shop
  const filteredPurchases = currentUser?.roles.includes('admin')
    ? purchases
    : purchases.filter(p => !p.shopId || p.shopId === currentShop?.id);

  // Supplier spend analytics
  const supplierStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; items: Record<string, number> }> = {};
    purchases.forEach(p => {
      const name = p.supplier;
      if (!stats[name]) stats[name] = { total: 0, count: 0, items: {} };
      stats[name].total += p.total;
      stats[name].count += 1;
      p.items.forEach(it => {
        stats[name].items[it.itemName] = (stats[name].items[it.itemName] || 0) + it.qty;
      });
    });
    return Object.entries(stats).map(([supplier, data]) => {
      const topItem = Object.entries(data.items).sort((a, b) => b[1] - a[1])[0];
      return {
        supplier,
        total: data.total,
        orders: data.count,
        topItem: topItem ? `${topItem[0]} (Qty ${topItem[1]})` : '-',
      };
    });
  }, [purchases]);

  const handleAddItem = () => {
    if (!itemName.trim() || qty <= 0) {
      alert("Please enter item name and valid quantity");
      return;
    }
    if (currentUser?.roles.includes('admin') && costPrice <= 0) {
      alert("Please enter valid cost price");
      return;
    }

    // Check if item already exists in inventory
    const existingItem = items.find(i => i.name.toLowerCase() === itemName.trim().toLowerCase() && i.category === itemCategory);
    
    let itemId: number;
    if (existingItem) {
      // Use existing item ID
      itemId = existingItem.id;
    } else {
      // Create a temporary ID for new items (will be created when purchase is completed)
      itemId = -Date.now(); // Negative ID to indicate it's a new item
    }

    setPurchaseItems(prev => [
      ...prev,
      {
        itemId,
        itemName: itemName.trim(),
        itemCategory,
        qty,
        costPrice,
      },
    ]);

    setItemName("");
    setQty(1);
    setCostPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCompletePurchase = async () => {
    let finalSupplierName = supplierId
      ? suppliers.find(s => s.id === supplierId)?.name || supplierName
      : supplierName;

    if (!finalSupplierName || purchaseItems.length === 0) {
      alert("Please select or enter supplier and add at least one item");
      return;
    }

    // Ensure supplier exists in database (should already be saved via onBlur or button click)
    if (!supplierId && supplierName.trim()) {
      // Check if supplier already exists by name
      const existingSupplier = suppliers.find(s => 
        s.name.toLowerCase() === supplierName.trim().toLowerCase()
      );
      
      if (!existingSupplier) {
        // Add new supplier to database (fallback if not already saved)
        addSupplier({
          name: supplierName.trim(),
          categories: ['spare_parts', 'accessories'],
        });
        // Use the name directly for this purchase
        finalSupplierName = supplierName.trim();
      } else {
        // Use existing supplier
        finalSupplierName = existingSupplier.name;
        setSupplierId(existingSupplier.id);
      }
    }

    // Process purchase items - create new items if they don't exist
    const processedItems: Array<{ itemId: number; itemName: string; qty: number; costPrice: number }> = [];
    
    for (const purchaseItem of purchaseItems) {
      // Check if item exists (negative ID means it's new)
      if (purchaseItem.itemId < 0) {
        // Check if item with same name and category already exists
        const existingItem = items.find(i => 
          i.name.toLowerCase() === purchaseItem.itemName.toLowerCase() && 
          i.category === purchaseItem.itemCategory &&
          !i.shopId // Only check unallocated items
        );
        
        if (existingItem) {
          // Use existing item ID - stock will be added by addPurchase
          processedItems.push({
            itemId: existingItem.id,
            itemName: purchaseItem.itemName,
            qty: purchaseItem.qty,
            costPrice: purchaseItem.costPrice,
          });
        } else {
          // New item - will be created by addPurchase in InventoryContext
          // Use a temporary negative ID to indicate it's new
          processedItems.push({
            itemId: -Date.now(), // Temporary ID, will be handled by addPurchase
            itemName: purchaseItem.itemName,
            qty: purchaseItem.qty,
            costPrice: purchaseItem.costPrice,
          });
        }
      } else {
        // Existing item
        processedItems.push({
          itemId: purchaseItem.itemId,
          itemName: purchaseItem.itemName,
          qty: purchaseItem.qty,
          costPrice: purchaseItem.costPrice,
        });
      }
    }

    const total = purchaseItems.reduce((sum, item) => sum + (item.qty * item.costPrice), 0);
    
    addPurchase({
      supplier: finalSupplierName,
      items: processedItems,
      total,
      shopId: currentShop?.id,
    });

    // Reset form
    setSupplierId("");
    setSupplierName("");
    setPurchaseItems([]);
    setItemName("");
    setQty(1);
    setCostPrice(0);
    
    alert(`Purchase recorded! Total: KES ${total.toLocaleString()}`);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Purchase Tracking</h2>

      {/* Purchase Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Record New Purchase</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                const sup = suppliers.find(s => s.id === e.target.value);
                setSupplierName(sup ? sup.name : "");
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select supplier</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>{sup.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Or Add New Supplier</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setSupplierId("");
                }}
                onBlur={async () => {
                  // Auto-save supplier when user leaves the field
                  if (supplierName.trim() && !supplierId) {
                    const existingSupplier = suppliers.find(s => 
                      s.name.toLowerCase() === supplierName.trim().toLowerCase()
                    );
                    if (!existingSupplier) {
                      // Add new supplier to database
                      addSupplier({
                        name: supplierName.trim(),
                        categories: ['spare_parts', 'accessories'], // Default to both
                      });
                      // The supplier will appear in the dropdown after state updates
                    } else {
                      // Use existing supplier
                      setSupplierId(existingSupplier.id);
                      setSupplierName(existingSupplier.name);
                    }
                  }
                }}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                placeholder="Enter supplier name (auto-saves)"
              />
              {supplierName.trim() && !supplierId && (
                <button
                  onClick={async () => {
                    const existingSupplier = suppliers.find(s => 
                      s.name.toLowerCase() === supplierName.trim().toLowerCase()
                    );
                    if (!existingSupplier) {
                      addSupplier({
                        name: supplierName.trim(),
                        categories: ['spare_parts', 'accessories'],
                      });
                      alert(`Supplier "${supplierName.trim()}" added successfully!`);
                    } else {
                      setSupplierId(existingSupplier.id);
                      setSupplierName(existingSupplier.name);
                    }
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 whitespace-nowrap"
                >
                  Save Supplier
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {supplierName && !supplierId 
                ? "Supplier will be saved automatically or click 'Save Supplier' button"
                : "All suppliers are shared across the system."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item Name *</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Enter item name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <select
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value as 'Spare' | 'Accessory')}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="Spare">Spare Parts</option>
              <option value="Accessory">Accessories</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              min="1"
            />
          </div>
          {currentUser?.roles.includes('admin') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Purchase Cost (KES) *</label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
                placeholder="Your purchase cost (hidden from staff)"
              />
              <p className="text-xs text-gray-500 mt-1">This cost is only visible to you. Staff will see their own cost.</p>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={handleAddItem}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Purchase Items List */}
        {purchaseItems.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Purchase Items:</h4>
            <div className="border rounded p-4">
              {purchaseItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <span>
                    {item.itemName} x {item.qty}
                    {currentUser?.roles.includes('admin') && (
                      <> @ KES {item.costPrice.toLocaleString()}</>
                    )}
                  </span>
                  <div className="flex gap-2 items-center">
                    {currentUser?.roles.includes('admin') && (
                      <span className="font-semibold">KES {(item.qty * item.costPrice).toLocaleString()}</span>
                    )}
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {currentUser?.roles.includes('admin') && (
                <div className="mt-2 pt-2 border-t font-bold text-right">
                  Total: KES {purchaseItems.reduce((sum, item) => sum + (item.qty * item.costPrice), 0).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleCompletePurchase}
          className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
          disabled={(!supplierId && !supplierName) || purchaseItems.length === 0}
        >
          Complete Purchase
        </button>
      </div>

      {/* Purchase History */}
      <div className="bg-white rounded shadow">
        <h3 className="text-lg font-semibold p-4 border-b">Purchase History</h3>
        {filteredPurchases.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No purchases recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Supplier</th>
                  <th className="p-3 text-left">Items</th>
                  {currentUser?.roles.includes('admin') && (
                    <>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className={`border-t ${purchase.confirmed ? 'bg-green-50' : ''}`}>
                    <td className="p-3">
                      {new Date(purchase.date).toLocaleDateString()}
                    </td>
                    <td className="p-3">{purchase.supplier}</td>
                    <td className="p-3">
                      {purchase.items.map((item, idx) => (
                        <span key={idx} className="block">
                          {item.itemName} x {item.qty}
                        </span>
                      ))}
                    </td>
                    {currentUser?.roles.includes('admin') && (
                      <>
                        <td className="p-3 text-right font-semibold">
                          KES {purchase.total.toLocaleString()}
                        </td>
                        <td className="p-3">
                          {purchase.confirmed ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-semibold">
                              ✓ Confirmed
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-semibold">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-2">
                            {!purchase.confirmed ? (
                              <button
                                onClick={() => {
                                  if (window.confirm("Confirm this purchase? Staff will be able to allocate items after confirmation.")) {
                                    confirmPurchase(purchase.id);
                                  }
                                }}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                              >
                                Confirm Purchase
                              </button>
                            ) : (
                              <span className="text-sm text-gray-500">
                                Confirmed by {purchase.confirmedBy || 'admin'} on {purchase.confirmedDate ? new Date(purchase.confirmedDate).toLocaleDateString() : 'N/A'}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete this purchase? This action cannot be undone.`)) {
                                  deletePurchase(purchase.id);
                                  alert("Purchase deleted successfully");
                                }
                              }}
                              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                            >
                              Delete Purchase
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {currentUser?.roles.includes('admin') && supplierStats.length > 0 && (
        <div className="bg-white rounded shadow mt-6">
          <h3 className="text-lg font-semibold p-4 border-b">Supplier Spend Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Supplier</th>
                  <th className="p-3 text-right">Total Spent</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-left">Most Bought</th>
                </tr>
              </thead>
              <tbody>
                {supplierStats.map((row) => (
                  <tr key={row.supplier} className="border-t">
                    <td className="p-3 font-medium">{row.supplier}</td>
                    <td className="p-3 text-right font-semibold">KES {row.total.toLocaleString()}</td>
                    <td className="p-3 text-right">{row.orders}</td>
                    <td className="p-3 text-sm text-gray-700">{row.topItem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
