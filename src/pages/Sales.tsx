import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { useSales } from "../context/SalesContext";
import { useShop } from "../context/ShopContext";
import { usePayment } from "../context/PaymentContext";

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
  const [paymentType, setPaymentType] = useState<'cash' | 'mpesa' | 'bank_deposit'>('mpesa');
  const [amountPaid, setAmountPaid] = useState(0);
  const [bank, setBank] = useState<string>('');
  const [depositReference, setDepositReference] = useState<string>('');
  const { addPayment } = usePayment();

  // Filter items to show only phones and accessories (not spares for repairs)
  const salesItems = items.filter(item => 
    item.category === 'Phone' || item.category === 'Accessory'
  );

  // Get selected item from inventory
  const selectedItem = salesItems.find(item => item.name === selectedItemName);

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
    const inventoryItem = salesItems.find(item => item.name === selectedItemName);
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
    const inventoryItem = salesItems.find(item => item.name === itemToRemove.name);
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Accessories & Products Sales</h2>
        <a
          href="/repair-sales"
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          Go to Repair Sales →
        </a>
      </div>

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
            {salesItems.map((item) => (
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
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as 'cash' | 'mpesa' | 'bank_deposit')}
                  className="border border-gray-300 rounded-md px-3 py-2 w-full"
                >
                  <option value="mpesa">MPESA</option>
                  <option value="cash">Cash</option>
                  <option value="bank_deposit">Bank Deposit</option>
                </select>
              </div>

              {paymentType === 'bank_deposit' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank</label>
                    <select
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    >
                      <option value="">Select Bank</option>
                      <option value="KCB">KCB</option>
                      <option value="Equity">Equity</option>
                      <option value="Cooperative">Cooperative</option>
                      <option value="Absa">Absa</option>
                      <option value="Standard Chartered">Standard Chartered</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Deposit Reference</label>
                    <input
                      type="text"
                      value={depositReference}
                      onChange={(e) => setDepositReference(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 w-full"
                      placeholder="Enter deposit reference"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid</label>
                <input
                  type="number"
                  value={amountPaid || total}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-3 py-2 w-full"
                  placeholder="Amount paid"
                  min={0}
                  max={total}
                />
                {amountPaid < total && (
                  <p className="text-sm text-red-600 mt-1">
                    Balance: KES {(total - amountPaid).toLocaleString()}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  const paidAmount = amountPaid || total;
                  const balance = total - paidAmount;
                  const paymentStatus = balance <= 0 ? 'fully_paid' : paidAmount > 0 ? 'partial' : 'pending';
                  
                  const sale = {
                    id: Date.now().toString(),
                    date: new Date(),
                    shopId: currentShop?.id,
                    saleType,
                    items: saleItems,
                    total,
                    paymentType,
                    paymentStatus,
                    amountPaid: paidAmount,
                    balance,
                    bank: paymentType === 'bank_deposit' ? bank : undefined,
                    depositReference: paymentType === 'bank_deposit' ? depositReference : undefined,
                  };
                  
                  addSale(saleItems, total, currentShop?.id, saleType);
                  
                  // Add payment record
                  addPayment({
                    type: paymentType,
                    amount: paidAmount,
                    state: paymentStatus === 'fully_paid' ? 'fully_paid' : 'partial',
                    bank: bank as any,
                    depositReference: depositReference || undefined,
                    shopId: currentShop?.id,
                    relatedTo: 'sale',
                    relatedId: sale.id,
                    deposited: paymentType === 'cash' ? false : true,
                  });
                  
                  setSaleItems([]);
                  setAmountPaid(0);
                  setBank('');
                  setDepositReference('');
                  
                  // Navigate to receipt view
                  navigate('/receipt', { state: { sale } });
                }}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
              >
                Complete Sale & Generate Receipt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
