import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import InventoryAlerts from "../components/InventoryAlerts";

export default function Inventory() {
  const {
    items,
    updateItem,
    removeItem,
    addAuditLog,
    managerApprovals,
    requestManagerApproval,
    approveManagerApproval,
    rejectManagerApproval,
    getStockMath,
  } = useInventory();
  const { currentShop, currentUser, shops } = useShop();
  const isAdmin = currentUser?.roles.includes("admin") || false;
  const isManager = currentUser?.roles.includes("manager") || false;
  const canEditStock = isAdmin || isManager;
  const canViewAllStock = isAdmin || isManager;

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Phone" as "Phone" | "Spare" | "Accessory",
    itemType: "",
    stock: 0,
    price: 0,
    reorderLevel: 0,
    supplier: "",
    costPrice: 0,
    shopId: "",
  });

  // Filter items: Admin sees all, staff sees only their allocated items (items with shopId matching their shop)
  const filteredItems = useMemo(
    () =>
      canViewAllStock
        ? items
        : items.filter((item) => item.shopId === currentShop?.id),
    [canViewAllStock, items, currentShop]
  );

  const pendingManagerApprovals = useMemo(
    () => managerApprovals.filter((a) => a.status === "pending"),
    [managerApprovals]
  );

  const openEdit = (item: typeof items[0]) => {
    setEditingItemId(item.id);
    setFormData({
      name: item.name,
      category: item.category,
      itemType: item.itemType || "",
      stock: item.stock,
      price: item.price,
      reorderLevel: item.reorderLevel,
      supplier: item.supplier || "",
      costPrice: item.costPrice || 0,
      shopId: item.shopId || "",
    });
  };

  const closeEdit = () => {
    setEditingItemId(null);
  };

  const handleSave = () => {
    if (!editingItemId) return;
    if (!formData.name.trim() || formData.stock < 0 || formData.price < 0 || formData.reorderLevel < 0) {
      alert("Please enter valid item details.");
      return;
    }

    const previousItem = items.find((i) => i.id === editingItemId);
    const updates = {
      name: formData.name.trim(),
      category: formData.category,
      itemType: formData.itemType.trim() || undefined,
      stock: formData.stock,
      price: formData.price,
      reorderLevel: formData.reorderLevel,
      supplier: formData.supplier.trim() || undefined,
      costPrice: formData.costPrice > 0 ? formData.costPrice : undefined,
      shopId: formData.shopId || undefined,
    };

    if (isManager && !isAdmin) {
      void requestManagerApproval({
        action: "inventory_update",
        requestedBy: currentUser?.name || "Manager",
        payload: { itemId: editingItemId, updates },
        notes: "Manager requested inventory update. Waiting for admin approval.",
      });
      alert("Update request submitted to admin for approval.");
      closeEdit();
      return;
    }

    updateItem(editingItemId, updates);
    void addAuditLog({
      action: "edit",
      itemId: editingItemId,
      itemName: formData.name.trim(),
      qty: formData.stock,
      sourceShopId: previousItem?.shopId,
      targetShopId: formData.shopId || undefined,
      targetShopName: shops.find((s) => s.id === formData.shopId)?.name,
      actor: currentUser?.name || "Unknown",
      details: "Inventory item edited from Inventory page.",
    });
    closeEdit();
  };

  const handleDelete = (itemId: number) => {
    if (!canEditStock) {
      alert("You don't have permission to delete stock items.");
      return;
    }
    if (!window.confirm("Delete this stock item? This cannot be undone.")) return;
    const item = items.find((i) => i.id === itemId);

    if (isManager && !isAdmin) {
      void requestManagerApproval({
        action: "inventory_delete",
        requestedBy: currentUser?.name || "Manager",
        payload: { itemId },
        notes: `Manager requested delete for ${item?.name || "item"}.`,
      });
      alert("Delete request submitted to admin for approval.");
      return;
    }

    void addAuditLog({
      action: "delete",
      itemId,
      itemName: item?.name,
      qty: item?.stock,
      sourceShopId: item?.shopId,
      actor: currentUser?.name || "Unknown",
      details: "Inventory item deleted from Inventory page.",
    });
    removeItem(itemId);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Inventory</h2>
        <Link
          to="/inventory/manage"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Manage Inventory
        </Link>
      </div>

      {/* Inventory Alerts */}
      <div className="mb-6">
        <InventoryAlerts />
      </div>

      {isAdmin && pendingManagerApprovals.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded p-4">
          <h3 className="font-semibold text-yellow-900 mb-3">Manager Approval Queue</h3>
          <div className="space-y-2">
            {pendingManagerApprovals.map((req) => (
              <div key={req.id} className="bg-white border rounded p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">
                    {req.action === "inventory_update"
                      ? "Inventory Edit"
                      : req.action === "inventory_delete"
                      ? "Inventory Delete"
                      : "Stock Allocation"}
                  </p>
                  <p className="text-xs text-gray-600">
                    Requested by {req.requestedBy || "Unknown"} on {new Date(req.requestedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void approveManagerApproval(req.id)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectManagerApproval(req.id, "Rejected by admin")}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Category</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Price</th>
              {canViewAllStock && <th className="p-3">Shop</th>}
              <th className="p-3">Math Check</th>
              <th className="p-3">Status</th>
              {canEditStock && <th className="p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const lowStock = item.stock <= item.reorderLevel;
              const math = getStockMath(item.id);
              return (
                <tr 
                  key={item.id} 
                  className={`border-t ${lowStock ? 'bg-red-50' : ''}`}
                >
                  <td className="p-3">{item.name}</td>
                  <td className="p-3">{item.category}</td>
                  <td className={`p-3 font-semibold ${lowStock ? 'text-red-600' : ''}`}>
                    {item.stock}
                  </td>
                  <td className="p-3">KES {item.price}</td>
                  {canViewAllStock && (
                    <td className="p-3">{item.shopId ? shops.find((s) => s.id === item.shopId)?.name || "Unknown" : "Unassigned"}</td>
                  )}
                  <td className="p-3 text-xs">
                    {math.matches ? (
                      <span className="text-green-700 font-semibold">Balanced</span>
                    ) : (
                      <span className="text-red-700 font-semibold">Mismatch ({math.expectedStock} expected)</span>
                    )}
                  </td>
                  <td className="p-3">
                    {lowStock ? (
                      <span className="text-red-600 font-bold">LOW STOCK</span>
                    ) : (
                      <span className="text-green-600 font-bold">OK</span>
                    )}
                  </td>
                  {canEditStock && (
                    <td className="p-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEditStock && editingItemId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-xl font-bold mb-4">Edit Stock Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as "Phone" | "Spare" | "Accessory" })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="Phone">Phone</option>
                  <option value="Spare">Spare</option>
                  <option value="Accessory">Accessory</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <input
                  type="text"
                  value={formData.itemType}
                  onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Selling Price (KES)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cost Price (KES)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Assigned Shop</label>
                <select
                  value={formData.shopId}
                  onChange={(e) => setFormData({ ...formData, shopId: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeEdit}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
