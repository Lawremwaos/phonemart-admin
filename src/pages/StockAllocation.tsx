import { useState, useMemo } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

export default function StockAllocation() {
  const { items, stockAllocations, purchases, requestStockAllocation, approveStockAllocation, rejectStockAllocation } = useInventory();
  const { shops, currentUser } = useShop();

  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [allocations, setAllocations] = useState<Array<{ shopId: string; shopName: string; qty: number }>>([]);

  // Get items that need allocation (pendingAllocation = true and no shopId)
  // Only show items from confirmed purchases
  const itemsNeedingAllocation = useMemo(() => {
    const hasConfirmedPurchases = purchases.some(p => p.confirmed);
    if (!hasConfirmedPurchases) {
      return []; // No items available if no purchases are confirmed
    }
    return items.filter(item => item.pendingAllocation && !item.shopId);
  }, [items, purchases]);

  // Get pending allocations
  const pendingAllocations = useMemo(() => {
    return stockAllocations.filter(a => a.status === 'pending');
  }, [stockAllocations]);

  const handleAddShop = () => {
    if (allocations.length >= shops.length) {
      alert("All shops have been added");
      return;
    }
    const availableShops = shops.filter(s => !allocations.find(a => a.shopId === s.id));
    if (availableShops.length === 0) return;
    
    setAllocations(prev => [
      ...prev,
      { shopId: availableShops[0].id, shopName: availableShops[0].name, qty: 0 },
    ]);
  };

  const handleRemoveShop = (index: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleQtyChange = (index: number, qty: number) => {
    setAllocations(prev =>
      prev.map((alloc, i) => (i === index ? { ...alloc, qty } : alloc))
    );
  };

  const handleShopChange = (index: number, shopId: string) => {
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;
    setAllocations(prev =>
      prev.map((alloc, i) => (i === index ? { ...alloc, shopId: shop.id, shopName: shop.name } : alloc))
    );
  };

  const handleSubmitAllocation = () => {
    if (!selectedItemId) {
      alert("Please select an item");
      return;
    }

    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    const totalAllocated = allocations.reduce((sum, a) => sum + a.qty, 0);
    if (totalAllocated <= 0) {
      alert("Please allocate at least some stock");
      return;
    }

    if (totalAllocated > item.stock) {
      alert(`Cannot allocate more than available stock (${item.stock})`);
      return;
    }

    requestStockAllocation({
      itemId: Number(selectedItemId),
      itemName: item.name,
      totalQty: totalAllocated,
      allocations: allocations.filter(a => a.qty > 0),
      requestedBy: currentUser?.name || 'Unknown',
    });

    alert("Stock allocation request submitted! Waiting for admin approval.");
    setSelectedItemId("");
    setAllocations([]);
  };

  const handleApprove = (allocationId: string) => {
    if (!window.confirm("Approve this stock allocation?")) return;
    approveStockAllocation(allocationId);
    alert("Stock allocation approved and distributed!");
  };

  const handleReject = (allocationId: string) => {
    if (!window.confirm("Reject this stock allocation?")) return;
    rejectStockAllocation(allocationId);
    alert("Stock allocation rejected!");
  };

  const selectedItem = items.find(i => i.id === selectedItemId);
  const totalAllocated = allocations.reduce((sum, a) => sum + a.qty, 0);
  const remainingStock = selectedItem ? selectedItem.stock - totalAllocated : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Stock Allocation</h2>
      </div>

      {/* Staff: Request Stock Allocation */}
      {!currentUser?.roles.includes('admin') && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Request Stock Allocation</h3>
          {purchases.some(p => p.confirmed) ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Divide purchased stock among shops. Your allocation request will be sent to admin for approval.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(Number(e.target.value));
                setAllocations([]);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select item needing allocation</option>
              {itemsNeedingAllocation.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Available: {item.stock})
                </option>
              ))}
            </select>
              </div>

              {selectedItem && (
            <>
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <p className="font-semibold">{selectedItem.name}</p>
                <p className="text-sm text-gray-600">Available Stock: {selectedItem.stock}</p>
                <p className="text-sm text-gray-600">Remaining after allocation: {remainingStock}</p>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Allocate to Shops</label>
                  <button
                    onClick={handleAddShop}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    + Add Shop
                  </button>
                </div>

                {allocations.map((alloc, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      value={alloc.shopId}
                      onChange={(e) => handleShopChange(index, e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select Shop</option>
                      {shops
                        .filter(s => !allocations.find((a, i) => a.shopId === s.id && i !== index))
                        .map(shop => (
                          <option key={shop.id} value={shop.id}>{shop.name}</option>
                        ))}
                    </select>
                    <input
                      type="number"
                      value={alloc.qty}
                      onChange={(e) => handleQtyChange(index, Number(e.target.value))}
                      className="w-32 border border-gray-300 rounded-md px-3 py-2"
                      min="0"
                      max={selectedItem.stock}
                      placeholder="Qty"
                    />
                    <button
                      onClick={() => handleRemoveShop(index)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {allocations.length === 0 && (
                  <p className="text-sm text-gray-500">Click "Add Shop" to start allocating stock</p>
                )}
              </div>

              <button
                onClick={handleSubmitAllocation}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                disabled={!selectedItemId || totalAllocated <= 0 || totalAllocated > selectedItem.stock}
              >
                Submit Allocation Request
              </button>
              </>
              )}
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800 font-semibold">No confirmed purchases available</p>
              <p className="text-sm text-yellow-700 mt-1">
                You can only allocate items from purchases that have been confirmed by the admin. 
                Please wait for the admin to confirm purchases first.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Admin: Approve/Reject Allocations */}
      {currentUser?.roles.includes('admin') && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Pending Stock Allocations</h3>
          {pendingAllocations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No pending allocations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Requested By</th>
                    <th className="p-3 text-left">Allocations</th>
                    <th className="p-3 text-right">Total Qty</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAllocations.map((allocation) => (
                    <tr key={allocation.id} className="border-t">
                      <td className="p-3 text-sm">
                        {new Date(allocation.requestedDate).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-medium">{allocation.itemName}</td>
                      <td className="p-3 text-sm">{allocation.requestedBy}</td>
                      <td className="p-3">
                        {allocation.allocations.map((alloc, idx) => (
                          <div key={idx} className="text-sm">
                            {alloc.shopName}: {alloc.qty}
                          </div>
                        ))}
                      </td>
                      <td className="p-3 text-right font-semibold">{allocation.totalQty}</td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleApprove(allocation.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(allocation.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            Reject
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
      )}

      {/* Items Needing Allocation (for reference) */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Items Needing Allocation</h3>
        {itemsNeedingAllocation.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No items need allocation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-left">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {itemsNeedingAllocation.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-sm">{item.category}</td>
                    <td className="p-3 text-right font-semibold">{item.stock}</td>
                    <td className="p-3 text-sm">{item.supplier || '-'}</td>
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
