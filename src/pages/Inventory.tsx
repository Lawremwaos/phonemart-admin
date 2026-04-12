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
    stockMovements,
  } = useInventory();
  const { currentShop, currentUser, shops } = useShop();
  const isAdmin = currentUser?.roles.includes("admin") || false;
  const isManager = currentUser?.roles.includes("manager") || false;
  const canEditStock = isAdmin || isManager;
  const canViewAllStock = isAdmin || isManager;

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [ledgerItemId, setLedgerItemId] = useState<number | null>(null);
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

  const isNotForSaleItem = (item: (typeof filteredItems)[number]) => {
    const type = (item.itemType || "").toLowerCase();
    return type.includes("not for sale") || type.includes("shop use");
  };

  const groupedInventory = useMemo(() => {
    const notForSale = filteredItems.filter((item) => isNotForSaleItem(item));
    const accessories = filteredItems.filter(
      (item) => item.category === "Accessory" && !isNotForSaleItem(item)
    );
    const spares = filteredItems.filter(
      (item) => item.category === "Spare" && !isNotForSaleItem(item)
    );
    const other = filteredItems.filter(
      (item) => item.category === "Phone" && !isNotForSaleItem(item)
    );
    return { accessories, spares, notForSale, other };
  }, [filteredItems]);

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
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Stock</p>
          <h2 className="pm-page-title">Inventory</h2>
          <p className="pm-page-desc">Monitor stock balance, low inventory, and manager approvals.</p>
        </div>
        <Link
          to="/inventory/manage"
          className="pm-btn pm-btn-primary"
        >
          Manage Inventory
        </Link>
      </div>

      {/* Inventory Alerts */}
      <div className="mb-6">
        <InventoryAlerts />
      </div>

      {isAdmin && pendingManagerApprovals.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-3 font-semibold text-amber-900">Manager Approval Queue</h3>
          <div className="space-y-2">
            {pendingManagerApprovals.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-3 rounded border border-[var(--pm-border)] bg-[var(--pm-surface)] p-3">
                <div>
                  <p className="font-medium text-sm">
                    {req.action === "inventory_update"
                      ? "Inventory Edit"
                      : req.action === "inventory_delete"
                      ? "Inventory Delete"
                      : "Stock Allocation"}
                  </p>
                  <p className="text-xs text-[var(--pm-ink-soft)]">
                    Requested by {req.requestedBy || "Unknown"} on {new Date(req.requestedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void approveManagerApproval(req.id)}
                    className="pm-btn pm-btn-success pm-btn-sm"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectManagerApproval(req.id, "Rejected by admin")}
                    className="pm-btn pm-btn-danger pm-btn-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {[
        { key: "accessories", title: "Accessories Stock", rows: groupedInventory.accessories },
        { key: "spares", title: "Spare Parts Stock", rows: groupedInventory.spares },
        { key: "not_for_sale", title: "Not for Sale (Shop Use) Stock", rows: groupedInventory.notForSale },
        { key: "other", title: "Phones / Other Stock", rows: groupedInventory.other },
      ].map((section) => (
        <div key={section.key} className="pm-table-shell">
          <div className="border-b border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-3">
            <p className="font-semibold text-[var(--pm-ink)]">{section.title}</p>
          </div>
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
              {section.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEditStock ? (canViewAllStock ? 8 : 7) : canViewAllStock ? 7 : 6}
                    className="p-4 text-center text-[var(--pm-ink-soft)]"
                  >
                    No items in this section.
                  </td>
                </tr>
              ) : (
                section.rows.flatMap((item) => {
                  const lowStock = item.stock <= item.reorderLevel;
                  const math = getStockMath(item.id);
                  const trail = stockMovements
                    .filter((m) => m.itemId === item.id)
                    .slice(0, 25);
                  const colSpan = canEditStock ? (canViewAllStock ? 8 : 7) : canViewAllStock ? 7 : 6;
                  const mainRow = (
                    <tr
                      key={item.id}
                      className={`border-t border-[var(--pm-border)] ${lowStock ? "bg-red-50" : ""}`}
                    >
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.category}</td>
                      <td className={`p-3 font-semibold ${lowStock ? "text-red-600" : ""}`}>
                        {item.stock}
                      </td>
                      <td className="p-3">KES {item.price}</td>
                      {canViewAllStock && (
                        <td className="p-3">
                          {item.shopId ? shops.find((s) => s.id === item.shopId)?.name || "Unknown" : "Unassigned"}
                        </td>
                      )}
                      <td className="p-3 text-xs">
                        <div className="flex flex-col gap-1">
                          {math.matches ? (
                            <span className="text-green-700 font-semibold">Balanced</span>
                          ) : (
                            <span className="text-red-700 font-semibold">
                              Mismatch ({math.expectedStock} expected)
                            </span>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              className="text-left text-[var(--pm-accent-strong)] underline text-xs font-medium"
                              onClick={() => setLedgerItemId((id) => (id === item.id ? null : item.id))}
                            >
                              {ledgerItemId === item.id ? "Hide stock trail" : "Stock trail (admin)"}
                            </button>
                          )}
                        </div>
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
                              className="pm-btn pm-btn-secondary pm-btn-sm"
                            >
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="pm-btn pm-btn-danger pm-btn-sm"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                  if (!isAdmin || ledgerItemId !== item.id) return [mainRow];
                  const detailRow = (
                    <tr key={`${item.id}-trail`} className="border-t border-[var(--pm-border)] bg-[var(--pm-surface-soft)]">
                      <td className="p-3 text-xs text-[var(--pm-ink-soft)]" colSpan={colSpan}>
                        <p className="font-semibold text-[var(--pm-ink)] mb-2">Recent movements (purchase batches & sales)</p>
                        {trail.length === 0 ? (
                          <p>No movements recorded yet for this item.</p>
                        ) : (
                          <ul className="space-y-1 font-mono">
                            {trail.map((m) => (
                              <li key={m.id}>
                                {new Date(m.createdAt).toLocaleString()} — {m.reason}
                                {m.delta > 0 ? ` +${m.delta}` : ` ${m.delta}`}
                                {m.referenceId ? ` · ref ${m.referenceId}` : ""}
                                {m.sourcePurchaseId
                                  ? ` · from purchase ${m.sourcePurchaseId.slice(0, 8)}…`
                                  : m.reason === "sale" && m.delta < 0
                                    ? " · legacy / unbatched stock"
                                    : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                  return [mainRow, detailRow];
                })
              )}
            </tbody>
          </table>
        </div>
      ))}

      {canEditStock && editingItemId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="pm-modal-panel w-full max-w-2xl p-6">
            <h3 className="text-xl font-bold mb-4">Edit Stock Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pm-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as "Phone" | "Spare" | "Accessory" })
                  }
                  className="pm-input"
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
                  className="pm-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                  className="pm-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Selling Price (KES)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="pm-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
                  className="pm-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="pm-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cost Price (KES)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                  className="pm-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Assigned Shop</label>
                <select
                  value={formData.shopId}
                  onChange={(e) => setFormData({ ...formData, shopId: e.target.value })}
                  className="pm-input"
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
                className="pm-btn pm-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="pm-btn pm-btn-primary"
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
