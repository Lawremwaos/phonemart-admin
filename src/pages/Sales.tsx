import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { useSales, type SaleItemInput } from "../context/SalesContext";
import { useShop } from "../context/ShopContext";
import { usePayment } from "../context/PaymentContext";
import ShopSelector from "../components/ShopSelector";

type SaleItem = {
  name: string;
  qty: number;
  price: number;
  source?: 'inventory' | 'custom';
  supplier?: string;
  itemId?: number;
};

export default function Sales() {
  const navigate = useNavigate();
  const { deductStock, addStock, items } = useInventory();
  const { addSale, openWholesaleSale, addItemToWholesaleSale, closeWholesaleSale } = useSales();
  const { currentShop, currentUser } = useShop();
  const { addPayment } = usePayment();

  const [saleType, setSaleType] = useState<'retail' | 'wholesale'>('retail');
  
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [customItemName, setCustomItemName] = useState("");
  const [customSupplier, setCustomSupplier] = useState("");
  const [itemSource, setItemSource] = useState<'inventory' | 'custom'>('inventory');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'mpesa' | 'bank_deposit'>('mpesa');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [bank, setBank] = useState<string>('');
  const [depositReference, setDepositReference] = useState<string>('');

  const [wholesalePaymentType, setWholesalePaymentType] = useState<'cash' | 'mpesa' | 'bank_deposit'>('mpesa');
  const [wholesaleBank, setWholesaleBank] = useState<string>('');
  const [wholesaleDepositReference, setWholesaleDepositReference] = useState<string>('');
  const [isCompletingRetailSale, setIsCompletingRetailSale] = useState(false);
  const retailSaleSubmitLock = useRef(false);

  // Items available for sale: ONLY allocated items
  // For staff: show ONLY items allocated to their shop (not unallocated items)
  // For admin: show all allocated items (can see all shops)
  const isAdmin = currentUser?.roles.includes('admin') ?? false;
  
  const salesItems = items.filter(item => {
    const cat = (item.category || '').toString().toLowerCase();
    const isPhoneOrAccessory = cat === 'phone' || cat === 'accessory';
    const stockQty = Number(item.stock) ?? 0;
    
    if (!isPhoneOrAccessory || stockQty <= 0) {
      return false;
    }
    
    // Only show items that are allocated (have a shopId) and not pending allocation
    if (item.pendingAllocation || !item.shopId) {
      return false; // Don't show unallocated or pending items
    }
    
    // Admin can see all allocated items
    if (isAdmin) {
      return true;
    }
    
    // Staff can ONLY see items allocated to their shop
    return item.shopId === currentShop?.id;
  });

  const selectedItem = itemSource === 'inventory' && selectedItemId
    ? salesItems.find(item => item.id === Number(selectedItemId))
    : null;

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = salesItems.find(i => i.id === Number(itemId));
    setPrice(item?.price ?? 0);
  };

  function addItemToRetailSale() {
    if (itemSource === 'inventory') {
      if (!selectedItem || qty <= 0) {
        alert("Please select an item and enter a valid quantity.");
        return;
      }
      if (selectedItem.stock < qty) {
        alert(`Not enough stock! Available: ${selectedItem.stock}`);
        return;
      }
      setSaleItems((prev) => [
        ...prev,
        { name: selectedItem.name, qty, price, source: 'inventory', itemId: selectedItem.id },
      ]);
      deductStock(selectedItem.name, qty, selectedItem.shopId);
    } else {
      if (!customItemName.trim() || qty <= 0) {
        alert("Please enter item name and valid quantity.");
        return;
      }
      setSaleItems((prev) => [
        ...prev,
        { name: customItemName.trim(), qty, price, source: 'custom', supplier: customSupplier.trim() || undefined },
      ]);
      setCustomItemName("");
      setCustomSupplier("");
    }

    setSelectedItemId("");
    setQty(1);
    setPrice(0);
  }

  // Add item to wholesale sale
  function addItemToWholesale() {
    if (!selectedItem) {
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

    if (selectedItem.stock < qty) {
      alert(`Not enough stock! Available: ${selectedItem.stock}`);
      return;
    }

    try {
      addItemToWholesaleSale({
        name: selectedItem.name,
        qty,
        price,
        itemId: selectedItem.id,
        adminBasePrice: selectedItem.adminCostPrice ?? selectedItem.costPrice,
        actualCost: selectedItem.actualCost,
      }, currentShop?.id);
      deductStock(selectedItem.name, qty, selectedItem.shopId);

      // Clear form
      setSelectedItemId("");
      setQty(1);
      setPrice(0);
    } catch (error) {
      console.error('Error adding item to wholesale sale:', error);
      alert("Error adding item. Please try again.");
    }
  }

  function removeItemFromRetail(index: number) {
    const itemToRemove = saleItems[index];
    if (itemToRemove.source === 'inventory' && itemToRemove.itemId != null) {
      const inventoryItem = items.find(item => item.id === itemToRemove.itemId);
      if (inventoryItem) addStock(inventoryItem.id, itemToRemove.qty);
    } else if (itemToRemove.source !== 'custom') {
      const inventoryItem = items.find(item => item.name === itemToRemove.name && item.shopId === currentShop?.id);
      if (inventoryItem) addStock(inventoryItem.id, itemToRemove.qty);
    }
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  }

  const retailTotal = saleItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );

  const wholesaleTotal = openWholesaleSale?.total || 0;
  const wholesaleItems = openWholesaleSale?.items || [];

  // Handle retail sale completion (guarded against double-submit / duplicate DB rows)
  async function completeRetailSale() {
    if (saleItems.length === 0) {
      alert("Please add at least one item");
      return;
    }
    if (retailSaleSubmitLock.current || isCompletingRetailSale) return;
    retailSaleSubmitLock.current = true;
    setIsCompletingRetailSale(true);

    try {
      const paidAmount = typeof amountPaid === 'number' && amountPaid > 0 ? amountPaid : retailTotal;
      const balance = retailTotal - paidAmount;
      const paymentStatus = balance <= 0 ? 'fully_paid' : paidAmount > 0 ? 'partial' : 'pending';

      const itemsForSale: SaleItemInput[] = saleItems.map((s) => {
        const base = { name: s.name, qty: s.qty, price: s.price };
        if (s.source === 'inventory') {
          const inv = items.find((i) => i.name === s.name && i.shopId === currentShop?.id);
          if (inv) {
            return { ...base, itemId: inv.id, adminBasePrice: inv.adminCostPrice ?? inv.costPrice, actualCost: inv.actualCost };
          }
        }
        return base;
      });

      const saleId = await addSale(itemsForSale, retailTotal, currentShop?.id, 'retail');
      if (!saleId) {
        alert("Failed to save sale. Please try again.");
        return;
      }

      const sale = {
        id: saleId,
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

      addPayment({
        type: paymentType,
        amount: paidAmount,
        state: paymentStatus === 'fully_paid' ? 'fully_paid' : 'partial',
        bank: bank as any,
        depositReference: depositReference || undefined,
        shopId: currentShop?.id,
        relatedTo: 'sale',
        relatedId: saleId,
        deposited: paymentType === 'cash' ? false : true,
      });

      setSaleItems([]);
      setAmountPaid('');
      setBank('');
      setDepositReference('');

      navigate('/receipt', { state: { sale } });
    } finally {
      retailSaleSubmitLock.current = false;
      setIsCompletingRetailSale(false);
    }
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

      <ShopSelector />
      {currentShop && (
        <p className="text-sm text-gray-600 mb-4">You can sell from stock <strong>allocated to {currentShop.name}</strong> or from <strong>main warehouse</strong> (unallocated). Select an item and enter qty/price.</p>
      )}
      {!currentShop && salesItems.length > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-4">Select a shop above to record sales under that shop; main warehouse stock is shown.</p>
      )}

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
            <div className="flex gap-4 mb-4">
              <label className="flex items-center text-sm">
                <input type="radio" value="inventory" checked={itemSource === 'inventory'} onChange={() => { setItemSource('inventory'); setCustomItemName(''); setCustomSupplier(''); }} className="mr-1" />
                From Stock
              </label>
              <label className="flex items-center text-sm">
                <input type="radio" value="custom" checked={itemSource === 'custom'} onChange={() => { setItemSource('custom'); setSelectedItemId(''); }} className="mr-1" />
                Custom / Outsourced
              </label>
            </div>

            {itemSource === 'inventory' && salesItems.length === 0 && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                <p className="font-semibold mb-1">No items available for sale</p>
                <p className="text-xs mb-2">
                  {isAdmin 
                    ? "No Phone or Accessory items with stock found in inventory."
                    : `No Phone or Accessory stock found in inventory allocated to ${currentShop?.name || 'your shop'} or in main warehouse (unallocated).`
                  }
                </p>
                <p className="text-xs">
                  {isAdmin 
                    ? "Add stock via Purchases page."
                    : "Ask admin to allocate stock to your shop via Stock Allocation page, or add stock via Purchases."
                  }
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {itemSource === 'inventory' ? (
                <select
                  className="border p-2 rounded"
                  value={selectedItemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  aria-label="Select item from stock"
                >
                  <option value="">Select Item (in stock)</option>
                  {salesItems.map((item) => {
                    const stock = Number(item.stock) ?? 0;
                    const location = item.shopId ? `Shop` : `Main`;
                    return (
                      <option key={item.id} value={String(item.id)}>
                        {item.name} — Stock: {stock} pcs ({location})
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  className="border p-2 rounded"
                  type="text"
                  placeholder="Item name"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                />
              )}

              <input
                className="border p-2 rounded"
                type="number"
                placeholder="Qty"
                min="1"
                max={selectedItem ? (Number(selectedItem.stock) ?? 0) || 9999 : 9999}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />

              <input
                className="border p-2 rounded"
                type="number"
                placeholder="Selling Price (KES)"
                value={price || ''}
                onChange={(e) => setPrice(Number(e.target.value))}
                min="0"
              />

              {itemSource === 'custom' && (
                <input
                  className="border p-2 rounded"
                  type="text"
                  placeholder="Supplier name (optional)"
                  value={customSupplier}
                  onChange={(e) => setCustomSupplier(e.target.value)}
                />
              )}
            </div>
            {selectedItem && (
              <p className="text-sm text-gray-600 mb-2">
                Available: {Number(selectedItem.stock) ?? 0} pcs
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
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 text-center">{item.qty}</td>
                      <td className="p-3 text-right">KES {item.price.toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">KES {(item.qty * item.price).toLocaleString()}</td>
                      <td className="p-3">
                        {item.source === 'custom' ? (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                            Outsourced{item.supplier ? ` - ${item.supplier}` : ''}
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">In Stock</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid (KES)</label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-2 w-full"
                      placeholder={`Total: KES ${retailTotal.toLocaleString()}`}
                      min={0}
                    />
                    {typeof amountPaid === 'number' && amountPaid > 0 && amountPaid < retailTotal && (
                      <p className="text-sm text-red-600 mt-1">
                        Balance: KES {(retailTotal - amountPaid).toLocaleString()}
                      </p>
                    )}
                    {(amountPaid === '' || amountPaid === 0) && (
                      <p className="text-xs text-gray-500 mt-1">Leave empty to record as fully paid (KES {retailTotal.toLocaleString()})</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void completeRetailSale()}
                    disabled={isCompletingRetailSale}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isCompletingRetailSale ? "Saving…" : "Complete Sale & Generate Receipt"}
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
                value={selectedItemId}
                onChange={(e) => handleItemSelect(e.target.value)}
                aria-label="Select item for wholesale"
              >
                <option value="">Select Item</option>
                {salesItems.map((item) => {
                  const stock = Number(item.stock) ?? 0;
                  const location = item.shopId ? "Shop" : "Main";
                  return (
                    <option key={item.id} value={String(item.id)}>
                      {item.name} — Stock: {stock} ({location})
                    </option>
                  );
                })}
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
