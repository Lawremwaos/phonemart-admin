import { useState, useMemo, useEffect } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

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
  const { items, purchases, updateItem, addItem, stockAllocations, approveStockAllocation, requestStockAllocation, refreshStockAllocations } = useInventory();
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

  // Store requests in state (in production, these would be in Supabase)
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);

  // Request states (for staff)
  const [requestItemId, setRequestItemId] = useState<number | "">("");
  const [requestQty, setRequestQty] = useState(0);

  // Admin allocation states
  const [adminSelectedPurchaseId, setAdminSelectedPurchaseId] = useState<string>("");
  const [adminSelectedItemId, setAdminSelectedItemId] = useState<number | "">("");
  const [adminSelectedShopId, setAdminSelectedShopId] = useState<string>("");
  const [adminAllocationQty, setAdminAllocationQty] = useState(0);



  // Get ALL unallocated ACCESSORIES from inventory (for requesting additional stock) - staff can see these
  // Show all unallocated accessories (no shopId) with stock > 0
  // Note: pendingAllocation flag indicates items from purchases, but staff can still request unallocated stock
  const unallocatedItems = useMemo(() => {
    const isAccessory = (cat: string | undefined) => {
      const c = cat?.toString().toLowerCase() ?? '';
      return c === 'accessory' || c === 'accessories';
    };
    return items.filter(item => 
      !item.shopId && // No shopId means unallocated
      item.stock > 0 && // Must have stock available
      isAccessory(item.category) // Must be an accessory
    );
  }, [items]);

  // State for showing/hiding request form
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Get pending allocations for current staff's shop
  const pendingAllocationsForMyShop = useMemo(() => {
    if (!currentShop) return [];
    return stockAllocations.filter(alloc => 
      alloc.status === 'pending' &&
      alloc.allocations.some(a => a.shopId === currentShop.id)
    );
  }, [stockAllocations, currentShop]);


  // Get current staff's requests
  const myRequests = useMemo(() => {
    if (!currentUser) return [];
    return stockRequests.filter(r => r.staffName === currentUser.name);
  }, [stockRequests, currentUser]);

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

  // Handle requesting additional stock
  const handleRequestStock = () => {
    if (!requestItemId || requestQty <= 0) {
      alert("Please select item and enter quantity");
      return;
    }

    const item = unallocatedItems.find(i => i.id === requestItemId);
    if (!item) {
      alert("Item not found");
      return;
    }

    const availableStock = item.stock || 0;
    if (requestQty > availableStock) {
      alert(`Only ${availableStock} items available. Please enter a quantity not exceeding ${availableStock}.`);
      return;
    }

    if (requestQty < 1) {
      alert("Quantity must be at least 1");
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
    alert(`Stock request submitted: ${requestQty} ${item.name}. Waiting for admin approval.`);
    setRequestItemId("");
    setRequestQty(0);
    // Keep form open so staff can request more items
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

  if (currentUser?.roles.includes('admin')) {
    // Admin view: Allocate stock from purchases and approve/reject stock requests
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Stock Allocation Management</h2>

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

  // Staff view: Accept allocations and request stock
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold">My Stock & Requests</h2>
        <button
          onClick={() => {
            setShowRequestForm(!showRequestForm);
            if (!showRequestForm) {
              // Reset form when opening
              setRequestItemId("");
              setRequestQty(0);
            }
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold shadow-lg flex items-center gap-2 transition-all"
        >
          <span>📦</span>
          <span>{showRequestForm ? 'Hide Request Form' : 'Request Additional Stock'}</span>
        </button>
      </div>

      {/* Accept Pending Allocations */}
      {pendingAllocationsForMyShop.length > 0 && (
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
      )}

      {/* Request Stock from Admin Inventory - Expandable Section */}
      {showRequestForm && (
        <div className="bg-white p-6 rounded shadow border-2 border-blue-200">
          <h3 className="text-lg font-semibold mb-2 text-blue-800">Request Additional Stock (Unallocated Accessories)</h3>
          <p className="text-sm text-gray-600 mb-4">
            View unallocated accessories available in admin inventory and request what you need. Select an item and specify the quantity you need (not exceeding available stock).
          </p>

          {unallocatedItems.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800 font-semibold">No unallocated accessories available in admin inventory.</p>
              <p className="text-sm text-yellow-700 mt-1">All accessories have been allocated or are out of stock.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Unallocated Accessory *
                </label>
                <select
                  value={requestItemId}
                  onChange={(e) => {
                    const selectedId = e.target.value ? Number(e.target.value) : "";
                    setRequestItemId(selectedId);
                    setRequestQty(0);
                  }}
                  className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
                >
                  <option value="">-- Select an accessory --</option>
                  {unallocatedItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - Available: {item.stock} units
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {unallocatedItems.length} unallocated accessor{unallocatedItems.length !== 1 ? 'ies' : 'y'} available
                </p>
              </div>

              {requestItemId && (() => {
                const selectedItem = unallocatedItems.find(i => i.id === requestItemId);
                const maxQty = selectedItem?.stock || 0;
                return (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity Needed * (Max: {maxQty})
                      </label>
                      <input
                        type="number"
                        value={requestQty || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          // Prevent exceeding available stock
                          if (val > maxQty) {
                            alert(`Cannot exceed available stock of ${maxQty} units`);
                            setRequestQty(maxQty);
                          } else if (val < 0) {
                            setRequestQty(0);
                          } else {
                            setRequestQty(val);
                          }
                        }}
                        className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        min="1"
                        max={maxQty}
                        placeholder={`Enter quantity (1-${maxQty})`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Available: <span className="font-semibold text-blue-600">{maxQty}</span> units
                        {requestQty > 0 && requestQty <= maxQty && (
                          <span className="ml-2 text-green-600">✓ Valid quantity</span>
                        )}
                        {requestQty > maxQty && (
                          <span className="ml-2 text-red-600">✗ Exceeds available stock</span>
                        )}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleRequestStock}
                        className={`flex-1 px-4 py-2 rounded font-semibold transition ${
                          !requestItemId || requestQty <= 0 || requestQty > maxQty
                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        disabled={!requestItemId || requestQty <= 0 || requestQty > maxQty}
                      >
                        Submit Request
                      </button>
                      <button
                        onClick={() => {
                          setRequestItemId("");
                          setRequestQty(0);
                        }}
                        className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 font-semibold"
                      >
                        Clear
                      </button>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

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
