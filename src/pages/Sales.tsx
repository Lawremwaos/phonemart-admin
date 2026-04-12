import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { supabase } from "../lib/supabaseClient";
import { useSales, type SaleItemInput } from "../context/SalesContext";
import { useShop } from "../context/ShopContext";
import { usePayment } from "../context/PaymentContext";
import { useSupplier } from "../context/SupplierContext";
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
  const { deductStockById, addStock, items, refreshStockMovements } = useInventory();
  const { addSale, openWholesaleSale, addItemToWholesaleSale, closeWholesaleSale } = useSales();
  const { currentShop, currentUser } = useShop();
  const { addPayment } = usePayment();
  const { suppliers } = useSupplier();

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

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  const [wholesaleCustomerName, setWholesaleCustomerName] = useState('');
  const [wholesaleCustomerPhone, setWholesaleCustomerPhone] = useState('');
  const [wholesaleSaleNotes, setWholesaleSaleNotes] = useState('');

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

  const qtyInCartForItemId = (itemId: number) =>
    saleItems
      .filter((s) => s.source === 'inventory' && s.itemId === itemId)
      .reduce((sum, s) => sum + s.qty, 0);

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
      const alreadyInCart = qtyInCartForItemId(selectedItem.id);
      if (selectedItem.stock < alreadyInCart + qty) {
        alert(`Not enough stock! Available: ${selectedItem.stock} (${alreadyInCart} already in this sale)`);
        return;
      }
      setSaleItems((prev) => [
        ...prev,
        { name: selectedItem.name, qty, price, source: 'inventory', itemId: selectedItem.id },
      ]);
    } else {
      if (!customItemName.trim() || qty <= 0) {
        alert("Please enter item name and valid quantity.");
        return;
      }
      if (!customSupplier.trim()) {
        alert("Please select supplier from the system for custom sale items.");
        return;
      }
      setSaleItems((prev) => [
        ...prev,
        { name: customItemName.trim(), qty, price, source: 'custom', supplier: customSupplier.trim() },
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

    const alreadyInOpenWholesale = (openWholesaleSale?.items || [])
      .filter((line) => line.itemId === selectedItem.id)
      .reduce((sum, line) => sum + line.qty, 0);
    if (selectedItem.stock < alreadyInOpenWholesale + qty) {
      alert(
        `Not enough stock! Available: ${selectedItem.stock} (${alreadyInOpenWholesale} already in this wholesale ticket)`
      );
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
    // Stock is only deducted when the sale is completed — removing a line just updates the cart.
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
        if (s.source === 'inventory' && s.itemId != null) {
          const inv = items.find((i) => i.id === s.itemId);
          if (inv) {
            return { ...base, itemId: inv.id, adminBasePrice: inv.adminCostPrice ?? inv.costPrice, actualCost: inv.actualCost };
          }
        }
        return base;
      });

      const qtyByInventoryId = new Map<number, number>();
      for (const s of saleItems) {
        if (s.source === 'inventory' && s.itemId != null) {
          qtyByInventoryId.set(s.itemId, (qtyByInventoryId.get(s.itemId) ?? 0) + s.qty);
        }
      }
      for (const [itemId, need] of qtyByInventoryId) {
        const inv = items.find((i) => i.id === itemId);
        if (!inv || inv.stock < need) {
          alert(
            inv
              ? `Not enough stock for ${inv.name}. Need ${need}, available ${inv.stock}. Adjust the sale and try again.`
              : "An inventory line is invalid. Refresh the page and try again."
          );
          return;
        }
      }

      const saleCheckoutRef =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `sale:${crypto.randomUUID()}`
          : `sale:${Date.now()}`;
      for (const [itemId, need] of qtyByInventoryId) {
        await deductStockById(itemId, need, { saleReferenceId: saleCheckoutRef });
      }

      const saleId = await addSale(itemsForSale, retailTotal, currentShop?.id, 'retail', undefined, {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        saleNotes: saleNotes.trim() || undefined,
      });
      if (!saleId) {
        for (const [itemId, need] of qtyByInventoryId) {
          addStock(itemId, need);
        }
        alert("Failed to save sale. Inventory was restored. Please try again.");
        return;
      }

      const { error: linkMovementsErr } = await supabase
        .from("inventory_stock_movements")
        .update({ reference_id: saleId })
        .eq("reference_id", saleCheckoutRef);
      if (linkMovementsErr) {
        console.warn("Could not link stock movements to sale id:", linkMovementsErr.message);
      } else {
        await refreshStockMovements();
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
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        saleNotes: saleNotes.trim() || undefined,
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
      setCustomerName('');
      setCustomerPhone('');
      setSaleNotes('');

      navigate('/receipt', { state: { sale } });
    } finally {
      retailSaleSubmitLock.current = false;
      setIsCompletingRetailSale(false);
    }
  }

  // Handle wholesale sale closure
  async function handleCloseWholesaleSale() {
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

    const qtyByInventoryId = new Map<number, number>();
    for (const item of wholesaleItems) {
      if (item.itemId != null) {
        qtyByInventoryId.set(item.itemId, (qtyByInventoryId.get(item.itemId) ?? 0) + item.qty);
      }
    }

    for (const [itemId, need] of qtyByInventoryId) {
      const inv = items.find((i) => i.id === itemId);
      if (!inv || inv.stock < need) {
        alert(
          inv
            ? `Not enough stock for ${inv.name}. Need ${need}, available ${inv.stock}.`
            : "An inventory line is invalid. Refresh and try again."
        );
        return;
      }
    }

    // Close the wholesale sale (persists customer details if columns exist in DB)
    const closed = await closeWholesaleSale(wholesalePaymentType, wholesaleDepositReference, wholesaleBank, {
      customerName: wholesaleCustomerName.trim() || undefined,
      customerPhone: wholesaleCustomerPhone.trim() || undefined,
      saleNotes: wholesaleSaleNotes.trim() || undefined,
    });
    if (!closed) {
      alert("Failed to close wholesale sale. Please try again.");
      return;
    }

    const wholesaleSaleId = openWholesaleSale.id;
    for (const [itemId, need] of qtyByInventoryId) {
      await deductStockById(itemId, need, { saleReferenceId: wholesaleSaleId });
    }
    await refreshStockMovements();

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
    setWholesaleCustomerName('');
    setWholesaleCustomerPhone('');
    setWholesaleSaleNotes('');
  }

  return (
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Sales</p>
          <h2 className="pm-page-title">Accessories Sales</h2>
          <p className="pm-page-desc">Record retail and wholesale accessories sales in one flow.</p>
        </div>
        <a
          href="/repair-sales"
          className="pm-btn pm-btn-secondary"
        >
          Go to Repair Sales →
        </a>
      </div>

      <ShopSelector />
      {currentShop && (
        <p className="text-sm text-[var(--pm-ink-soft)]">You can sell from stock <strong>allocated to {currentShop.name}</strong> or from <strong>main warehouse</strong> (unallocated). Select an item and enter qty/price.</p>
      )}
      {!currentShop && salesItems.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">Select a shop above to record sales under that shop; main warehouse stock is shown.</p>
      )}

      {/* Sale Type Selection */}
      <div className="pm-card pm-pad mb-6">
        <label className="pm-label">Sale Type</label>
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
          <div className="pm-card pm-pad mb-6">
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
                  className="pm-select"
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
                  className="pm-input"
                  type="text"
                  placeholder="Item name"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                />
              )}

              <input
                className="pm-input"
                type="number"
                placeholder="Qty"
                min="1"
                max={selectedItem ? (Number(selectedItem.stock) ?? 0) || 9999 : 9999}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />

              <input
                className="pm-input"
                type="number"
                placeholder="Selling Price (KES)"
                value={price || ''}
                onChange={(e) => setPrice(Number(e.target.value))}
                min="0"
              />

              {itemSource === 'custom' && (
                <select
                  className="pm-select"
                  value={customSupplier}
                  onChange={(e) => setCustomSupplier(e.target.value)}
                  aria-label="Select supplier for custom item"
                >
                  <option value="">Select supplier (required)</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.name}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedItem && (
              <p className="mb-2 text-sm text-[var(--pm-ink-soft)]">
                Available: {Number(selectedItem.stock) ?? 0} pcs
              </p>
            )}

            <button
              onClick={addItemToRetailSale}
              className="pm-btn pm-btn-primary"
            >
              Add Item
            </button>
          </div>

          {saleItems.length > 0 && (
            <div className="pm-card pm-pad mb-6">
              <h3 className="border-b border-[var(--pm-border)] p-4 text-lg font-semibold">Current Sale Items</h3>
              <div className="pm-table-shell rounded-none border-x-0 border-b-0 border-t-0 shadow-none">
                <table className="w-full">
                  <thead>
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
                    <tr key={index} className="border-t border-[var(--pm-border)]">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 text-center">{item.qty}</td>
                      <td className="p-3 text-right">KES {item.price.toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">KES {(item.qty * item.price).toLocaleString()}</td>
                      <td className="p-3">
                        {item.source === 'custom' ? (
                          <span className="rounded px-2 py-0.5 text-xs bg-orange-100 text-orange-800">
                            Outsourced{item.supplier ? ` - ${item.supplier}` : ''}
                          </span>
                        ) : (
                          <span className="rounded px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800">In Stock</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => removeItemFromRetail(index)}
                          className="pm-btn pm-btn-danger pm-btn-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[var(--pm-border)] p-4 text-right font-bold">
                TOTAL: KES {retailTotal.toLocaleString()}
              </div>

              <div className="border-t border-[var(--pm-border)] p-4">
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-4">
                    <h4 className="mb-2 font-semibold text-[var(--pm-ink)]">Customer &amp; sale detail</h4>
                    <p className="mb-3 text-xs text-[var(--pm-ink-soft)]">
                      Optional but recommended: record who bought and what was sold. Line items above list products; use notes for extra detail.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--pm-ink-soft)]">Customer name</label>
                        <input
                          type="text"
                          className="pm-input text-sm"
                          placeholder="Walk-in customer name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[var(--pm-ink-soft)]">Customer phone</label>
                        <input
                          type="tel"
                          className="pm-input text-sm"
                          placeholder="+254…"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-[var(--pm-ink-soft)]">Notes (accessories / items sold)</label>
                      <textarea
                        className="pm-input text-sm"
                        rows={2}
                        placeholder="e.g. 2x screen protector, USB cable — or any extra detail"
                        value={saleNotes}
                        onChange={(e) => setSaleNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="pm-label">Payment Method</label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value as 'cash' | 'mpesa' | 'bank_deposit')}
                      className="pm-select"
                    >
                      <option value="mpesa">MPESA</option>
                      <option value="cash">Cash</option>
                      <option value="bank_deposit">Bank Deposit</option>
                    </select>
                  </div>

                  {paymentType === 'bank_deposit' && (
                    <>
                      <div>
                        <label className="pm-label">Bank</label>
                        <select
                          value={bank}
                          onChange={(e) => setBank(e.target.value)}
                          className="pm-input"
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
                        <label className="pm-label">Deposit Reference</label>
                        <input
                          type="text"
                          value={depositReference}
                          onChange={(e) => setDepositReference(e.target.value)}
                          className="pm-input"
                          placeholder="Enter deposit reference"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="pm-label">Amount Paid (KES)</label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                      className="pm-input"
                      placeholder={`Total: KES ${retailTotal.toLocaleString()}`}
                      min={0}
                    />
                    {typeof amountPaid === 'number' && amountPaid > 0 && amountPaid < retailTotal && (
                      <p className="mt-1 text-sm text-red-700">
                        Balance: KES {(retailTotal - amountPaid).toLocaleString()}
                      </p>
                    )}
                    {(amountPaid === '' || amountPaid === 0) && (
                      <p className="mt-1 text-xs text-[var(--pm-ink-soft)]">Leave empty to record as fully paid (KES {retailTotal.toLocaleString()})</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void completeRetailSale()}
                    disabled={isCompletingRetailSale}
                    className="pm-btn pm-btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
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
          <div className="pm-card pm-pad mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Items to Wholesale Sale</h3>
            <p className="mb-4 text-sm text-[var(--pm-ink-soft)]">
              Add multiple items throughout the day. The sale will remain open until you close it at the end of the day.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <select
                className="pm-select"
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
                className="pm-input"
                type="number"
                placeholder="Qty"
                min="1"
                max={selectedItem?.stock || 0}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />

              <input
                className="pm-input"
                type="number"
                placeholder="Unit Price"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            {selectedItem && (
              <p className="mb-2 text-sm text-[var(--pm-ink-soft)]">
                Available stock: {selectedItem.stock} | Default price: KES {selectedItem.price}
              </p>
            )}

            <button
              onClick={addItemToWholesale}
              className="pm-btn pm-btn-primary"
            >
              Add Item to Wholesale Sale
            </button>
          </div>

          {/* Open Wholesale Sale Display */}
          {openWholesaleSale && wholesaleItems.length > 0 && (
            <div className="pm-card pm-pad mb-6">
              <div className="border-b border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Open Wholesale Sale</h3>
                    <p className="text-sm text-[var(--pm-ink-soft)]">Started: {new Date(openWholesaleSale.date).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                    OPEN
                  </span>
                </div>
              </div>

              <div className="pm-table-shell rounded-none border-x-0 border-b-0 border-t-0 shadow-none">
                <table className="w-full">
                  <thead>
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Amount Sold</th>
                    <th className="p-3">Total</th>
                  </tr>
                  </thead>
                  <tbody>
                  {wholesaleItems.map((item, index) => (
                    <tr key={index} className="border-t border-[var(--pm-border)]">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.qty}</td>
                      <td className="p-3">KES {item.price.toLocaleString()}</td>
                      <td className="p-3">KES {(item.qty * item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-[var(--pm-ink-soft)]">Total Quantity</p>
                    <p className="text-xl font-bold">{wholesaleItems.reduce((sum, item) => sum + item.qty, 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--pm-ink-soft)]">Total Amount</p>
                    <p className="text-2xl font-bold">KES {wholesaleTotal.toLocaleString()}</p>
                  </div>
                </div>

                <div className="border-t border-[var(--pm-border)] pt-4">
                  <h4 className="font-semibold mb-4">Close Sale & Enter Payment Details</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="pm-label">Payment Method</label>
                      <select
                        value={wholesalePaymentType}
                        onChange={(e) => setWholesalePaymentType(e.target.value as 'cash' | 'mpesa' | 'bank_deposit')}
                        className="pm-input"
                      >
                        <option value="mpesa">MPESA</option>
                        <option value="cash">Cash</option>
                        <option value="bank_deposit">Bank Deposit</option>
                      </select>
                    </div>

                    {wholesalePaymentType === 'bank_deposit' && (
                      <div>
                        <label className="pm-label">Bank</label>
                        <select
                          value={wholesaleBank}
                          onChange={(e) => setWholesaleBank(e.target.value)}
                          className="pm-input"
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
                      <label className="pm-label">
                        Transaction Code / Reference <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={wholesaleDepositReference}
                        onChange={(e) => setWholesaleDepositReference(e.target.value.toUpperCase())}
                        className="pm-input uppercase"
                        placeholder="Enter transaction code"
                      />
                    </div>

                    <div className="rounded-lg border border-[var(--pm-border)] bg-[var(--pm-surface)] p-4">
                      <h5 className="mb-2 font-semibold text-[var(--pm-ink)]">Customer &amp; sale detail</h5>
                      <p className="mb-3 text-xs text-[var(--pm-ink-soft)]">Optional: partner / customer for this wholesale ticket.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--pm-ink-soft)]">Customer / partner name</label>
                          <input
                            type="text"
                            className="pm-input text-sm"
                            value={wholesaleCustomerName}
                            onChange={(e) => setWholesaleCustomerName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--pm-ink-soft)]">Phone</label>
                          <input
                            type="tel"
                            className="pm-input text-sm"
                            value={wholesaleCustomerPhone}
                            onChange={(e) => setWholesaleCustomerPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-[var(--pm-ink-soft)]">Notes (items sold)</label>
                        <textarea
                          className="pm-input text-sm"
                          rows={2}
                          value={wholesaleSaleNotes}
                          onChange={(e) => setWholesaleSaleNotes(e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCloseWholesaleSale}
                      className="pm-btn pm-btn-primary w-full"
                    >
                      Close Sale & Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!openWholesaleSale && (
            <div className="pm-card pm-pad-lg text-center">
              <p className="text-[var(--pm-ink-soft)]">No open wholesale sale. Start adding items to create one.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
