import { useState, useMemo, useEffect } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

export default function StockAllocation() {
  const { items, purchases, stockAllocations, approveStockAllocation, requestStockAllocation, refreshStockAllocations, auditLogs } = useInventory();
  const { currentUser, currentShop, shops } = useShop();

  // Refresh allocations when component mounts or becomes visible (for staff to see new allocations)
  useEffect(() => {
    // Refresh on mount
    refreshStockAllocations();
    
    // Refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshStockAllocations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refresh periodically (every 10 seconds) as a fallback
    const interval = setInterval(() => {
      refreshStockAllocations();
    }, 10000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [refreshStockAllocations]);

  const [myAllocateItemId, setMyAllocateItemId] = useState<number | "">("");
  const [myAllocateTargetShopId, setMyAllocateTargetShopId] = useState<string>("");
  const [myAllocateQty, setMyAllocateQty] = useState(0);

  // Admin allocation states
  const [adminSelectedPurchaseId, setAdminSelectedPurchaseId] = useState<string>("");
  const [adminSelectedItemId, setAdminSelectedItemId] = useState<number | "">("");
  const [adminSelectedShopId, setAdminSelectedShopId] = useState<string>("");
  const [adminAllocationQty, setAdminAllocationQty] = useState(0);
  const canManageUnallocatedStock =
    currentUser?.roles.includes("admin") || currentUser?.roles.includes("manager");

  // Get pending allocations for current staff's shop
  const pendingAllocationsForMyShop = useMemo(() => {
    if (!currentShop) return [];
    return stockAllocations.filter(alloc => 
      alloc.status === 'pending' &&
      alloc.allocations.some(a => a.shopId === currentShop.id)
    );
  }, [stockAllocations, currentShop]);

  // Staff-owned stock (received/accepted stock at current shop)
  const myStockItems = useMemo(() => {
    if (!currentShop) return [];
    return items.filter(item => item.shopId === currentShop.id && item.stock > 0);
  }, [items, currentShop]);
  const transferHistory = useMemo(
    () =>
      auditLogs.filter(
        (l) => l.action === "allocation_requested" || l.action === "allocation_approved" || l.action === "allocation_rejected"
      ),
    [auditLogs]
  );

  // Staff: Accept pending allocation from admin
  const handleAcceptAllocation = async (allocationId: string) => {
    const allocation = stockAllocations.find(a => a.id === allocationId);
    if (!allocation || allocation.status !== 'pending') {
      alert("Invalid allocation");
      return;
    }

    const myAllocation = allocation.allocations.find(a => a.shopId === currentShop?.id);
    if (!myAllocation) {
      alert("This allocation is not for your shop");
      return;
    }

    if (window.confirm(`Accept ${myAllocation.qty} ${allocation.itemName} allocated to you?`)) {
      approveStockAllocation(allocationId);
      alert(`Accepted: ${myAllocation.qty} ${allocation.itemName} added to your stock`);
    }
  };

  // Staff: Allocate own shop stock to another shop/staff (creates pending request for admin approval)
  const handleAllocateMyStock = () => {
    if (!currentShop) {
      alert("No current shop selected.");
      return;
    }
    if (!myAllocateItemId || !myAllocateTargetShopId || myAllocateQty <= 0) {
      alert("Please select item, destination shop, and quantity.");
      return;
    }
    if (myAllocateTargetShopId === currentShop.id) {
      alert("Please select a different shop/staff.");
      return;
    }

    const sourceItem = myStockItems.find(i => i.id === myAllocateItemId);
    if (!sourceItem) {
      alert("Selected stock item was not found.");
      return;
    }
    if (myAllocateQty > sourceItem.stock) {
      alert(`Only ${sourceItem.stock} in stock for ${sourceItem.name}.`);
      return;
    }

    const targetShop = shops.find(s => s.id === myAllocateTargetShopId);
    if (!targetShop) {
      alert("Destination shop not found.");
      return;
    }

    requestStockAllocation({
      itemId: sourceItem.id,
      itemName: sourceItem.name,
      totalQty: myAllocateQty,
      allocations: [{
        shopId: targetShop.id,
        shopName: targetShop.name,
        qty: myAllocateQty,
      }],
      requestedBy: currentUser?.name || "Unknown",
    });

    alert(`Allocation request submitted: ${myAllocateQty} ${sourceItem.name} to ${targetShop.name}. Waiting for admin approval.`);
    setMyAllocateItemId("");
    setMyAllocateTargetShopId("");
    setMyAllocateQty(0);
  };


  // Admin: Allocate stock from purchase to shop (creates pending allocation)
  const handleAdminAllocateStock = async () => {
    if (!adminSelectedPurchaseId || !adminSelectedItemId || !adminSelectedShopId || adminAllocationQty <= 0) {
      alert("Please select purchase, item, shop, and enter quantity");
      return;
    }

    const purchase = purchases.find(p => p.id === adminSelectedPurchaseId);
    const purchaseItem = purchase?.items.find(i => i.itemId === adminSelectedItemId);
    // Match by ID first, fallback to name
    let inventoryItem = items.find(i => i.id === adminSelectedItemId);
    if (!inventoryItem && purchaseItem) {
      inventoryItem = items.find(i => i.name === purchaseItem.itemName && !i.shopId);
    }
    const targetShop = shops.find(s => s.id === adminSelectedShopId);

    if (!purchase || !purchaseItem || !targetShop || !inventoryItem) {
      alert("Invalid selection");
      return;
    }

    // Check available quantity (unallocated stock)
    const currentStock = inventoryItem.stock || 0;
    if (adminAllocationQty > currentStock) {
      alert(`Only ${currentStock} items available for allocation`);
      return;
    }

    // Create pending stock allocation using requestStockAllocation
    requestStockAllocation({
      itemId: inventoryItem.id,
      itemName: inventoryItem.name,
      totalQty: adminAllocationQty,
      allocations: [{
        shopId: adminSelectedShopId,
        shopName: targetShop.name,
        qty: adminAllocationQty,
      }],
      requestedBy: currentUser?.name || 'Admin',
    });

    alert(`Allocation created: ${adminAllocationQty} ${purchaseItem.itemName} allocated to ${targetShop.name}. Staff can now accept it.`);
    setAdminSelectedPurchaseId("");
    setAdminSelectedItemId("");
    setAdminSelectedShopId("");
    setAdminAllocationQty(0);
  };

  // Get available items from selected purchase for admin allocation
  const adminAvailableItemsFromPurchase = useMemo(() => {
    if (!adminSelectedPurchaseId) return [];
    const purchase = purchases.find(p => p.id === adminSelectedPurchaseId);
    if (!purchase) return [];
    
    return purchase.items.map(purchaseItem => {
      // Match by ID first, then fallback to name match for items created during purchase
      let inventoryItem = items.find(i => i.id === purchaseItem.itemId);
      if (!inventoryItem) {
        inventoryItem = items.find(i => i.name === purchaseItem.itemName && !i.shopId);
      }
      const available = inventoryItem?.stock || purchaseItem.qty;
      
      return {
        ...purchaseItem,
        available: Math.max(0, available),
        inventoryItem,
      };
    }).filter(item => item.available > 0);
  }, [adminSelectedPurchaseId, purchases, items]);

  if (canManageUnallocatedStock) {
    // Admin/Manager view: Allocate stock from unallocated inventory
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Stock Allocation Management</h2>

        {pendingAllocationsForMyShop.length > 0 && (
          <div className="bg-white p-6 rounded shadow border-2 border-blue-200">
            <h3 className="text-lg font-semibold mb-2 text-blue-800">Incoming Allocations To Accept</h3>
            <p className="text-sm text-gray-600 mb-4">
              Stock assigned to your current shop still needs acceptance before it appears in inventory.
            </p>
            <div className="space-y-3">
              {pendingAllocationsForMyShop.map((allocation) => {
                const myAlloc = allocation.allocations.find((a) => a.shopId === currentShop?.id);
                if (!myAlloc) return null;
                return (
                  <div key={allocation.id} className="border rounded-lg p-4 bg-blue-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-lg">{allocation.itemName}</p>
                        <p className="text-sm text-gray-600">Quantity: {myAlloc.qty}</p>
                      </div>
                      <button
                        onClick={() => handleAcceptAllocation(allocation.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                      >
                        Accept Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin: Allocate Stock from Purchases */}
        <div className="bg-white p-6 rounded shadow border-2 border-blue-200">
          <h3 className="text-lg font-semibold mb-2 text-blue-800">Allocate Stock to Shops</h3>
          <p className="text-sm text-gray-600 mb-4">
            Distribute stock from confirmed purchases to shops/staff.
          </p>

          {purchases.filter(p => p.confirmed).length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800 font-semibold">No confirmed purchases available.</p>
              <p className="text-sm text-yellow-700 mt-2">
                Confirm purchases first before allocating stock.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step 1: Select Purchase *
                </label>
                <select
                  value={adminSelectedPurchaseId}
                  onChange={(e) => {
                    setAdminSelectedPurchaseId(e.target.value);
                    setAdminSelectedItemId("");
                    setAdminAllocationQty(0);
                  }}
                  className="w-full border-2 border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">-- Select a purchase --</option>
                  {purchases
                    .filter(p => p.confirmed)
                    .map((purchase) => (
                      <option key={purchase.id} value={purchase.id}>
                        {new Date(purchase.date).toLocaleDateString()} - {purchase.supplier} - {purchase.items.length} items
                      </option>
                    ))}
                </select>
              </div>

              {adminSelectedPurchaseId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Step 2: Select Item *
                    </label>
                    <select
                      value={adminSelectedItemId}
                      onChange={(e) => {
                        setAdminSelectedItemId(Number(e.target.value));
                        setAdminAllocationQty(0);
                      }}
                      className="w-full border-2 border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">-- Select item --</option>
                      {adminAvailableItemsFromPurchase.map((item) => (
                        <option key={item.itemId} value={item.itemId}>
                          {item.itemName} (Available: {item.available})
                        </option>
                      ))}
                    </select>
                  </div>

                  {adminSelectedItemId && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Step 3: Select Shop/Staff *
                        </label>
                        <select
                          value={adminSelectedShopId}
                          onChange={(e) => {
                            setAdminSelectedShopId(e.target.value);
                            setAdminAllocationQty(0);
                          }}
                          className="w-full border-2 border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        >
                          <option value="">-- Select shop --</option>
                          {shops.map((shop) => (
                            <option key={shop.id} value={shop.id}>
                              {shop.name} - {shop.address}
                            </option>
                          ))}
                        </select>
                      </div>

                      {adminSelectedShopId && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Step 4: Enter Quantity to Allocate *
                            </label>
                            <input
                              type="number"
                              value={adminAllocationQty || ""}
                              onChange={(e) => setAdminAllocationQty(Number(e.target.value))}
                              className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              min="1"
                              max={
                                adminAvailableItemsFromPurchase.find(i => i.itemId === adminSelectedItemId)?.available || 0
                              }
                              placeholder="Enter quantity"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Available: <span className="font-semibold">{adminAvailableItemsFromPurchase.find(i => i.itemId === adminSelectedItemId)?.available || 0}</span>
                            </p>
                          </div>

                          <button
                            onClick={handleAdminAllocateStock}
                            className={`w-full px-4 py-3 rounded font-semibold text-lg transition-colors ${
                              !adminSelectedPurchaseId || !adminSelectedItemId || !adminSelectedShopId || adminAllocationQty <= 0
                                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                            }`}
                            disabled={!adminSelectedPurchaseId || !adminSelectedItemId || !adminSelectedShopId || adminAllocationQty <= 0}
                          >
                            ✓ Allocate Stock to Shop
                          </button>
                          {(!adminSelectedPurchaseId || !adminSelectedItemId || !adminSelectedShopId || adminAllocationQty <= 0) && (
                            <p className="text-xs text-gray-500 text-center">
                              Please complete all steps above to enable the button
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Dedicated transfer history table */}
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Transfer History</h3>
          {transferHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transfer history yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Action</th>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-left">From</th>
                    <th className="p-3 text-left">To</th>
                    <th className="p-3 text-left">By</th>
                  </tr>
                </thead>
                <tbody>
                  {transferHistory.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="p-3 text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            log.action === "allocation_approved"
                              ? "bg-green-100 text-green-800"
                              : log.action === "allocation_rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {log.action === "allocation_approved"
                            ? "Approved"
                            : log.action === "allocation_rejected"
                            ? "Rejected"
                            : "Requested"}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{log.itemName || "-"}</td>
                      <td className="p-3 text-right">{log.qty || 0}</td>
                      <td className="p-3 text-sm">{log.sourceShopName || log.sourceShopId || "Unassigned"}</td>
                      <td className="p-3 text-sm">{log.targetShopName || log.targetShopId || "-"}</td>
                      <td className="p-3 text-sm">{log.actor || "-"}</td>
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

  // Staff view: Accept allocations and transfer only their own stock
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">My Stock Transfers</h2>

      {/* Accept Pending Allocations */}
      {pendingAllocationsForMyShop.length > 0 ? (
        <div className="bg-white p-6 rounded shadow border-2 border-blue-200">
          <h3 className="text-lg font-semibold mb-2 text-blue-800">Accept Allocated Stock</h3>
          <p className="text-sm text-gray-600 mb-4">
            Admin has allocated stock to you. Accept it to add it to your inventory.
          </p>
          <div className="space-y-3">
            {pendingAllocationsForMyShop.map((allocation) => {
              const myAlloc = allocation.allocations.find(a => a.shopId === currentShop?.id);
              if (!myAlloc) return null;
              return (
                <div key={allocation.id} className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-lg">{allocation.itemName}</p>
                      <p className="text-sm text-gray-600">Quantity: {myAlloc.qty}</p>
                      <p className="text-xs text-gray-500">
                        Allocated on {allocation.requestedDate.toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptAllocation(allocation.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                    >
                      Accept Stock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Incoming Stock</h3>
          <p className="text-sm text-gray-600">
            No stock is waiting for your acceptance right now. When admin/manager allocates stock to your shop,
            an <strong>Accept Stock</strong> button will appear here.
          </p>
        </div>
      )}

      {/* Allocate my stock to other staff/shops */}
      <div className="bg-white p-6 rounded shadow border border-purple-200">
        <h3 className="text-lg font-semibold mb-2 text-purple-800">Allocate My Stock to Other Staff</h3>
        <p className="text-sm text-gray-600 mb-4">
          Use this when you have already received stock and need to share it with another shop/staff.
        </p>
        {myStockItems.length === 0 ? (
          <p className="text-sm text-gray-500">No stock available in your shop to allocate.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">My Item</label>
              <select
                value={myAllocateItemId}
                onChange={(e) => {
                  setMyAllocateItemId(e.target.value ? Number(e.target.value) : "");
                  setMyAllocateQty(0);
                }}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Select item</option>
                {myStockItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Available: {item.stock})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination Shop/Staff</label>
              <select
                value={myAllocateTargetShopId}
                onChange={(e) => setMyAllocateTargetShopId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Select destination</option>
                {shops
                  .filter(shop => shop.id !== currentShop?.id)
                  .map(shop => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max={myStockItems.find(i => i.id === myAllocateItemId)?.stock || 0}
                value={myAllocateQty || ""}
                onChange={(e) => setMyAllocateQty(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Qty"
              />
            </div>
            <button
              type="button"
              onClick={handleAllocateMyStock}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 font-semibold"
            >
              Submit Allocation
            </button>
          </div>
        )}
      </div>

      {/* My Accepted Allocations */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">My Accepted Allocations</h3>
        {stockAllocations.filter(a => 
          a.status === 'approved' && 
          a.allocations.some(alloc => alloc.shopId === currentShop?.id)
        ).length === 0 ? (
          <p className="text-gray-500 text-center py-4">No accepted allocations yet.</p>
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
                {stockAllocations
                  .filter(a => 
                    a.status === 'approved' && 
                    a.allocations.some(alloc => alloc.shopId === currentShop?.id)
                  )
                  .map((allocation) => {
                    const myAlloc = allocation.allocations.find(a => a.shopId === currentShop?.id);
                    return (
                      <tr key={allocation.id} className="border-t">
                        <td className="p-3 text-sm">
                          {allocation.approvedDate?.toLocaleDateString() || allocation.requestedDate.toLocaleDateString()}
                        </td>
                        <td className="p-3 font-medium">{allocation.itemName}</td>
                        <td className="p-3 text-right font-semibold">{myAlloc?.qty || 0}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                            Accepted
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dedicated transfer history table */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Transfer History</h3>
        {transferHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No transfer history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Action</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-left">From</th>
                  <th className="p-3 text-left">To</th>
                  <th className="p-3 text-left">By</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="p-3 text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          log.action === "allocation_approved"
                            ? "bg-green-100 text-green-800"
                            : log.action === "allocation_rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {log.action === "allocation_approved"
                          ? "Approved"
                          : log.action === "allocation_rejected"
                          ? "Rejected"
                          : "Requested"}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{log.itemName || "-"}</td>
                    <td className="p-3 text-right">{log.qty || 0}</td>
                    <td className="p-3 text-sm">{log.sourceShopName || log.sourceShopId || "Unassigned"}</td>
                    <td className="p-3 text-sm">{log.targetShopName || log.targetShopId || "-"}</td>
                    <td className="p-3 text-sm">{log.actor || "-"}</td>
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
