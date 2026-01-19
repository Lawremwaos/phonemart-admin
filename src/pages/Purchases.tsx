import { useState } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

type PurchaseItem = {
  itemId: number;
  itemName: string;
  qty: number;
  costPrice: number;
};

export default function Purchases() {
  const { items, purchases, addPurchase } = useInventory();
  const { currentShop, currentUser } = useShop();
  
  const [supplier, setSupplier] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [qty, setQty] = useState(1);
  const [costPrice, setCostPrice] = useState(0);

  // Filter items by shop
  const availableItems = currentUser?.role === 'admin'
    ? items
    : items.filter(item => !item.shopId || item.shopId === currentShop?.id);

  // Filter purchases by shop
  const filteredPurchases = currentUser?.role === 'admin'
    ? purchases
    : purchases.filter(p => !p.shopId || p.shopId === currentShop?.id);

  const handleAddItem = () => {
    if (!selectedItemId || qty <= 0 || costPrice <= 0) {
      alert("Please select an item and enter valid quantity and cost price");
      return;
    }

    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    setPurchaseItems(prev => [
      ...prev,
      {
        itemId: item.id,
        itemName: item.name,
        qty,
        costPrice,
      },
    ]);

    setSelectedItemId("");
    setQty(1);
    setCostPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCompletePurchase = () => {
    if (!supplier || purchaseItems.length === 0) {
      alert("Please enter supplier name and add at least one item");
      return;
    }

    const total = purchaseItems.reduce((sum, item) => sum + (item.qty * item.costPrice), 0);
    
    addPurchase({
      supplier,
      items: purchaseItems,
      total,
      shopId: currentShop?.id,
    });

    // Reset form
    setSupplier("");
    setPurchaseItems([]);
    setSelectedItemId("");
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
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Name *</label>
          <input
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            placeholder="Enter supplier name"
          />
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(Number(e.target.value));
                const item = items.find(i => i.id === Number(e.target.value));
                if (item?.costPrice) {
                  setCostPrice(item.costPrice);
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select Item</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cost Price (KES) *</label>
            <input
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              min="0"
            />
          </div>
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
                  <span>{item.itemName} x {item.qty} @ KES {item.costPrice.toLocaleString()}</span>
                  <div className="flex gap-2 items-center">
                    <span className="font-semibold">KES {(item.qty * item.costPrice).toLocaleString()}</span>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t font-bold text-right">
                Total: KES {purchaseItems.reduce((sum, item) => sum + (item.qty * item.costPrice), 0).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleCompletePurchase}
          className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
          disabled={!supplier || purchaseItems.length === 0}
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
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t">
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
                    <td className="p-3 text-right font-semibold">
                      KES {purchase.total.toLocaleString()}
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
