import { useState } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

export default function InventoryManagement() {
  const { items, addItem, updateItem, removeItem } = useInventory();
  const { currentShop, currentUser, shops } = useShop();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Phone" as 'Phone' | 'Spare' | 'Accessory',
    itemType: "",
    itemTypeDetail: "", // For specific type details (e.g., "USB-C" for charger)
    stock: 0,
    price: 0,
    reorderLevel: 0,
    supplier: "",
    costPrice: 0,
  });

  // Filter items by shop (technicians see only their shop, admin sees all)
  const filteredItems = currentUser?.roles.includes('admin') 
    ? items 
    : items.filter(item => !item.shopId || item.shopId === currentShop?.id);

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Inventory Management</h2>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add Item
        </button>
      </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (KES) - Admin Only</label>
                <input
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  min="0"
                  placeholder="Admin: Enter purchase cost"
                />
                <p className="text-xs text-gray-500 mt-1">Only admin can set cost price. Staff cannot see or edit this.</p>
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
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Stock</th>
              {currentUser?.roles.includes('admin') && (
                <th className="p-3 text-left">Shop</th>
              )}
              <th className="p-3 text-left">Amount Sold</th>
              {currentUser?.roles.includes('admin') && (
                <th className="p-3 text-left">Cost Price</th>
              )}
              <th className="p-3 text-left">Reorder Level</th>
              <th className="p-3 text-left">Supplier</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const lowStock = item.stock <= item.reorderLevel;
              // Color code by category
              const categoryColor = 
                item.category === 'Phone' ? 'bg-blue-50 border-blue-200' :
                item.category === 'Spare' ? 'bg-orange-50 border-orange-200' :
                'bg-green-50 border-green-200'; // Accessory
              return (
                <tr
                  key={item.id}
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
                  {currentUser?.roles.includes('admin') && (
                    <td className="p-3 text-sm text-gray-700">
                      {item.shopId ? (shops.find(s => s.id === item.shopId)?.name || 'Unknown Shop') : 'Unassigned'}
                    </td>
                  )}
                  <td className="p-3">KES {item.price.toLocaleString()}</td>
                  {currentUser?.roles.includes('admin') && (
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
                    {currentUser?.roles.includes('admin') ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">View only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
