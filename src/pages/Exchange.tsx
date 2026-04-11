import { useState } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

type ExchangeItem = {
  itemId: number;
  itemName: string;
  qty: number;
};

export default function Exchange() {
  const { items, exchanges, addExchange, confirmExchangeReceipt, completeExchange } = useInventory();
  const { shops, currentShop, currentUser } = useShop();
  
  const [toShopId, setToShopId] = useState("");
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | "">("");
  const [qty, setQty] = useState(1);

  // Get available shops (exclude current shop)
  const availableShops = shops.filter(shop => shop.id !== currentShop?.id);

  // Get items from current shop for exchange (staff can select from their shop's inventory)
  // Also include unassigned items (shopId is null or undefined) for staff
  const shopItems = items.filter(item => {
    if (item.stock <= 0) return false;
    if (currentUser?.roles.includes('admin')) {
      // Admin can see all items
      return true;
    }
    // Staff can see items from their shop or unassigned items
    return !item.shopId || item.shopId === currentShop?.id;
  });

  // Filter exchanges by shop
  const filteredExchanges = currentUser?.roles.includes('admin')
    ? exchanges
    : exchanges.filter(e => e.fromShopId === currentShop?.id || e.toShopId === currentShop?.id);

  const handleAddItem = () => {
    if (!selectedItemId || qty <= 0) {
      alert("Please select an item and enter valid quantity");
      return;
    }

    const item = shopItems.find(i => i.id === selectedItemId);
    if (!item) return;

    // Check if enough stock
    if (item.stock < qty) {
      alert(`Not enough stock! Available: ${item.stock}`);
      return;
    }

    setExchangeItems(prev => [
      ...prev,
      {
        itemId: item.id,
        itemName: item.name,
        qty,
      },
    ]);

    setSelectedItemId("");
    setQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setExchangeItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateExchange = () => {
    if (!toShopId || exchangeItems.length === 0) {
      alert("Please select destination shop and add at least one item");
      return;
    }

    if (!currentShop) {
      alert("No shop selected");
      return;
    }

    addExchange({
      fromShopId: currentShop.id,
      toShopId,
      items: exchangeItems,
      status: 'pending',
    });

    // Reset form
    setToShopId("");
    setExchangeItems([]);
    setSelectedItemId("");
    setQty(1);
    
    alert("Exchange request created!");
  };

  const handleComplete = (exchangeId: string) => {
    if (window.confirm("Complete this exchange? This will transfer items between shops.")) {
      completeExchange(exchangeId);
    }
  };

  const getShopName = (shopId: string) => {
    return shops.find(s => s.id === shopId)?.name || shopId;
  };

  return (
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Stock Movement</p>
          <h2 className="pm-page-title">Exchange Between Shops</h2>
          <p className="pm-page-desc">Create, confirm, and complete inter-shop stock transfers.</p>
        </div>
      </div>

      {/* Exchange Form */}
      <div className="pm-card pm-pad-lg mb-6">
        <h3 className="text-lg font-semibold mb-4">Create Exchange Request</h3>
        
        <div className="mb-4">
          <label className="pm-label">
            From Shop: <span className="font-semibold">{currentShop?.name}</span>
          </label>
        </div>

        <div className="mb-4">
          <label className="pm-label">To Shop *</label>
          <select
            value={toShopId}
            onChange={(e) => setToShopId(e.target.value)}
            className="pm-input"
          >
            <option value="">Select Destination Shop</option>
            {availableShops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="pm-label">Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(Number(e.target.value))}
              className="pm-input"
            >
              <option value="">Select Item</option>
              {shopItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Stock: {item.stock})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="pm-label">Quantity *</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="pm-input"
              min="1"
              max={shopItems.find(i => i.id === selectedItemId)?.stock || 0}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddItem}
              className="pm-btn pm-btn-secondary w-full"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Exchange Items List */}
        {exchangeItems.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Items to Exchange:</h4>
            <div className="rounded border border-[var(--pm-border)] p-4">
              {exchangeItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between border-b border-[var(--pm-border)] py-2 last:border-b-0">
                  <span>{item.itemName} x {item.qty}</span>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="pm-btn pm-btn-danger pm-btn-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleCreateExchange}
          className="pm-btn pm-btn-primary w-full"
          disabled={!toShopId || exchangeItems.length === 0}
        >
          Create Exchange Request
        </button>
      </div>

      {/* Exchange History */}
      <div className="pm-card pm-pad">
        <h3 className="text-lg font-semibold p-4 border-b">Exchange History</h3>
        {filteredExchanges.length === 0 ? (
          <p className="text-[var(--pm-ink-soft)] text-center py-8">No exchanges recorded yet.</p>
        ) : (
          <div className="pm-table-shell rounded-none border-x-0 border-b-0 border-t-0 shadow-none">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">From Shop</th>
                  <th className="p-3 text-left">To Shop</th>
                  <th className="p-3 text-left">Items</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExchanges.map((exchange) => (
                  <tr key={exchange.id} className="border-t border-[var(--pm-border)]">
                    <td className="p-3">
                      {new Date(exchange.date).toLocaleDateString()}
                    </td>
                    <td className="p-3">{getShopName(exchange.fromShopId)}</td>
                    <td className="p-3">{getShopName(exchange.toShopId)}</td>
                    <td className="p-3">
                      {exchange.items.map((item, idx) => (
                        <span key={idx} className="block">
                          {item.itemName} x {item.qty}
                        </span>
                      ))}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        exchange.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : exchange.status === 'confirmed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {exchange.status === 'completed' ? 'Completed' : exchange.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-3">
                      {/* Receiving staff can confirm receipt */}
                      {exchange.status === 'pending' && exchange.toShopId === currentShop?.id && !currentUser?.roles.includes('admin') && (
                        <button
                          onClick={() => {
                            if (window.confirm("Confirm that you have received these items?")) {
                              confirmExchangeReceipt(exchange.id);
                            }
                          }}
                          className="pm-btn pm-btn-secondary pm-btn-sm"
                        >
                          Confirm Receipt
                        </button>
                      )}
                      {/* Admin can complete ONLY after staff confirms receipt */}
                      {exchange.status === 'confirmed' && currentUser?.roles.includes('admin') && (
                        <button
                          onClick={() => handleComplete(exchange.id)}
                          className="pm-btn pm-btn-primary pm-btn-sm"
                        >
                          Complete Exchange
                        </button>
                      )}
                      {/* Admin sees pending exchanges but cannot complete until confirmed */}
                      {exchange.status === 'pending' && currentUser?.roles.includes('admin') && (
                        <span className="text-sm text-yellow-600 font-semibold">
                          Awaiting Receipt Confirmation
                        </span>
                      )}
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
