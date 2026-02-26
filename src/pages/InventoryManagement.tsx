import { Fragment, useState, useMemo } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

export default function InventoryManagement() {
  const { items, addItem, updateItem, removeItem, stockAllocations, requestStockAllocation, approveStockAllocation, rejectStockAllocation } = useInventory();
  const { currentShop, currentUser, shops } = useShop();
  const isAdmin = currentUser?.roles.includes('admin') || false;
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [allocatingItemId, setAllocatingItemId] = useState<number | null>(null);
  const [allocRows, setAllocRows] = useState<Array<{ shopId: string; qty: number }>>([]);
  const [requestingItemId, setRequestingItemId] = useState<number | null>(null);
  const [requestQty, setRequestQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'inventory' | 'allocations'>('inventory');
  const [formData, setFormData] = useState({
    name: "",
    category: "Phone" as 'Phone' | 'Spare' | 'Accessory',
    itemType: "",
    itemTypeDetail: "",
    stock: 0,
    price: 0,
    reorderLevel: 0,
    supplier: "",
    costPrice: 0,
  });

  // Filter items by shop (technicians see only their shop; admin sees all)
  // Staff should NOT see admin unallocated inventory here - they see it in "My Stock & Requests" page
  const filteredItems = useMemo(() => {
    if (!currentUser?.roles.includes('admin')) {
      // Staff only see items allocated to their shop (must have shopId matching their shop)
      return items.filter(item => item.shopId === currentShop?.id);
    }
    // Admin sees all items (categorized by shop in the UI)
    return items;
  }, [items, currentShop, currentUser]);

  // Categorize items for admin view: Shop 1, Shop 2, Other shops, Unallocated
  const categorizedItems = useMemo(() => {
    if (!isAdmin) return { shop1: [], shop2: [], other: [], unallocated: [] };
    
    const shop1Items: typeof items = [];
    const shop2Items: typeof items = [];
    const otherItems: typeof items = [];
    const unallocatedItems: typeof items = [];

    items.forEach(item => {
      if (!item.shopId) {
        unallocatedItems.push(item);
      } else {
        const shop = shops.find(s => s.id === item.shopId);
        const shopName = shop?.name?.toLowerCase() || '';
        
        // Check if it's Shop 1 or Shop 2 (by name containing "shop 1", "shop1", "1", etc.)
        if (shopName.includes('shop 1') || shopName.includes('shop1') || shopName.includes(' 1') || shopName === 'shop 1' || shopName === 'shop1') {
          shop1Items.push(item);
        } else if (shopName.includes('shop 2') || shopName.includes('shop2') || shopName.includes(' 2') || shopName === 'shop 2' || shopName === 'shop2') {
          shop2Items.push(item);
        } else {
          otherItems.push(item);
        }
      }
    });

    return { shop1: shop1Items, shop2: shop2Items, other: otherItems, unallocated: unallocatedItems };
  }, [items, shops, isAdmin]);

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      name: "",
      category: "Phone",
      itemType: "",
      itemTypeDetail: "",
      stock: 0,
      price: 0,
      reorderLevel: 0,
      supplier: "",
      costPrice: 0,
    });
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditingId(item.id);
    // Split itemType if it contains " - "
    const itemTypeParts = (item.itemType || "").split(' - ');
    setFormData({
      name: item.name,
      category: item.category,
      itemType: itemTypeParts[0] || "",
      itemTypeDetail: itemTypeParts[1] || "",
      stock: item.stock,
      price: item.price,
      reorderLevel: item.reorderLevel,
      supplier: item.supplier || "",
      costPrice: item.costPrice || 0,
    });
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!formData.name || formData.stock < 0 || formData.price < 0) {
      alert("Please fill in all required fields with valid values");
      return;
    }

    if (currentUser?.roles.includes('admin') && formData.costPrice <= 0) {
      alert("Admin must enter a valid cost price greater than 0 before saving this stock item.");
      return;
    }

    // Combine itemType and itemTypeDetail for storage
    const finalItemType = formData.itemTypeDetail 
      ? `${formData.itemType} - ${formData.itemTypeDetail}`.trim()
      : formData.itemType;

    if (editingId) {
      updateItem(editingId, {
        ...formData,
        itemType: finalItemType,
        shopId: currentShop?.id,
      });
      setEditingId(null);
    } else {
      addItem({
        ...formData,
        itemType: finalItemType,
        shopId: currentShop?.id,
        initialStock: formData.stock,
      });
      setIsAdding(false);
    }

    setFormData({
      name: "",
      category: "Phone",
      itemType: "",
      itemTypeDetail: "",
      stock: 0,
      price: 0,
      reorderLevel: 0,
      supplier: "",
      costPrice: 0,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: "",
      category: "Phone",
      itemType: "",
      itemTypeDetail: "",
      stock: 0,
      price: 0,
      reorderLevel: 0,
      supplier: "",
      costPrice: 0,
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      removeItem(id);
    }
  };

  const unassignedItems = useMemo(() =>
    items.filter(i => !i.shopId && i.stock > 0),
    [items]
  );

  const openAllocateForm = (item: typeof items[0]) => {
    setAllocatingItemId(item.id);
    setAllocRows([{ shopId: shops[0]?.id || "", qty: 1 }]);
  };

  const handleAllocate = () => {
    const item = items.find(i => i.id === allocatingItemId);
    if (!item) return;

    const validRows = allocRows.filter(r => r.shopId && r.qty > 0);
    if (validRows.length === 0) {
      alert("Please add at least one allocation with a shop and quantity.");
      return;
    }

    const totalAllocQty = validRows.reduce((s, r) => s + r.qty, 0);
    const availableStock = item.shopId ? item.stock : item.stock;
    if (totalAllocQty > availableStock) {
      alert(`Total allocation (${totalAllocQty}) exceeds available stock (${availableStock}).`);
      return;
    }

    requestStockAllocation({
      itemId: item.id,
      itemName: item.name,
      totalQty: totalAllocQty,
      allocations: validRows.map(r => ({
        shopId: r.shopId,
        shopName: shops.find(s => s.id === r.shopId)?.name || r.shopId,
        qty: r.qty,
      })),
      requestedBy: currentUser?.name || "Unknown",
    });

    setAllocatingItemId(null);
    setAllocRows([]);
    alert("Allocation request submitted!" + (isAdmin ? " Auto-processing..." : " Waiting for admin approval."));
  };

  const handleRequestStock = (item: typeof items[0]) => {
    if (requestQty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }
    if (!currentShop) {
      alert("No shop assigned to you.");
      return;
    }

    requestStockAllocation({
      itemId: item.id,
      itemName: item.name,
      totalQty: requestQty,
      allocations: [{
        shopId: currentShop.id,
        shopName: currentShop.name,
        qty: requestQty,
      }],
      requestedBy: currentUser?.name || "Unknown",
    });

    setRequestingItemId(null);
    setRequestQty(1);
    alert("Stock request submitted! Admin will approve or reject.");
  };

  const getUserName = (name?: string) => name || "Unknown";
  const formatDate = (d: Date) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Helper function to render item row (used for both admin categorized view and staff view)
  const renderItemRow = (item: typeof items[0]) => {
    const lowStock = item.stock <= item.reorderLevel;
    const categoryColor = 
      item.category === 'Phone' ? 'bg-blue-50 border-blue-200' :
      item.category === 'Spare' ? 'bg-orange-50 border-orange-200' :
      'bg-green-50 border-green-200';
    return (
      <Fragment key={item.id}>
        <tr
          className={`border-t ${lowStock ? 'bg-red-50' : categoryColor}`}
        >
          <td className="p-3 font-semibold">{item.name}</td>
          <td className="p-3">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              item.category === 'Phone' ? 'bg-blue-100 text-blue-800' :
              item.category === 'Spare' ? 'bg-orange-100 text-orange-800' :
              'bg-green-100 text-green-800'
            }`}>
              {item.category === 'Spare' ? 'Spare Part' : item.category}
            </span>
          </td>
          <td className="p-3">{item.itemType || '-'}</td>
          <td className={`p-3 font-semibold ${lowStock ? 'text-red-600' : ''}`}>
            {item.stock}
          </td>
          {isAdmin && (
            <td className="p-3 text-sm text-gray-700">
              {item.shopId ? (shops.find(s => s.id === item.shopId)?.name || 'Unknown Shop') : 'Unassigned'}
            </td>
          )}
          <td className="p-3">KES {item.price.toLocaleString()}</td>
          {isAdmin && (
            <td className="p-3">KES {item.costPrice?.toLocaleString() || 'N/A'}</td>
          )}
          <td className="p-3">{item.reorderLevel}</td>
          <td className="p-3">{item.supplier || 'N/A'}</td>
          <td className="p-3">
            {lowStock ? (
              <span className="text-red-600 font-bold">LOW STOCK</span>
            ) : (
              <span className="text-green-600 font-bold">OK</span>
            )}
          </td>
          <td className="p-3">
            <div className="flex flex-wrap gap-1">
              {isAdmin && (
                <>
                  <button onClick={() => handleEdit(item)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">Delete</button>
                </>
              )}
              {isAdmin && item.stock > 0 && (
                <button
                  onClick={() => openAllocateForm(item)}
                  className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
                >
                  Allocate
                </button>
              )}
              {!isAdmin && item.stock <= 0 && (
                <button
                  onClick={() => { setRequestingItemId(item.id); setRequestQty(1); }}
                  className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700"
                >
                  Request Stock
                </button>
              )}
            </div>
          </td>
        </tr>

        {/* Allocation form row */}
        {allocatingItemId === item.id && (
          <tr className="bg-purple-50 border-t">
            <td colSpan={isAdmin ? 11 : 9} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-purple-800">
                    Allocate &quot;{item.name}&quot; (Available: {item.stock})
                  </h4>
                  <button onClick={() => setAllocatingItemId(null)} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                </div>
                {allocRows.map((row, ri) => (
                  <div key={ri} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Shop / Staff</label>
                      <select
                        aria-label="Select shop to allocate to"
                        value={row.shopId}
                        onChange={(e) => {
                          const updated = [...allocRows];
                          updated[ri].shopId = e.target.value;
                          setAllocRows(updated);
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="">Select Shop</option>
                        {shops.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                      <input
                        type="number"
                        aria-label="Quantity to allocate"
                        min="1"
                        max={item.stock}
                        value={row.qty}
                        onChange={(e) => {
                          const updated = [...allocRows];
                          updated[ri].qty = Number(e.target.value);
                          setAllocRows(updated);
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => setAllocRows(allocRows.filter((_, i) => i !== ri))}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAllocRows([...allocRows, { shopId: "", qty: 1 }])}
                    className="text-purple-700 hover:text-purple-900 text-xs font-semibold border border-purple-300 px-3 py-1 rounded hover:bg-purple-50"
                  >
                    + Add Shop
                  </button>
                  <span className="text-xs text-gray-500 self-center">
                    Total: {allocRows.reduce((s, r) => s + r.qty, 0)} / {item.stock}
                  </span>
                </div>
                <button
                  onClick={handleAllocate}
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700"
                >
                  Submit Allocation
                </button>
              </div>
            </td>
          </tr>
        )}

        {/* Request stock form row (staff only) */}
        {requestingItemId === item.id && (
          <tr className="bg-yellow-50 border-t">
            <td colSpan={isAdmin ? 11 : 9} className="p-4">
              <div className="flex items-center gap-4">
                <h4 className="font-semibold text-yellow-800">
                  Request &quot;{item.name}&quot; from unallocated stock
                </h4>
                <div className="w-24">
                  <input
                    type="number"
                    aria-label="Quantity to request"
                    min="1"
                    value={requestQty}
                    onChange={(e) => setRequestQty(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={() => handleRequestStock(item)}
                  className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                >
                  Submit Request
                </button>
                <button
                  onClick={() => setRequestingItemId(null)}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inventory Management</h2>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            + Add Item
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {(['inventory', 'allocations'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t text-sm font-medium ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab === 'inventory' ? 'Inventory Items' : `Stock Allocations (${stockAllocations.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'inventory' && <>
      {/* Admin: Categorized inventory view */}
      {isAdmin && (
        <div className="bg-white p-4 rounded-lg shadow mb-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Inventory by Shop</h3>
          <div className="flex gap-4 flex-wrap">
            <div className="text-sm">
              <span className="font-semibold text-blue-700">Shop 1:</span> {categorizedItems.shop1.length} items
            </div>
            <div className="text-sm">
              <span className="font-semibold text-green-700">Shop 2:</span> {categorizedItems.shop2.length} items
            </div>
            <div className="text-sm">
              <span className="font-semibold text-purple-700">Other:</span> {categorizedItems.other.length} items
            </div>
            <div className="text-sm">
              <span className="font-semibold text-gray-700">Unallocated:</span> {categorizedItems.unallocated.length} items
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? "Edit Item" : "Add New Item"}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., iPhone 14"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={formData.category}
              onChange={(e) => {
                const newCategory = e.target.value as 'Phone' | 'Spare' | 'Accessory';
                setFormData({ ...formData, category: newCategory, itemType: "", itemTypeDetail: "" }); // Reset itemType when category changes
              }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="Phone">Phone</option>
                <option value="Spare">Spare</option>
                <option value="Accessory">Accessory</option>
              </select>
            </div>
            {/* Item Type field based on category */}
            {formData.category === 'Accessory' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of Accessory *</label>
                <select
                  value={formData.itemType}
                  onChange={(e) => {
                    const selectedType = e.target.value;
                    setFormData({ ...formData, itemType: selectedType, itemTypeDetail: "" });
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select Type</option>
                  <option value="Charger">Charger</option>
                  <option value="Protector">Protector</option>
                  <option value="Case">Case</option>
                  <option value="Cable">Cable</option>
                  <option value="Other">Other</option>
                </select>
                {formData.itemType === 'Charger' && (
                  <input
                    type="text"
                    value={formData.itemTypeDetail}
                    onChange={(e) => setFormData({ ...formData, itemTypeDetail: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2"
                    placeholder="e.g., USB-C Charger, Lightning Charger, Wireless Charger"
                  />
                )}
                {formData.itemType === 'Protector' && (
                  <input
                    type="text"
                    value={formData.itemTypeDetail}
                    onChange={(e) => setFormData({ ...formData, itemTypeDetail: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2"
                    placeholder="e.g., Tempered Glass, Film Protector, Privacy Protector"
                  />
                )}
                {formData.itemType === 'Other' && (
                  <input
                    type="text"
                    value={formData.itemTypeDetail}
                    onChange={(e) => setFormData({ ...formData, itemTypeDetail: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2"
                    placeholder="Enter accessory type"
                  />
                )}
              </div>
            )}
            {formData.category === 'Spare' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of Spare Part *</label>
                <select
                  value={formData.itemType}
                  onChange={(e) => {
                    const selectedType = e.target.value;
                    setFormData({ ...formData, itemType: selectedType, itemTypeDetail: "" });
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select Type</option>
                  <option value="Screen">Screen</option>
                  <option value="Battery">Battery</option>
                  <option value="Camera">Camera</option>
                  <option value="Speaker">Speaker</option>
                  <option value="Other">Other</option>
                </select>
                {formData.itemType === 'Screen' && (
                  <input
                    type="text"
                    value={formData.itemTypeDetail}
                    onChange={(e) => setFormData({ ...formData, itemTypeDetail: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2"
                    placeholder="e.g., LCD Screen, OLED Screen, Touch Screen, Display Assembly"
                  />
                )}
                {formData.itemType === 'Other' && (
                  <input
                    type="text"
                    value={formData.itemTypeDetail}
                    onChange={(e) => setFormData({ ...formData, itemTypeDetail: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2"
                    placeholder="Enter spare part type"
                  />
                )}
              </div>
            )}
            {formData.category === 'Phone' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Type</label>
                <input
                  type="text"
                  value={formData.itemType}
                  onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Smartphone, Feature Phone"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
            {currentUser?.roles.includes('admin') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Sold (KES) *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  min="0"
                  placeholder="Enter amount staff sold this item for"
                />
                <p className="text-xs text-gray-500 mt-1">This is the amount the item was sold for, not a fixed price</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level *</label>
              <input
                type="number"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Supplier name"
              />
            </div>
            {currentUser?.roles.includes('admin') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (KES) - Admin Only *</label>
                <input
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  min="0.01"
                  step="0.01"
                  placeholder="Admin: required purchase cost"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Required for profit reporting. Staff cannot see or edit this.</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      {isAdmin ? (
        <div className="space-y-6">
          {/* Shop 1 Inventory */}
          {categorizedItems.shop1.length > 0 && (
            <div className="bg-white rounded shadow overflow-x-auto">
              <div className="bg-blue-100 px-4 py-2 border-b">
                <h3 className="text-lg font-semibold text-blue-800">Shop 1 Inventory ({categorizedItems.shop1.length} items)</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Stock</th>
                    <th className="p-3 text-left">Shop</th>
                    <th className="p-3 text-left">Amount Sold</th>
                    <th className="p-3 text-left">Cost Price</th>
                    <th className="p-3 text-left">Reorder Level</th>
                    <th className="p-3 text-left">Supplier</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categorizedItems.shop1.map((item) => {
                    return renderItemRow(item);
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Shop 2 Inventory */}
          {categorizedItems.shop2.length > 0 && (
            <div className="bg-white rounded shadow overflow-x-auto">
              <div className="bg-green-100 px-4 py-2 border-b">
                <h3 className="text-lg font-semibold text-green-800">Shop 2 Inventory ({categorizedItems.shop2.length} items)</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Stock</th>
                    <th className="p-3 text-left">Shop</th>
                    <th className="p-3 text-left">Amount Sold</th>
                    <th className="p-3 text-left">Cost Price</th>
                    <th className="p-3 text-left">Reorder Level</th>
                    <th className="p-3 text-left">Supplier</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categorizedItems.shop2.map((item) => {
                    return renderItemRow(item);
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Other Shops Inventory */}
          {categorizedItems.other.length > 0 && (
            <div className="bg-white rounded shadow overflow-x-auto">
              <div className="bg-purple-100 px-4 py-2 border-b">
                <h3 className="text-lg font-semibold text-purple-800">Other Shops Inventory ({categorizedItems.other.length} items)</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Stock</th>
                    <th className="p-3 text-left">Shop</th>
                    <th className="p-3 text-left">Amount Sold</th>
                    <th className="p-3 text-left">Cost Price</th>
                    <th className="p-3 text-left">Reorder Level</th>
                    <th className="p-3 text-left">Supplier</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categorizedItems.other.map((item) => {
                    return renderItemRow(item);
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Unallocated Items */}
          {categorizedItems.unallocated.length > 0 && (
            <div className="bg-white rounded shadow overflow-x-auto">
              <div className="bg-gray-100 px-4 py-2 border-b">
                <h3 className="text-lg font-semibold text-gray-800">Unallocated Items ({categorizedItems.unallocated.length} items)</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Stock</th>
                    <th className="p-3 text-left">Shop</th>
                    <th className="p-3 text-left">Amount Sold</th>
                    <th className="p-3 text-left">Cost Price</th>
                    <th className="p-3 text-left">Reorder Level</th>
                    <th className="p-3 text-left">Supplier</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categorizedItems.unallocated.map((item) => {
                    return renderItemRow(item);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Item</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Stock</th>
                <th className="p-3 text-left">Amount Sold</th>
                <th className="p-3 text-left">Reorder Level</th>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => renderItemRow(item))}
            </tbody>
          </table>
        </div>
      )}
      </>}

      {/* Stock Allocations Tab */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          {/* Pending requests (admin can approve/reject) */}
          {isAdmin && stockAllocations.filter(a => a.status === 'pending').length > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-3">Pending Allocation Requests</h3>
              <div className="space-y-3">
                {stockAllocations.filter(a => a.status === 'pending').map(alloc => (
                  <div key={alloc.id} className="bg-white rounded p-4 border shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-lg">{alloc.itemName}</p>
                        <p className="text-sm text-gray-600">
                          Requested by <span className="font-medium text-indigo-700">{getUserName(alloc.requestedBy)}</span> on {formatDate(alloc.requestedDate)}
                        </p>
                        <p className="text-sm mt-1">Total Qty: <span className="font-bold">{alloc.totalQty}</span></p>
                        <div className="mt-2 space-y-1">
                          {alloc.allocations.map((a, i) => (
                            <div key={i} className="text-sm flex gap-2">
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium">{a.shopName}</span>
                              <span className="font-semibold">{a.qty} pcs</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveStockAllocation(alloc.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectStockAllocation(alloc.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All allocations history */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-lg mb-3">Allocation History</h3>
            {stockAllocations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No stock allocations yet. Use the "Allocate" button on any inventory item to distribute stock to shops.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Item</th>
                      <th className="p-3 text-left">Allocated By</th>
                      <th className="p-3 text-center">Total Qty</th>
                      <th className="p-3 text-left">Distribution</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockAllocations
                      .sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime())
                      .map(alloc => (
                        <tr key={alloc.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">{formatDate(alloc.requestedDate)}</td>
                          <td className="p-3 font-semibold">{alloc.itemName}</td>
                          <td className="p-3">
                            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded font-medium">
                              {getUserName(alloc.requestedBy)}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">{alloc.totalQty}</td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {alloc.allocations.map((a, i) => (
                                <div key={i} className="flex gap-2 items-center text-xs">
                                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-medium">{a.shopName}</span>
                                  <span className="font-semibold">{a.qty} pcs</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              alloc.status === 'approved' ? 'bg-green-100 text-green-800' :
                              alloc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {alloc.status === 'approved' ? 'Approved' : alloc.status === 'rejected' ? 'Rejected' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unallocated stock summary (admin view) */}
          {isAdmin && unassignedItems.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-lg mb-3">Unallocated Stock</h3>
              <p className="text-sm text-gray-600 mb-3">These items have stock but are not assigned to any shop. Use "Allocate" from the Inventory tab to distribute.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {unassignedItems.map(item => (
                  <div key={item.id} className="border rounded p-3 bg-gray-50">
                    <p className="font-semibold truncate" title={item.name}>{item.name}</p>
                    <p className="text-sm text-gray-600">{item.category} {item.itemType ? `- ${item.itemType}` : ''}</p>
                    <p className="text-lg font-bold text-purple-700 mt-1">{item.stock} pcs</p>
                    <button
                      onClick={() => { setActiveTab('inventory'); openAllocateForm(item); }}
                      className="mt-2 text-purple-700 hover:text-purple-900 text-xs font-semibold border border-purple-300 px-2 py-1 rounded hover:bg-purple-50 w-full"
                    >
                      Allocate Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
