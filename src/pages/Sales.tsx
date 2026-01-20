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
  const { addSale, openWholesaleSale, addItemToWholesaleSale, closeWholesaleSale } = useSales();
  const { currentShop } = useShop();
  const { addPayment } = usePayment();

  const [saleType, setSaleType] = useState<'retail' | 'wholesale'>('retail');
  
  // For retail sales
  const [selectedItemName, setSelectedItemName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'mpesa' | 'bank_deposit'>('mpesa');
  const [amountPaid, setAmountPaid] = useState(0);
  const [bank, setBank] = useState<string>('');
  const [depositReference, setDepositReference] = useState<string>('');

  // For wholesale sales (closing)
  const [wholesalePaymentType, setWholesalePaymentType] = useState<'cash' | 'mpesa' | 'bank_deposit'>('mpesa');
  const [wholesaleBank, setWholesaleBank] = useState<string>('');
  const [wholesaleDepositReference, setWholesaleDepositReference] = useState<string>('');

  // Filter items to show only phones and accessories (not spares for repairs)
  const salesItems = items.filter(item => 
    item.category === 'Phone' || item.category === 'Accessory'
  );

  // Get selected item from inventory
  const selectedItem = salesItems.find(item => item.name === selectedItemName);

  // Update price when item is selected - but staff can change it
  const handleItemSelect = (itemName: string) => {
    setSelectedItemName(itemName);
    const item = items.find(i => i.name === itemName);
    if (item) {
      // Set initial price but staff can modify it
      setPrice(item.price || 0);
    }
  };

  // Add item to retail sale
  function addItemToRetailSale() {
    if (!selectedItemName || qty <= 0 || price <= 0) return;

    const inventoryItem = salesItems.find(item => item.name === selectedItemName);
    if (!inventoryItem) {
      alert("Item not found in inventory!");
      return;
    }

    if (inventoryItem.stock < qty) {
      alert(`Not enough stock! Available: ${inventoryItem.stock}`);
      return;
    }

    setSaleItems((prev) => [
      ...prev,
      { name: selectedItemName, qty, price },
    ]);

    deductStock(selectedItemName, qty);

    setSelectedItemName("");
    setQty(1);
    setPrice(0);
  }

  // Add item to wholesale sale
  function addItemToWholesale() {
    if (!selectedItemName) {
      alert("Please select an item");
      return;
    }

    if (qty <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    if (price <= 0) {
      alert("Price must be greater than 0");
      return;
    }

    const inventoryItem = salesItems.find(item => item.name === selectedItemName);
    if (!inventoryItem) {
      alert("Item not found in inventory!");
      return;
    }

    if (inventoryItem.stock < qty) {
      alert(`Not enough stock! Available: ${inventoryItem.stock}`);
      return;
    }

    try {
      // Add to wholesale sale
      addItemToWholesaleSale({ name: selectedItemName, qty, price }, currentShop?.id);
      
      // Deduct inventory
      deductStock(selectedItemName, qty);

      // Clear form
      setSelectedItemName("");
      setQty(1);
      setPrice(0);
    } catch (error) {
      console.error('Error adding item to wholesale sale:', error);
      alert("Error adding item. Please try again.");
    }
  }

  function removeItemFromRetail(index: number) {
    const itemToRemove = saleItems[index];
    const inventoryItem = salesItems.find(item => item.name === itemToRemove.name);
    if (inventoryItem) {
      addStock(inventoryItem.id, itemToRemove.qty);
    }
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  }

  const retailTotal = saleItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );

  const wholesaleTotal = openWholesaleSale?.total || 0;
  const wholesaleItems = openWholesaleSale?.items || [];

  // Handle retail sale completion
  function completeRetailSale() {
    if (saleItems.length === 0) {
      alert("Please add at least one item");
      return;
    }

    const paidAmount = amountPaid || retailTotal;
    const balance = retailTotal - paidAmount;
    const paymentStatus = balance <= 0 ? 'fully_paid' : paidAmount > 0 ? 'partial' : 'pending';
    
    const sale = {
      id: Date.now().toString(),
      date: new Date(),
      shopId: currentShop?.id,
      saleType: 'retail' as const,
      items: saleItems,
      total: retailTotal,
      paymentType,
      paymentStatus,
      amountPaid: paidAmount,
      balance,
      bank: paymentType === 'bank_deposit' ? bank : undefined,
      depositReference: paymentType === 'bank_deposit' ? depositReference : undefined,
    };
    
    addSale(saleItems, retailTotal, currentShop?.id, 'retail');
    
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
    
    navigate('/receipt', { state: { sale } });
  }

  // Handle wholesale sale closure
  function handleCloseWholesaleSale() {
    if (!openWholesaleSale || wholesaleItems.length === 0) {
      alert("No open wholesale sale to close");
      return;
    }

    if (wholesalePaymentType === 'bank_deposit' && !wholesaleBank) {
      alert("Please select a bank");
      return;
    }

    if (!wholesaleDepositReference) {
      alert("Please enter transaction code/reference");
      return;
    }

    // Close the wholesale sale
    closeWholesaleSale(wholesalePaymentType, wholesaleDepositReference, wholesaleBank);

    // Add payment record
    addPayment({
      type: wholesalePaymentType,
      amount: wholesaleTotal,
      state: 'fully_paid',
      bank: wholesaleBank as any,
      depositReference: wholesaleDepositReference,
      shopId: currentShop?.id,
      relatedTo: 'sale',
      relatedId: openWholesaleSale.id,
      deposited: wholesalePaymentType === 'cash' ? false : true,
    });

    alert("Wholesale sale closed successfully!");
    
    // Reset form
    setWholesalePaymentType('mpesa');
    setWholesaleBank('');
    setWholesaleDepositReference('');
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Accessories Sales</h2>
        <a
          href="/repair-sales"
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          Go to Repair Sales →
        </a>
      </div>

      {/* Sale Type Selection */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Sale Type</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="retail"
              checked={saleType === 'retail'}
              onChange={(e) => setSaleType(e.target.value as 'retail' | 'wholesale')}
              className="mr-2"
            />
            Regular Retail Sale (Immediate closure)
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="wholesale"
              checked={saleType === 'wholesale'}
              onChange={(e) => setSaleType(e.target.value as 'retail' | 'wholesale')}
              className="mr-2"
            />
            Wholesale Sale (Partner Sale - Open throughout day)
          </label>
        </div>
      </div>

      {/* Retail Sale Section */}
      {saleType === 'retail' && (
        <>
          <div className="bg-white p-4 rounded shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Items to Sale</h3>
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
                placeholder="Amount Sold (KES)"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                min="0"
              />
            </div>
            {selectedItem && (
              <p className="text-sm text-gray-600 mb-2">
                Available stock: {selectedItem.stock} | Last sold for: KES {selectedItem.price || 0}
              </p>
            )}

            <button
              onClick={addItemToRetailSale}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Item
            </button>
          </div>

          {saleItems.length > 0 && (
            <div className="bg-white rounded shadow mb-6">
              <h3 className="text-lg font-semibold p-4 border-b">Current Sale Items</h3>
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Amount Sold</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.qty}</td>
                      <td className="p-3">KES {item.price.toLocaleString()}</td>
                      <td className="p-3">KES {(item.qty * item.price).toLocaleString()}</td>
                      <td className="p-3">
                        <button
                          onClick={() => removeItemFromRetail(index)}
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-4 text-right font-bold border-t">
                TOTAL: KES {retailTotal.toLocaleString()}
              </div>

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
                      value={amountPaid || retailTotal}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-2 w-full"
                      placeholder="Amount paid"
                      min={0}
                      max={retailTotal}
                    />
                    {amountPaid < retailTotal && (
                      <p className="text-sm text-red-600 mt-1">
                        Balance: KES {(retailTotal - amountPaid).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={completeRetailSale}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                  >
                    Complete Sale & Generate Receipt
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Wholesale Sale Section */}
      {saleType === 'wholesale' && (
        <>
          <div className="bg-white p-4 rounded shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Items to Wholesale Sale</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add multiple items throughout the day. The sale will remain open until you close it at the end of the day.
            </p>
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
                placeholder="Unit Price"
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
              onClick={addItemToWholesale}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Item to Wholesale Sale
            </button>
          </div>

          {/* Open Wholesale Sale Display */}
          {openWholesaleSale && wholesaleItems.length > 0 && (
            <div className="bg-white rounded shadow mb-6">
              <div className="p-4 border-b bg-yellow-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Open Wholesale Sale</h3>
                    <p className="text-sm text-gray-600">Started: {new Date(openWholesaleSale.date).toLocaleString()}</p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm font-semibold">
                    OPEN
                  </span>
                </div>
              </div>

              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Amount Sold</th>
                    <th className="p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {wholesaleItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.qty}</td>
                      <td className="p-3">KES {item.price.toLocaleString()}</td>
                      <td className="p-3">KES {(item.qty * item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-4 border-t bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Quantity</p>
                    <p className="text-xl font-bold">{wholesaleItems.reduce((sum, item) => sum + item.qty, 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold">KES {wholesaleTotal.toLocaleString()}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4">Close Sale & Enter Payment Details</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                      <select
                        value={wholesalePaymentType}
                        onChange={(e) => setWholesalePaymentType(e.target.value as 'cash' | 'mpesa' | 'bank_deposit')}
                        className="border border-gray-300 rounded-md px-3 py-2 w-full"
                      >
                        <option value="mpesa">MPESA</option>
                        <option value="cash">Cash</option>
                        <option value="bank_deposit">Bank Deposit</option>
                      </select>
                    </div>

                    {wholesalePaymentType === 'bank_deposit' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bank</label>
                        <select
                          value={wholesaleBank}
                          onChange={(e) => setWholesaleBank(e.target.value)}
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
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Code / Reference <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={wholesaleDepositReference}
                        onChange={(e) => setWholesaleDepositReference(e.target.value.toUpperCase())}
                        className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                        placeholder="Enter transaction code"
                      />
                    </div>

                    <button
                      onClick={handleCloseWholesaleSale}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                    >
                      Close Sale & Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!openWholesaleSale && (
            <div className="bg-white p-6 rounded shadow text-center">
              <p className="text-gray-600">No open wholesale sale. Start adding items to create one.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
