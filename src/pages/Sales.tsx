import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { useSales } from "../context/SalesContext";
import { useShop } from "../context/ShopContext";

type SaleItem = {
  name: string;
  qty: number;
  price: number;
};

export default function Sales() {
  const navigate = useNavigate();
  const { deductStock, addStock, items } = useInventory();
  const { addSale } = useSales();
  const { currentShop } = useShop();

  const [selectedItemName, setSelectedItemName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [saleType, setSaleType] = useState<'in-shop' | 'wholesale'>('in-shop');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);

  // Get selected item from inventory
  const selectedItem = items.find(item => item.name === selectedItemName);

  // Update price when item is selected
  const handleItemSelect = (itemName: string) => {
    setSelectedItemName(itemName);
    const item = items.find(i => i.name === itemName);
    if (item) {
      setPrice(item.price);
    }
  };

  function addItem() {
    if (!selectedItemName || qty <= 0 || price <= 0) return;

    // Check if item exists in inventory
    const inventoryItem = items.find(item => item.name === selectedItemName);
    if (!inventoryItem) {
      alert("Item not found in inventory!");
      return;
    }

    // Check if enough stock
    if (inventoryItem.stock < qty) {
      alert(`Not enough stock! Available: ${inventoryItem.stock}`);
      return;
    }

    setSaleItems((prev) => [
      ...prev,
      { name: selectedItemName, qty, price },
    ]);

    // Deduct inventory stock
    deductStock(selectedItemName, qty);

    setSelectedItemName("");
    setQty(1);
    setPrice(0);
  }

  function removeItem(index: number) {
    const itemToRemove = saleItems[index];
    // Restore stock when removing item
    const inventoryItem = items.find(item => item.name === itemToRemove.name);
    if (inventoryItem) {
      // Add back the stock that was deducted
      addStock(inventoryItem.id, itemToRemove.qty);
    }
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = saleItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Sales</h2>

      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Sale Type</label>
          <select
            value={saleType}
            onChange={(e) => setSaleType(e.target.value as 'in-shop' | 'wholesale')}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="in-shop">In-Shop Sale</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <select
            className="border p-2 rounded"
            value={selectedItemName}
            onChange={(e) => handleItemSelect(e.target.value)}
          >
            <option value="">Select Item</option>
            {items.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name} (Stock: {item.stock})
              </option>
            ))}
          </select>

          <input
            className="border p-2 rounded"
            type="number"
            placeholder="Qty"
            min="1"
            max={selectedItem?.stock || 0}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />

          <input
            className="border p-2 rounded"
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>
        {selectedItem && (
          <p className="text-sm text-gray-600 mb-2">
            Available stock: {selectedItem.stock} | Default price: KES {selectedItem.price}
          </p>
        )}

        <button
          onClick={addItem}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Item
        </button>
      </div>

      <div className="bg-white rounded shadow">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Price</th>
              <th className="p-3">Total</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {saleItems.map((item, index) => (
              <tr key={index} className="border-t">
                <td className="p-3">{item.name}</td>
                <td className="p-3">{item.qty}</td>
                <td className="p-3">KES {item.price}</td>
                <td className="p-3">
                  KES {item.qty * item.price}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => removeItem(index)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-4 text-right font-bold">
          TOTAL: KES {total}
        </div>
        {saleItems.length > 0 && (
          <div className="p-4 border-t">
            <button
              onClick={() => {
                const sale = {
                  id: Date.now().toString(),
                  date: new Date(),
                  shopId: currentShop?.id,
                  saleType,
                  items: saleItems,
                  total,
                };
                addSale(saleItems, total, currentShop?.id, saleType);
                setSaleItems([]);
                // Navigate to receipt view
                navigate('/receipt', { state: { sale } });
              }}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
            >
              Complete Sale & Generate Receipt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
