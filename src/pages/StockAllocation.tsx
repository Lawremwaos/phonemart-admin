import { useState, useMemo } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

type StaffAllocation = {
  id: string;
  purchaseId: string;
  itemId: number;
  itemName: string;
  qty: number;
  allocatedDate: Date;
  staffName: string;
  shopId: string;
};

type StockRequest = {
  id: string;
  itemId: number;
  itemName: string;
  qty: number;
  requestedDate: Date;
  staffName: string;
  shopId: string;
  status: 'pending' | 'approved' | 'rejected';
};

export default function StockAllocation() {
  const { items, purchases, updateItem, addItem } = useInventory();
  const { currentUser, currentShop } = useShop();

  // Store allocations and requests in state (in production, these would be in Supabase)
  const [staffAllocations, setStaffAllocations] = useState<StaffAllocation[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);

  // Form states
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [allocationQty, setAllocationQty] = useState(0);
  
  // Request states
  const [requestItemId, setRequestItemId] = useState<number | "">("");
  const [requestQty, setRequestQty] = useState(0);

  // Get confirmed purchases with items that need allocation
  const purchasesNeedingAllocation = useMemo(() => {
    return purchases.filter(p => 
      p.confirmed && 
      p.items.some(item => {
        const inventoryItem = items.find(i => i.id === item.itemId);
        return inventoryItem && !inventoryItem.shopId && inventoryItem.stock > 0;
      })
    );
  }, [purchases, items]);

  // Get items from selected purchase that are available for allocation
  const availableItemsFromPurchase = useMemo(() => {
    if (!selectedPurchaseId) return [];
    const purchase = purchases.find(p => p.id === selectedPurchaseId);
    if (!purchase) return [];
    
    return purchase.items.map(purchaseItem => {
      const inventoryItem = items.find(i => i.id === purchaseItem.itemId);
      const alreadyAllocated = staffAllocations
        .filter(a => a.purchaseId === selectedPurchaseId && a.itemId === purchaseItem.itemId)
        .reduce((sum, a) => sum + a.qty, 0);
      const available = (inventoryItem?.stock || 0) - alreadyAllocated;
      
      return {
        ...purchaseItem,
        available,
        inventoryItem,
      };
    }).filter(item => item.available > 0);
  }, [selectedPurchaseId, purchases, items, staffAllocations]);

  // Get unallocated items from inventory (for requesting additional stock)
  const unallocatedItems = useMemo(() => {
    return items.filter(item => 
      !item.shopId && 
      item.stock > 0 &&
      !item.pendingAllocation // Not from pending purchases
    );
  }, [items]);

  // Get current staff's allocations
  const myAllocations = useMemo(() => {
    if (!currentUser) return [];
    return staffAllocations.filter(a => a.staffName === currentUser.name);
  }, [staffAllocations, currentUser]);

  // Get current staff's requests
  const myRequests = useMemo(() => {
    if (!currentUser) return [];
    return stockRequests.filter(r => r.staffName === currentUser.name);
  }, [stockRequests, currentUser]);

  // Handle recording allocation
  const handleRecordAllocation = () => {
    if (!selectedPurchaseId || !selectedItemId || allocationQty <= 0) {
      alert("Please select purchase, item, and enter quantity");
      return;
    }

    const purchase = purchases.find(p => p.id === selectedPurchaseId);
    const purchaseItem = purchase?.items.find(i => i.itemId === selectedItemId);
    const inventoryItem = items.find(i => i.id === selectedItemId);

    if (!purchase || !purchaseItem || !inventoryItem) {
      alert("Invalid selection");
      return;
    }

    // Check available quantity
    const alreadyAllocated = staffAllocations
      .filter(a => a.purchaseId === selectedPurchaseId && a.itemId === selectedItemId)
      .reduce((sum, a) => sum + a.qty, 0);
    const available = inventoryItem.stock - alreadyAllocated;

    if (allocationQty > available) {
      alert(`Only ${available} items available for allocation`);
      return;
    }

    // Record allocation
    const newAllocation: StaffAllocation = {
      id: Date.now().toString(),
      purchaseId: selectedPurchaseId,
      itemId: selectedItemId,
      itemName: purchaseItem.itemName,
      qty: allocationQty,
      allocatedDate: new Date(),
      staffName: currentUser?.name || 'Unknown',
      shopId: currentShop?.id || '',
    };

    setStaffAllocations(prev => [...prev, newAllocation]);

    // Update inventory: allocate to staff's shop
    const existingShopItem = items.find(i => 
      i.name === inventoryItem.name && 
      i.shopId === currentShop?.id
    );

    if (existingShopItem) {
      updateItem(existingShopItem.id, { stock: existingShopItem.stock + allocationQty });
    } else {
      addItem({
        name: inventoryItem.name,
        category: inventoryItem.category,
        itemType: inventoryItem.itemType,
        stock: allocationQty,
        price: inventoryItem.price,
        reorderLevel: inventoryItem.reorderLevel,
        initialStock: allocationQty,
        shopId: currentShop?.id,
        supplier: inventoryItem.supplier,
      });
    }

    // Deduct from unallocated stock
    updateItem(inventoryItem.id, { stock: inventoryItem.stock - allocationQty });

    alert(`Allocation recorded: ${allocationQty} ${purchaseItem.itemName} allocated to you`);
    setSelectedPurchaseId("");
    setSelectedItemId("");
    setAllocationQty(0);
  };

  // Handle requesting additional stock
  const handleRequestStock = () => {
    if (!requestItemId || requestQty <= 0) {
      alert("Please select item and enter quantity");
      return;
    }

    const item = items.find(i => i.id === requestItemId);
    if (!item) {
      alert("Item not found");
      return;
    }

    if (requestQty > item.stock) {
      alert(`Only ${item.stock} items available`);
      return;
    }

    const newRequest: StockRequest = {
      id: Date.now().toString(),
      itemId: requestItemId,
      itemName: item.name,
      qty: requestQty,
      requestedDate: new Date(),
      staffName: currentUser?.name || 'Unknown',
      shopId: currentShop?.id || '',
      status: 'pending',
    };

    setStockRequests(prev => [...prev, newRequest]);
    alert(`Stock request submitted: ${requestQty} ${item.name}`);
    setRequestItemId("");
    setRequestQty(0);
  };

  // Admin: Approve stock request
  const handleApproveRequest = (requestId: string) => {
    const request = stockRequests.find(r => r.id === requestId);
    if (!request) return;

    const item = items.find(i => i.id === request.itemId);
    if (!item) return;

    if (request.qty > item.stock) {
      alert(`Only ${item.stock} items available`);
      return;
    }

    // Update request status
    setStockRequests(prev =>
      prev.map(r =>
        r.id === requestId ? { ...r, status: 'approved' as const } : r
      )
    );

    // Allocate to staff's shop
    const existingShopItem = items.find(i =>
      i.name === item.name &&
      i.shopId === request.shopId
    );

    if (existingShopItem) {
      updateItem(existingShopItem.id, { stock: existingShopItem.stock + request.qty });
    } else {
      addItem({
        name: item.name,
        category: item.category,
        itemType: item.itemType,
        stock: request.qty,
        price: item.price,
        reorderLevel: item.reorderLevel,
        initialStock: request.qty,
        shopId: request.shopId,
        supplier: item.supplier,
      });
    }

    // Deduct from unallocated stock
    updateItem(item.id, { stock: item.stock - request.qty });

    alert(`Request approved: ${request.qty} ${request.itemName} allocated`);
  };

  // Admin: Reject stock request
  const handleRejectRequest = (requestId: string) => {
    setStockRequests(prev =>
      prev.map(r =>
        r.id === requestId ? { ...r, status: 'rejected' as const } : r
      )
    );
    alert("Request rejected");
  };

  if (currentUser?.roles.includes('admin')) {
    // Admin view: Approve/reject stock requests
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Stock Allocation Management</h2>

        {/* Pending Stock Requests */}
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Pending Stock Requests</h3>
          {stockRequests.filter(r => r.status === 'pending').length === 0 ? (
            <p className="text-gray-500 text-center py-4">No pending requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Staff</th>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Available</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRequests
                    .filter(r => r.status === 'pending')
                    .map((request) => {
                      const item = items.find(i => i.id === request.itemId);
                      return (
                        <tr key={request.id} className="border-t">
                          <td className="p-3 text-sm">
                            {new Date(request.requestedDate).toLocaleDateString()}
                          </td>
                          <td className="p-3">{request.staffName}</td>
                          <td className="p-3 font-medium">{request.itemName}</td>
                          <td className="p-3 text-right">{request.qty}</td>
                          <td className="p-3 text-right">{item?.stock || 0}</td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleApproveRequest(request.id)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                disabled={!item || request.qty > (item.stock || 0)}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRequest(request.id)}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                              >
                                Reject
                              </button>
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

  // Staff view: Record allocations and request stock
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">My Stock & Requests</h2>

      {/* Record Allocation from Purchase */}
      <div className="bg-white p-6 rounded shadow border-2 border-green-200">
        <h3 className="text-lg font-semibold mb-2 text-green-800">Record My Allocation</h3>
        <p className="text-sm text-gray-600 mb-4">
          When admin purchases stock, record what was allocated to you.
        </p>

        {purchasesNeedingAllocation.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-yellow-800 font-semibold">No confirmed purchases available for allocation.</p>
            <p className="text-sm text-yellow-700 mt-2">
              Admin needs to confirm purchases first. Once confirmed, you'll be able to record your allocations here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Step 1: Select Purchase *
              </label>
              <select
                value={selectedPurchaseId}
                onChange={(e) => {
                  setSelectedPurchaseId(e.target.value);
                  setSelectedItemId("");
                  setAllocationQty(0);
                }}
                className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
              >
                <option value="">-- Select a purchase --</option>
                {purchasesNeedingAllocation.map((purchase) => (
                  <option key={purchase.id} value={purchase.id}>
                    {new Date(purchase.date).toLocaleDateString()} - {purchase.supplier} - {purchase.items.length} items
                  </option>
                ))}
              </select>
            </div>

            {selectedPurchaseId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Step 2: Select Item *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      setSelectedItemId(Number(e.target.value));
                      setAllocationQty(0);
                    }}
                    className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  >
                    <option value="">-- Select item --</option>
                    {availableItemsFromPurchase.map((item) => (
                      <option key={item.itemId} value={item.itemId}>
                        {item.itemName} (Available: {item.available})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItemId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Step 3: Enter Quantity Allocated to Me *
                      </label>
                      <input
                        type="number"
                        value={allocationQty || ""}
                        onChange={(e) => setAllocationQty(Number(e.target.value))}
                        className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                        min="1"
                        max={
                          availableItemsFromPurchase.find(i => i.itemId === selectedItemId)?.available || 0
                        }
                        placeholder="Enter quantity"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Available: <span className="font-semibold">{availableItemsFromPurchase.find(i => i.itemId === selectedItemId)?.available || 0}</span>
                      </p>
                    </div>

                    <button
                      onClick={handleRecordAllocation}
                      className={`w-full px-4 py-3 rounded font-semibold text-lg transition-colors ${
                        !selectedPurchaseId || !selectedItemId || allocationQty <= 0
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                      }`}
                      disabled={!selectedPurchaseId || !selectedItemId || allocationQty <= 0}
                    >
                      ✓ Record My Allocation
                    </button>
                    {(!selectedPurchaseId || !selectedItemId || allocationQty <= 0) && (
                      <p className="text-xs text-gray-500 text-center">
                        Please complete all steps above to enable the button
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Request Additional Stock */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Request Additional Stock</h3>
        <p className="text-sm text-gray-600 mb-4">
          Request additional stock from unallocated inventory when you finish your allocated stock.
        </p>

        {unallocatedItems.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <p className="text-gray-600">No unallocated stock available.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Item *
              </label>
              <select
                value={requestItemId}
                onChange={(e) => {
                  setRequestItemId(Number(e.target.value));
                  setRequestQty(0);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select item</option>
                {unallocatedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Available: {item.stock})
                  </option>
                ))}
              </select>
            </div>

            {requestItemId && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity Needed *
                </label>
                <input
                  type="number"
                  value={requestQty || ""}
                  onChange={(e) => setRequestQty(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  min="1"
                  max={unallocatedItems.find(i => i.id === requestItemId)?.stock || 0}
                  placeholder="Enter quantity"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {unallocatedItems.find(i => i.id === requestItemId)?.stock || 0}
                </p>
              </div>
            )}

            <button
              onClick={handleRequestStock}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
              disabled={!requestItemId || requestQty <= 0}
            >
              Request Stock
            </button>
          </>
        )}
      </div>

      {/* My Allocations */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">My Allocations</h3>
        {myAllocations.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No allocations recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {myAllocations.map((allocation) => (
                  <tr key={allocation.id} className="border-t">
                    <td className="p-3 text-sm">
                      {new Date(allocation.allocatedDate).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-medium">{allocation.itemName}</td>
                    <td className="p-3 text-right font-semibold">{allocation.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My Requests */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">My Stock Requests</h3>
        {myRequests.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No requests submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((request) => (
                  <tr key={request.id} className="border-t">
                    <td className="p-3 text-sm">
                      {new Date(request.requestedDate).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-medium">{request.itemName}</td>
                    <td className="p-3 text-right">{request.qty}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : request.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {request.status === 'approved'
                          ? 'Approved'
                          : request.status === 'rejected'
                          ? 'Rejected'
                          : 'Pending'}
                      </span>
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
