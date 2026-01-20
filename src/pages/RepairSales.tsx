import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { useRepair } from "../context/RepairContext";
import type { RepairStatus } from "../context/RepairContext";
// import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";
import { useSupplier } from "../context/SupplierContext";
import { useSupplierDebt } from "../context/SupplierDebtContext";

type PartSource = 'in-house' | 'outsourced';

type AdditionalLaborItem = {
  id: string;
  itemName: string;
  source: 'inventory' | 'outsourced';
  itemId?: number; // For inventory items
};

type RepairPart = {
  itemId: number;
  itemName: string;
  qty: number;
  cost: number;
  source: PartSource;
  supplierId?: string;
  supplierName?: string;
  additionalLaborCost?: number;
};

type PaymentMethod = 'cash_to_deposit' | 'mpesa_to_paybill' | 'mpesa_to_mpesa_shop' | 'bank_to_mpesa_shop' | 'bank_to_shop_bank' | 'sacco_to_mpesa';

// Split payment not currently used

export default function RepairSales() {
  const navigate = useNavigate();
  const { items, addStock } = useInventory();
  const { addRepair } = useRepair();
  // Payments are recorded after admin approval on the Pending Payment Approval page
  const { currentShop, currentUser } = useShop();
  const { suppliers, addSupplier } = useSupplier();
  const { addDebt } = useSupplierDebt();

  const [customerStatus, setCustomerStatus] = useState<'waiting' | 'coming_back'>('waiting');
  const [additionalLaborItems, setAdditionalLaborItems] = useState<AdditionalLaborItem[]>([]);
  const [additionalLaborItemName, setAdditionalLaborItemName] = useState("");
  const [additionalLaborItemSource, setAdditionalLaborItemSource] = useState<'inventory' | 'outsourced'>('inventory');
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    phoneModel: "",
    phoneBrand: "",
    imei: "",
    issue: "",
    totalAgreedAmount: "",
    paymentTiming: 'after' as 'before' | 'after',
    depositAmount: "",
  });

  const [selectedParts, setSelectedParts] = useState<RepairPart[]>([]);
  const [partName, setPartName] = useState("");
  const [partSource, setPartSource] = useState<PartSource>('in-house');
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [pendingSupplierName, setPendingSupplierName] = useState<string | null>(null);

  // Auto-select newly added supplier
  useEffect(() => {
    if (pendingSupplierName) {
      const newSupplier = suppliers.find(s => s.name === pendingSupplierName);
      if (newSupplier) {
        setSelectedSupplierId(newSupplier.id);
        setPendingSupplierName(null);
      }
    }
  }, [suppliers, pendingSupplierName]);

  // Payment state
  const [paymentMade, setPaymentMade] = useState<'yes' | 'no'>('yes'); // New: Payment made or not
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa_to_paybill');
  const [transactionCodes, setTransactionCodes] = useState({
    cash_to_deposit: "",
    mpesa_to_paybill: "",
    mpesa_to_mpesa_shop: "",
    bank_to_mpesa_shop: "",
    bank_to_shop_bank: "",
    sacco_to_mpesa: "",
    bank: "",
    customBank: "", // For custom bank name input
  });
  // Split payment UI is not currently used in this flow
  // const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  // const [splitPaymentMethod, setSplitPaymentMethod] = useState<'cash' | 'mpesa' | 'bank_deposit'>('cash');
  // const [splitPaymentAmount, setSplitPaymentAmount] = useState("");
  // const [splitPaymentCode, setSplitPaymentCode] = useState("");
  // const [splitPaymentBank, setSplitPaymentBank] = useState("");
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<number | null>(null);
  const [outsourcedItemSupplier, setOutsourcedItemSupplier] = useState("");

  // Auto-set technician from logged-in user
  const technician = currentUser?.name || "";

  function addNewSupplier() {
    if (!newSupplierName.trim()) {
      alert("Please enter supplier name");
      return;
    }
    const supplierName = newSupplierName.trim();
    addSupplier({ name: supplierName, categories: ['spare_parts'] });
    setPendingSupplierName(supplierName);
    setNewSupplierName("");
    setShowAddSupplier(false);
  }

  function addPart() {
    if (!partName.trim()) {
      alert("Please enter part name");
      return;
    }

    if (partSource === 'outsourced') {
      if (!selectedSupplierId) {
        alert("Please select a supplier for outsourced part");
        return;
      }
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    const cost = 0; // Cost not shown for parts

    setSelectedParts(prev => [
      ...prev,
      {
        itemId: Date.now(), // Use timestamp as ID for custom parts
        itemName: partName.trim(),
        qty: 1,
        cost,
        source: partSource,
        supplierId: partSource === 'outsourced' ? selectedSupplierId : undefined,
        supplierName: partSource === 'outsourced' ? supplier?.name : undefined,
        additionalLaborCost: 0,
      },
    ]);

    // Reset form
    setPartName("");
    setPartSource('in-house');
    setSelectedSupplierId("");
  }

  function removePart(index: number) {
    const part = selectedParts[index];
    // Restore stock if in-house
    if (part.source === 'in-house') {
      const item = items.find(i => i.id === part.itemId);
      if (item) {
        addStock(item.id, part.qty);
      }
    }
    setSelectedParts(prev => prev.filter((_, i) => i !== index));
  }

  function addAdditionalLaborItem() {
    if (additionalLaborItemSource === 'inventory') {
      if (!selectedInventoryItem) {
        alert("Please select an inventory item");
        return;
      }
      const item = items.find(i => i.id === selectedInventoryItem);
      if (!item) {
        alert("Selected inventory item not found");
        return;
      }
      if (item.stock <= 0) {
        alert("Selected item is out of stock");
        return;
      }
      // Reduce stock
      addStock(item.id, -1);
      // Use item name from inventory
      setAdditionalLaborItems(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          itemName: item.name,
          source: additionalLaborItemSource,
          itemId: selectedInventoryItem,
        },
      ]);
      setSelectedInventoryItem(null);
    } else {
      // Outsourced item - require supplier name
      if (!outsourcedItemSupplier.trim()) {
        alert("Please enter supplier name");
        return;
      }
      setAdditionalLaborItems(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          itemName: outsourcedItemSupplier.trim(), // Store supplier name as itemName for outsourced
          source: additionalLaborItemSource,
          itemId: undefined,
        },
      ]);
      setOutsourcedItemSupplier("");
    }
  }

  function removeAdditionalLaborItem(id: string) {
    const item = additionalLaborItems.find(i => i.id === id);
    if (item && item.source === 'inventory' && item.itemId) {
      // Restore stock
      addStock(item.itemId, 1);
    }
    setAdditionalLaborItems(prev => prev.filter(item => item.id !== id));
  }

  /*
  function addSplitPayment() {
    if (!splitPaymentAmount || Number(splitPaymentAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!splitPaymentCode) {
      alert("Please enter transaction code");
      return;
    }
    if (splitPaymentMethod === 'bank_deposit' && !splitPaymentBank) {
      alert("Please select a bank");
      return;
    }

    setSplitPayments(prev => [
      ...prev,
      {
        method: splitPaymentMethod,
        amount: Number(splitPaymentAmount),
        transactionCode: splitPaymentCode.toUpperCase(),
        bank: splitPaymentMethod === 'bank_deposit' ? splitPaymentBank : undefined,
      },
    ]);

    setSplitPaymentAmount("");
    setSplitPaymentCode("");
    setSplitPaymentBank("");
  }

  function removeSplitPayment(index: number) {
    setSplitPayments(prev => prev.filter((_, i) => i !== index));
  }
  */

  function calculateTotal() {
    // Note: This is just for reference display. The actual total is the agreed amount.
    const partsTotal = selectedParts.reduce((sum, part) => sum + (part.cost * part.qty), 0);
    const outsourcedPartsCost = selectedParts
      .filter(p => p.source === 'outsourced')
      .reduce((sum, part) => sum + (part.cost * part.qty), 0);
    
    return {
      partsTotal,
      outsourcedPartsCost,
      total: partsTotal + outsourcedPartsCost,
      totalOutsourced: outsourcedPartsCost,
    };
  }

  const totals = calculateTotal();

  function getTotalPaid() {
    // Use agreed amount as the total
    const finalTotal = form.totalAgreedAmount ? Number(form.totalAgreedAmount) : 0;
    return finalTotal;
  }

  function validateTransactionCodes() {
    // If payment is not made, skip validation
    if (paymentMade === 'no') {
      return true;
    }
    
    if (paymentMethod === 'cash_to_deposit') {
      if (!transactionCodes.cash_to_deposit) {
        alert("Transaction code is required! Staff must deposit cash and provide the code.");
        return false;
      }
    } else if (paymentMethod === 'mpesa_to_paybill') {
      if (!transactionCodes.mpesa_to_paybill) {
        alert("MPESA transaction code is required!");
        return false;
      }
    } else if (paymentMethod === 'mpesa_to_mpesa_shop') {
      if (!transactionCodes.mpesa_to_mpesa_shop) {
        alert("MPESA transaction code is required!");
        return false;
      }
    } else if (paymentMethod === 'bank_to_mpesa_shop') {
      if (!transactionCodes.bank_to_mpesa_shop) {
        alert("Transaction code is required!");
        return false;
      }
      if (!transactionCodes.bank) {
        alert("Please select the bank");
        return false;
      }
    } else if (paymentMethod === 'bank_to_shop_bank') {
      if (!transactionCodes.bank_to_shop_bank) {
        alert("Transaction code is required!");
        return false;
      }
      if (!transactionCodes.bank) {
        alert("Please select the bank");
        return false;
      }
    } else if (paymentMethod === 'sacco_to_mpesa') {
      if (!transactionCodes.sacco_to_mpesa) {
        alert("Transaction code is required!");
        return false;
      }
      if (!transactionCodes.bank) {
        alert("Please select the Sacco");
        return false;
      }
    }
    return true;
  }

  function handleCompleteRepairSale() {
    if (!form.customerName || !form.customerPhone || !form.phoneModel || !form.issue || !form.totalAgreedAmount) {
      alert("Please fill in all required fields (Customer Name, Phone, Model, Issue, Total Agreed Amount)");
      return;
    }

    // Parts are now optional - service-only repairs are allowed
    // if (selectedParts.length === 0) {
    //   alert("Please add at least one part");
    //   return;
    // }

    if (!validateTransactionCodes()) {
      return;
    }

    // Use agreed amount as the final total
    const finalTotal = Number(form.totalAgreedAmount);
    const depositAmount = Number(form.depositAmount || 0);
    
    // If deposit exists, use deposit as paid amount, otherwise use payment method amount
    const paidAmount = depositAmount > 0 ? depositAmount : (paymentMade === 'yes' ? getTotalPaid() : 0);
    const balance = finalTotal - paidAmount;
    const paymentStatus = depositAmount > 0 
      ? (balance <= 0 ? 'fully_paid' : 'partial')
      : (paymentMade === 'no' ? 'pending' : (balance <= 0 ? 'fully_paid' : paidAmount > 0 ? 'partial' : 'pending'));

    // Determine status based on payment and approval
    let repairStatus: RepairStatus;
    if (paymentMade === 'no') {
      repairStatus = 'PAYMENT_PENDING';
    } else if (paymentMade === 'yes' && paidAmount >= finalTotal) {
      // Payment made but needs admin approval
      repairStatus = 'PAYMENT_PENDING'; // Will be changed to FULLY_PAID after approval
    } else {
      repairStatus = 'PAYMENT_PENDING';
    }

    // Create repair record
    const repair = {
      customerName: form.customerName,
      phoneNumber: form.customerPhone,
      imei: form.imei,
      phoneModel: `${form.phoneBrand} ${form.phoneModel}`.trim(),
      issue: form.issue,
      technician: technician,
      partsUsed: selectedParts.map(p => ({
        itemId: p.itemId,
        itemName: p.itemName,
        qty: p.qty,
        cost: p.cost,
      })),
      additionalItems: additionalLaborItems.map(item => ({
        itemName: item.itemName,
        source: item.source,
        itemId: item.itemId,
      })),
      outsourcedCost: totals.totalOutsourced,
      laborCost: 0, // No longer tracking labor cost separately
      status: repairStatus,
      shopId: currentShop?.id,
      paymentStatus: paymentStatus as 'pending' | 'partial' | 'fully_paid',
      customerStatus: customerStatus,
      totalAgreedAmount: Number(form.totalAgreedAmount),
      paymentTiming: form.paymentTiming,
      depositAmount: Number(form.depositAmount || 0),
      paymentMade: paymentMade === 'yes',
      paymentApproved: false, // Admin must approve
      amountPaid: paidAmount,
      balance: balance,
      pendingTransactionCodes: {
        paymentMethod,
        transactionCodes: { ...transactionCodes },
      },
    };

    const repairId = Date.now().toString();
    addRepair(repair);

    // Track supplier debts for outsourced parts
    selectedParts
      .filter(p => p.source === 'outsourced' && p.supplierId)
      .forEach(part => {
        addDebt({
          supplierId: part.supplierId!,
          supplierName: part.supplierName || 'Unknown',
          itemName: part.itemName,
          quantity: part.qty,
          costPerUnit: part.cost,
          repairId: repairId,
        });
      });

    // Add payment records only if payment was made (but not yet approved)
    // Payment will be recorded after admin approval

    // Create receipt data - simplified to show only phone, parts, and total
    const receiptData = {
      id: Date.now().toString(),
      date: new Date(),
      shopId: currentShop?.id,
      saleType: 'repair' as const,
      items: [
        ...selectedParts.map(p => ({
          name: p.itemName,
          qty: p.qty,
          price: 0, // Cost not shown on receipt
        })),
        ...additionalLaborItems.map(item => ({
          name: item.itemName,
          qty: 1,
          price: 0, // Cost not shown on receipt
        })),
      ],
      total: finalTotal,
      totalAgreedAmount: finalTotal,
      paymentMethod,
      paymentStatus: depositAmount > 0 ? 'partial' : (paymentMade === 'yes' ? 'paid' : 'not_paid'),
      amountPaid: paidAmount,
      balance,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      phoneModel: `${form.phoneBrand} ${form.phoneModel}`.trim(),
      issue: form.issue,
      technician: technician,
      customerStatus,
      paymentApproved: false,
      depositAmount: depositAmount,
    };

    // Reset form
    setForm({
      customerName: "",
      customerPhone: "",
      phoneModel: "",
      phoneBrand: "",
      imei: "",
      issue: "",
      totalAgreedAmount: "",
      paymentTiming: 'after',
      depositAmount: "",
    });
    setSelectedParts([]);
    setAdditionalLaborItems([]);
    setCustomerStatus('waiting');
    setPaymentMethod('mpesa_to_paybill');
    setTransactionCodes({
      cash_to_deposit: "",
      mpesa_to_paybill: "",
      mpesa_to_mpesa_shop: "",
      bank_to_mpesa_shop: "",
      bank_to_shop_bank: "",
      sacco_to_mpesa: "",
      bank: "",
      customBank: "",
    });
    setSelectedInventoryItem(null);
    setAdditionalLaborItemSource('inventory');

    // Navigate to receipt
    navigate('/receipt', { state: { sale: receiptData } });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Repair Sales</h2>

      {/* Customer Status */}
      <div className="bg-white p-4 rounded shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">Customer Status</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="waiting"
              checked={customerStatus === 'waiting'}
              onChange={(e) => setCustomerStatus(e.target.value as 'waiting' | 'coming_back')}
              className="mr-2"
            />
            Customer is waiting at the shop
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="coming_back"
              checked={customerStatus === 'coming_back'}
              onChange={(e) => setCustomerStatus(e.target.value as 'waiting' | 'coming_back')}
              className="mr-2"
            />
            Will come back for the phone after completion
          </label>
        </div>
      </div>

      {/* Customer & Phone Details */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Customer & Phone Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="Enter customer name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="+254712345678"
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Brand</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="e.g., Samsung, iPhone, etc."
              value={form.phoneBrand}
              onChange={(e) => setForm({ ...form, phoneBrand: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Model <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="e.g., Galaxy S21, iPhone 14"
              value={form.phoneModel}
              onChange={(e) => setForm({ ...form, phoneModel: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">IMEI Number</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="IMEI (optional)"
              value={form.imei}
              onChange={(e) => setForm({ ...form, imei: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issue / Problem <span className="text-red-500">*</span>
            </label>
            <textarea
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="Describe the issue..."
              rows={3}
              value={form.issue}
              onChange={(e) => setForm({ ...form, issue: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Agreed Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="Enter total amount customer agreed to pay"
              value={form.totalAgreedAmount}
              onChange={(e) => setForm({ ...form, totalAgreedAmount: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Timing <span className="text-red-500">*</span>
            </label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              value={form.paymentTiming}
              onChange={(e) => setForm({ ...form, paymentTiming: e.target.value as 'before' | 'after' })}
            >
              <option value="before">Before Repair (Payment First)</option>
              <option value="after">After Repair (Payment on Collection)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deposit Amount (KES)
            </label>
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="If part needs to be sourced from another location"
              value={form.depositAmount}
              onChange={(e) => {
                const deposit = e.target.value;
                setForm({ ...form, depositAmount: deposit });
                // Auto-set payment made to yes if deposit is entered
                if (deposit && Number(deposit) > 0) {
                  setPaymentMade('yes');
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty if no deposit required</p>
            {form.depositAmount && Number(form.depositAmount) > 0 && form.totalAgreedAmount && (
              <p className="text-xs text-blue-600 mt-1">
                Remaining Balance: KES {(Number(form.totalAgreedAmount) - Number(form.depositAmount)).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Parts Selection */}
      <div className="bg-white p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Parts Used</h3>
          <p className="text-sm text-gray-600">You can add multiple parts (e.g., screen + battery)</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2"
            placeholder="Type the part name"
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
          />

          <select
            className="border border-gray-300 rounded-md px-3 py-2"
            value={partSource}
            onChange={(e) => {
              setPartSource(e.target.value as PartSource);
              if (e.target.value === 'in-house') {
                setSelectedSupplierId("");
              }
            }}
          >
            <option value="in-house">In-House</option>
            <option value="outsourced">Outsourced</option>
          </select>

          {partSource === 'outsourced' && (
            <div className="relative">
              <select
                className="border border-gray-300 rounded-md px-3 py-2 w-full"
                value={selectedSupplierId}
                onChange={(e) => {
                  if (e.target.value === 'add_new') {
                    setShowAddSupplier(true);
                  } else {
                    setSelectedSupplierId(e.target.value);
                  }
                }}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
                <option value="add_new">+ Add New Supplier</option>
              </select>
              {showAddSupplier && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md p-3 shadow-lg z-10">
                  <input
                    type="text"
                    className="border border-gray-300 rounded-md px-3 py-2 w-full mb-2"
                    placeholder="Supplier name"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addNewSupplier}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddSupplier(false);
                        setNewSupplierName("");
                      }}
                      className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {partSource === 'in-house' && (
            <div></div>
          )}

          <button
            onClick={addPart}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 col-span-4 md:col-span-1"
          >
            Add Part
          </button>
        </div>

        {selectedParts.length > 0 && (
          <div className="mt-4">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left text-sm">Part</th>
                  <th className="p-2 text-left text-sm">Source</th>
                  <th className="p-2 text-left text-sm">Supplier</th>
                  <th className="p-2 text-center text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedParts.map((part, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2 text-sm">{part.itemName}</td>
                    <td className="p-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        part.source === 'in-house' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {part.source === 'in-house' ? 'In-House' : 'Outsourced'}
                      </span>
                    </td>
                    <td className="p-2 text-sm">{part.supplierName || '-'}</td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => removePart(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        {/* Costs & Payment */}
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Costs & Payment</h3>
        
        {/* Additional Items & Services */}
        <div>
          <h4 className="font-semibold mb-3">Additional Items & Services</h4>
          <p className="text-sm text-gray-600 mb-3">Add items like screen protector, charger, case, etc.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2"
              placeholder="Item name (e.g., Screen Protector)"
              value={additionalLaborItemName}
              onChange={(e) => setAdditionalLaborItemName(e.target.value)}
            />
            <select
              className="border border-gray-300 rounded-md px-3 py-2"
              value={additionalLaborItemSource}
              onChange={(e) => setAdditionalLaborItemSource(e.target.value as 'inventory' | 'outsourced')}
            >
              <option value="inventory">From Inventory</option>
              <option value="outsourced">Outsourced</option>
            </select>
            {additionalLaborItemSource === 'inventory' ? (
              <select
                className="border border-gray-300 rounded-md px-3 py-2"
                value={selectedInventoryItem || ""}
                onChange={(e) => setSelectedInventoryItem(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select Inventory Item</option>
                {items && items.filter(i => i.stock > 0).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Stock: {item.stock})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2"
                placeholder="Supplier name"
                value={outsourcedItemSupplier}
                onChange={(e) => setOutsourcedItemSupplier(e.target.value)}
              />
            )}
            <button
              onClick={addAdditionalLaborItem}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Item
            </button>
          </div>

          {additionalLaborItems.length > 0 && (
            <div className="mt-4">
              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left text-sm">Item</th>
                    <th className="p-2 text-left text-sm">Source</th>
                    <th className="p-2 text-center text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {additionalLaborItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2 text-sm">
                          {item.source === 'inventory' ? item.itemName : `Supplier: ${item.itemName}`}
                        </td>
                        <td className="p-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.source === 'inventory' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {item.source === 'inventory' ? 'Inventory' : 'Outsourced'}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeAdditionalLaborItem(item.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-semibold mb-3">Payment Information</h4>
          <div className="space-y-4">
            {/* Payment Made/Not Made Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Has Payment Been Made? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="yes"
                    checked={paymentMade === 'yes'}
                    onChange={(e) => setPaymentMade(e.target.value as 'yes' | 'no')}
                    className="mr-2"
                  />
                  Payment Made (Enter transaction code)
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="no"
                    checked={paymentMade === 'no'}
                    onChange={(e) => setPaymentMade(e.target.value as 'yes' | 'no')}
                    className="mr-2"
                  />
                  Payment Not Made (Will pay later)
                </label>
              </div>
              {paymentMade === 'no' && (
                <p className="text-xs text-orange-600 mt-1">
                  Repair will be marked as pending collection. Transaction code can be entered when customer comes to pay.
                </p>
              )}
            </div>

            {/* Payment Method - Only show if payment made */}
            {paymentMade === 'yes' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value as PaymentMethod);
                      // split payments not used
                    }}
                  >
                    <option value="cash_to_deposit">Cash to Deposit</option>
                    <option value="mpesa_to_paybill">M-pesa to Paybill</option>
                    <option value="mpesa_to_mpesa_shop">M-pesa to M-pesa Shop</option>
                    <option value="bank_to_mpesa_shop">Bank to M-pesa Shop</option>
                    <option value="bank_to_shop_bank">Bank to Shop Bank</option>
                    <option value="sacco_to_mpesa">Sacco to M-pesa</option>
                  </select>
                </div>

                {/* Cash to Deposit */}
                {paymentMethod === 'cash_to_deposit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction Code (Required) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                      placeholder="Enter transaction code after depositing cash"
                      value={transactionCodes.cash_to_deposit}
                      onChange={(e) => setTransactionCodes({ ...transactionCodes, cash_to_deposit: e.target.value.toUpperCase() })}
                    />
                    <p className="text-xs text-red-600 mt-1">Staff must deposit cash and provide the code</p>
                  </div>
                )}

                {/* Mpesa to Paybill */}
                {paymentMethod === 'mpesa_to_paybill' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      MPESA Transaction Code (Required) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                      placeholder="Enter MPESA transaction code"
                      value={transactionCodes.mpesa_to_paybill}
                      onChange={(e) => setTransactionCodes({ ...transactionCodes, mpesa_to_paybill: e.target.value.toUpperCase() })}
                    />
                  </div>
                )}

                {/* Mpesa to M-pesa Shop */}
                {paymentMethod === 'mpesa_to_mpesa_shop' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      MPESA Transaction Code (Required) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                      placeholder="Enter MPESA transaction code"
                      value={transactionCodes.mpesa_to_mpesa_shop}
                      onChange={(e) => setTransactionCodes({ ...transactionCodes, mpesa_to_mpesa_shop: e.target.value.toUpperCase() })}
                    />
                  </div>
                )}

                {/* Bank to M-pesa Shop */}
                {paymentMethod === 'bank_to_mpesa_shop' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="border border-gray-300 rounded-md px-3 py-2 w-full mb-2"
                        value={transactionCodes.bank === transactionCodes.customBank ? 'custom' : transactionCodes.bank}
                        onChange={(e) => {
                          const bankValue = e.target.value;
                          if (bankValue === 'custom') {
                            setTransactionCodes({ 
                              ...transactionCodes, 
                              bank: transactionCodes.customBank || '',
                            });
                          } else {
                            setTransactionCodes({ 
                              ...transactionCodes, 
                              bank: bankValue,
                              customBank: ''
                            });
                          }
                        }}
                      >
                        <option value="">Select Bank</option>
                        <option value="KCB">KCB</option>
                        <option value="Equity">Equity</option>
                        <option value="Cooperative">Cooperative</option>
                        <option value="Absa">Absa</option>
                        <option value="Standard Chartered">Standard Chartered</option>
                        <option value="custom">Enter Bank Name</option>
                      </select>
                      {(transactionCodes.bank === transactionCodes.customBank || transactionCodes.bank === '') && (
                        <input
                          type="text"
                          className="border border-gray-300 rounded-md px-3 py-2 w-full mt-2"
                          placeholder="Enter bank name"
                          value={transactionCodes.customBank}
                          onChange={(e) => setTransactionCodes({ ...transactionCodes, customBank: e.target.value, bank: e.target.value })}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Code (Required) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                        placeholder="Enter transaction code"
                        value={transactionCodes.bank_to_mpesa_shop}
                        onChange={(e) => setTransactionCodes({ ...transactionCodes, bank_to_mpesa_shop: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </>
                )}

                {/* Bank to Shop Bank */}
                {paymentMethod === 'bank_to_shop_bank' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="border border-gray-300 rounded-md px-3 py-2 w-full mb-2"
                        value={transactionCodes.bank === transactionCodes.customBank ? 'custom' : transactionCodes.bank}
                        onChange={(e) => {
                          const bankValue = e.target.value;
                          if (bankValue === 'custom') {
                            setTransactionCodes({ 
                              ...transactionCodes, 
                              bank: transactionCodes.customBank || '',
                            });
                          } else {
                            setTransactionCodes({ 
                              ...transactionCodes, 
                              bank: bankValue,
                              customBank: ''
                            });
                          }
                        }}
                      >
                        <option value="">Select Bank</option>
                        <option value="KCB">KCB</option>
                        <option value="Equity">Equity</option>
                        <option value="Cooperative">Cooperative</option>
                        <option value="Absa">Absa</option>
                        <option value="Standard Chartered">Standard Chartered</option>
                        <option value="custom">Enter Bank Name</option>
                      </select>
                      {(transactionCodes.bank === transactionCodes.customBank || transactionCodes.bank === '') && (
                        <input
                          type="text"
                          className="border border-gray-300 rounded-md px-3 py-2 w-full mt-2"
                          placeholder="Enter bank name"
                          value={transactionCodes.customBank}
                          onChange={(e) => setTransactionCodes({ ...transactionCodes, customBank: e.target.value, bank: e.target.value })}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Code (Required) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                        placeholder="Enter transaction code"
                        value={transactionCodes.bank_to_shop_bank}
                        onChange={(e) => setTransactionCodes({ ...transactionCodes, bank_to_shop_bank: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </>
                )}

                {/* Sacco to M-pesa */}
                {paymentMethod === 'sacco_to_mpesa' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sacco <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="border border-gray-300 rounded-md px-3 py-2 w-full"
                        value={transactionCodes.bank}
                        onChange={(e) => setTransactionCodes({ ...transactionCodes, bank: e.target.value })}
                      >
                        <option value="">Select Sacco</option>
                        <option value="KCB">KCB</option>
                        <option value="Equity">Equity</option>
                        <option value="Cooperative">Cooperative</option>
                        <option value="Absa">Absa</option>
                        <option value="Standard Chartered">Standard Chartered</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Code (Required) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                        placeholder="Enter transaction code"
                        value={transactionCodes.sacco_to_mpesa}
                        onChange={(e) => setTransactionCodes({ ...transactionCodes, sacco_to_mpesa: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </>
                )}

              </>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="border-t pt-4 mt-4 bg-gray-50 p-4 rounded">
          <div className="space-y-2">
            <div className="flex justify-between border-t pt-2 font-bold text-lg">
              <span>Total Agreed Amount:</span>
              <span className="text-green-600">KES {form.totalAgreedAmount ? Number(form.totalAgreedAmount).toLocaleString() : '0'}</span>
            </div>
            {paymentMade === 'yes' && (
              <div className="flex justify-between border-t pt-2">
                <span>Amount Paid:</span>
                <span className="font-semibold text-green-600">KES {getTotalPaid().toLocaleString()}</span>
              </div>
            )}
            {form.totalAgreedAmount && paymentMade === 'yes' && getTotalPaid() < Number(form.totalAgreedAmount) && (
              <div className="flex justify-between">
                <span className="text-red-600">Balance:</span>
                <span className="font-semibold text-red-600">KES {(Number(form.totalAgreedAmount) - getTotalPaid()).toLocaleString()}</span>
              </div>
            )}
            {paymentMade === 'no' && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-orange-600">Payment Status:</span>
                <span className="font-semibold text-orange-600">Not Paid - Will pay later</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleCompleteRepairSale}
          className="w-full mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
        >
          Complete Repair Sale & Generate Receipt
        </button>
      </div>
    </div>
  );
}
