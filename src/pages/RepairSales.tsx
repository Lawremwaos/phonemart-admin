import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { useRepair } from "../context/RepairContext";
import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";
import { useSupplier } from "../context/SupplierContext";
import { useSupplierDebt } from "../context/SupplierDebtContext";

type PartSource = 'in-house' | 'outsourced';

type AdditionalLaborItem = {
  id: string;
  itemName: string;
  cost: number;
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

type PaymentMethod = 'cash_to_mpesa' | 'mpesa_to_paybill' | 'split_payment' | 'bank_to_paybill';

type SplitPayment = {
  method: 'cash' | 'mpesa' | 'bank_deposit';
  amount: number;
  transactionCode: string;
  bank?: string;
};

export default function RepairSales() {
  const navigate = useNavigate();
  const { items, deductStock, addStock } = useInventory();
  const { addRepair } = useRepair();
  const { addPayment } = usePayment();
  const { currentShop, currentUser } = useShop();
  const { suppliers, addSupplier } = useSupplier();
  const { addDebt } = useSupplierDebt();

  const [customerStatus, setCustomerStatus] = useState<'waiting' | 'coming_back'>('waiting');
  const [additionalLaborItems, setAdditionalLaborItems] = useState<AdditionalLaborItem[]>([]);
  const [additionalLaborItemName, setAdditionalLaborItemName] = useState("");
  const [additionalLaborItemCost, setAdditionalLaborItemCost] = useState("");
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
    additionalLaborCost: "",
    outsourcedCost: "",
  });

  const [selectedParts, setSelectedParts] = useState<RepairPart[]>([]);
  const [partName, setPartName] = useState("");
  const [partSource, setPartSource] = useState<PartSource>('in-house');
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [outsourcedPartCost, setOutsourcedPartCost] = useState("");
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
    cash_to_mpesa: "",
    mpesa_to_paybill: "",
    bank_to_paybill: "",
    bank: "",
  });
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [splitPaymentMethod, setSplitPaymentMethod] = useState<'cash' | 'mpesa' | 'bank_deposit'>('cash');
  const [splitPaymentAmount, setSplitPaymentAmount] = useState("");
  const [splitPaymentCode, setSplitPaymentCode] = useState("");
  const [splitPaymentBank, setSplitPaymentBank] = useState("");

  // Auto-set technician from logged-in user
  const technician = currentUser?.name || "";

  function addNewSupplier() {
    if (!newSupplierName.trim()) {
      alert("Please enter supplier name");
      return;
    }
    const supplierName = newSupplierName.trim();
    addSupplier({ name: supplierName });
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
      if (!outsourcedPartCost || Number(outsourcedPartCost) <= 0) {
        alert("Please enter the cost for outsourced part");
        return;
      }
      if (!selectedSupplierId) {
        alert("Please select a supplier for outsourced part");
        return;
      }
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    const cost = partSource === 'in-house' 
      ? 0 // Will be calculated later or set manually
      : Number(outsourcedPartCost || 0);

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
    setOutsourcedPartCost("");
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
    if (!additionalLaborItemName || !additionalLaborItemCost || Number(additionalLaborItemCost) <= 0) {
      alert("Please enter item name and cost");
      return;
    }
    setAdditionalLaborItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        itemName: additionalLaborItemName,
        cost: Number(additionalLaborItemCost),
      },
    ]);
    setAdditionalLaborItemName("");
    setAdditionalLaborItemCost("");
  }

  function removeAdditionalLaborItem(id: string) {
    setAdditionalLaborItems(prev => prev.filter(item => item.id !== id));
  }

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

  function calculateTotal() {
    const partsTotal = selectedParts.reduce((sum, part) => sum + (part.cost * part.qty), 0);
    const additionalLaborTotal = selectedParts.reduce((sum, part) => sum + (part.additionalLaborCost || 0), 0);
    const additionalLaborItemsTotal = additionalLaborItems.reduce((sum, item) => sum + item.cost, 0);
    const outsourcedPartsCost = selectedParts
      .filter(p => p.source === 'outsourced')
      .reduce((sum, part) => sum + (part.cost * part.qty), 0);
    const additionalOutsourced = Number(form.outsourcedCost || 0);
    const additionalLaborCost = Number(form.additionalLaborCost || 0);
    
    return {
      partsTotal,
      outsourcedPartsCost,
      additionalOutsourced,
      additionalLaborCost,
      additionalLaborTotal,
      additionalLaborItemsTotal,
      total: partsTotal + additionalLaborTotal + additionalLaborItemsTotal + additionalOutsourced + additionalLaborCost,
      totalOutsourced: outsourcedPartsCost + additionalOutsourced,
    };
  }

  const totals = calculateTotal();

  function getTotalPaid() {
    if (paymentMethod === 'split_payment') {
      return splitPayments.reduce((sum, p) => sum + p.amount, 0);
    }
    return totals.total;
  }

  function validateTransactionCodes() {
    // If payment is not made, skip validation
    if (paymentMade === 'no') {
      return true;
    }
    
    if (paymentMethod === 'cash_to_mpesa') {
      if (!transactionCodes.cash_to_mpesa) {
        alert("Transaction code is required! Staff must deposit cash to MPESA and provide the code.");
        return false;
      }
    } else if (paymentMethod === 'mpesa_to_paybill') {
      if (!transactionCodes.mpesa_to_paybill) {
        alert("MPESA transaction code is required!");
        return false;
      }
    } else if (paymentMethod === 'bank_to_paybill') {
      if (!transactionCodes.bank_to_paybill) {
        alert("Bank transaction code is required!");
        return false;
      }
      if (!transactionCodes.bank) {
        alert("Please select the bank");
        return false;
      }
    } else if (paymentMethod === 'split_payment') {
      if (splitPayments.length === 0) {
        alert("Please add at least one payment method");
        return false;
      }
      for (const payment of splitPayments) {
        if (!payment.transactionCode) {
          alert("All payment methods must have transaction codes");
          return false;
        }
      }
    }
    return true;
  }

  function handleCompleteRepairSale() {
    if (!form.customerName || !form.customerPhone || !form.phoneModel || !form.issue || !form.totalAgreedAmount) {
      alert("Please fill in all required fields (Customer Name, Phone, Model, Issue, Total Agreed Amount)");
      return;
    }

    if (selectedParts.length === 0) {
      alert("Please add at least one part");
      return;
    }

    if (!validateTransactionCodes()) {
      return;
    }

    // If payment not made, set to pending
    const paidAmount = paymentMade === 'yes' ? getTotalPaid() : 0;
    const balance = totals.total - paidAmount;
    const paymentStatus = paymentMade === 'no' ? 'pending' : (balance <= 0 ? 'fully_paid' : paidAmount > 0 ? 'partial' : 'pending');

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
      outsourcedCost: totals.totalOutsourced,
      laborCost: totals.additionalLaborCost + totals.additionalLaborTotal + totals.additionalLaborItemsTotal,
      status: paymentMade === 'no' || customerStatus === 'coming_back'
        ? 'PAYMENT_PENDING' as const
        : (paymentStatus === 'fully_paid' ? 'FULLY_PAID' as const : 'PAYMENT_PENDING' as const),
      shopId: currentShop?.id,
      paymentStatus: paymentStatus,
      customerStatus: customerStatus,
      totalAgreedAmount: Number(form.totalAgreedAmount),
      paymentTiming: form.paymentTiming,
      depositAmount: Number(form.depositAmount || 0),
      paymentMade: paymentMade === 'yes', // Store if payment was made
      pendingTransactionCodes: paymentMade === 'no' ? {
        paymentMethod,
        transactionCodes: { ...transactionCodes },
        splitPayments: [...splitPayments],
      } : undefined, // Store payment method info for later confirmation
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

    // Add payment records only if payment was made
    if (paymentMade === 'yes') {
      if (paymentMethod === 'split_payment') {
        splitPayments.forEach(payment => {
          addPayment({
            type: payment.method,
            amount: payment.amount,
            state: paymentStatus === 'fully_paid' ? 'fully_paid' : 'partial',
            bank: payment.bank as any,
            depositReference: payment.transactionCode,
            shopId: currentShop?.id,
            relatedTo: 'repair',
            relatedId: repairId,
            deposited: payment.method === 'cash' ? false : true,
          });
        });
      } else {
        addPayment({
          type: paymentMethod === 'cash_to_mpesa' ? 'cash' : paymentMethod === 'mpesa_to_paybill' ? 'mpesa' : 'bank_deposit',
          amount: paidAmount,
          state: paymentStatus === 'fully_paid' ? 'fully_paid' : 'partial',
          bank: paymentMethod === 'bank_to_paybill' ? transactionCodes.bank as any : undefined,
          depositReference: paymentMethod === 'cash_to_mpesa' ? transactionCodes.cash_to_mpesa : 
                           paymentMethod === 'mpesa_to_paybill' ? transactionCodes.mpesa_to_paybill :
                           transactionCodes.bank_to_paybill,
          shopId: currentShop?.id,
          relatedTo: 'repair',
          relatedId: repairId,
          deposited: paymentMethod === 'cash_to_mpesa' ? true : paymentMethod !== 'bank_to_paybill',
        });
      }
    }

    // Create receipt data
    const receiptData = {
      id: Date.now().toString(),
      date: new Date(),
      shopId: currentShop?.id,
      saleType: 'repair' as const,
      items: [
        ...selectedParts.map(p => ({
          name: p.itemName,
          qty: p.qty,
          price: p.cost,
        })),
        ...additionalLaborItems.map(item => ({
          name: item.itemName,
          qty: 1,
          price: item.cost,
        })),
      ],
      total: totals.total,
      paymentMethod,
      paymentStatus,
      amountPaid: paidAmount,
      balance,
      transactionCodes: paymentMethod === 'split_payment' 
        ? splitPayments.map(p => ({ method: p.method, code: p.transactionCode, bank: p.bank }))
        : paymentMethod === 'cash_to_mpesa' 
          ? [{ method: 'cash_to_mpesa', code: transactionCodes.cash_to_mpesa }]
          : paymentMethod === 'mpesa_to_paybill'
            ? [{ method: 'mpesa_to_paybill', code: transactionCodes.mpesa_to_paybill }]
            : [{ method: 'bank_to_paybill', code: transactionCodes.bank_to_paybill, bank: transactionCodes.bank }],
      outsourcedCost: totals.totalOutsourced,
      laborCost: totals.additionalLaborCost + totals.additionalLaborTotal + totals.additionalLaborItemsTotal,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      phoneModel: `${form.phoneBrand} ${form.phoneModel}`.trim(),
      issue: form.issue,
      technician: technician,
      customerStatus,
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
      additionalLaborCost: "",
      outsourcedCost: "",
    });
    setSelectedParts([]);
    setAdditionalLaborItems([]);
    setCustomerStatus('waiting');
    setPaymentMethod('mpesa_to_paybill');
    setTransactionCodes({
      cash_to_mpesa: "",
      mpesa_to_paybill: "",
      bank_to_paybill: "",
      bank: "",
    });
    setSplitPayments([]);

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
              onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty if no deposit required</p>
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
                setOutsourcedPartCost("");
              }
            }}
          >
            <option value="in-house">In-House</option>
            <option value="outsourced">Outsourced</option>
          </select>

          {partSource === 'outsourced' && (
            <>
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
              <input
                type="number"
                className="border border-gray-300 rounded-md px-3 py-2"
                placeholder="Cost (KES)"
                value={outsourcedPartCost}
                onChange={(e) => setOutsourcedPartCost(e.target.value)}
              />
            </>
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
                  <th className="p-2 text-right text-sm">Cost</th>
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
                    <td className="p-2 text-right text-sm">KES {part.cost.toLocaleString()}</td>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Technician
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 w-full bg-gray-100"
              value={technician}
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Additional Labor Cost (KES)</label>
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="0"
              value={form.additionalLaborCost}
              onChange={(e) => setForm({ ...form, additionalLaborCost: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">For general repair labor</p>
          </div>
        </div>

        {/* Additional Labor Items (Screen Protector, Charger, etc.) */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-semibold mb-3">Additional Items & Services</h4>
          <p className="text-sm text-gray-600 mb-3">Add items like screen protector, charger, case, etc.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2"
              placeholder="Item name (e.g., Screen Protector)"
              value={additionalLaborItemName}
              onChange={(e) => setAdditionalLaborItemName(e.target.value)}
            />
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-2"
              placeholder="Cost (KES)"
              value={additionalLaborItemCost}
              onChange={(e) => setAdditionalLaborItemCost(e.target.value)}
            />
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
                    <th className="p-2 text-right text-sm">Cost</th>
                    <th className="p-2 text-center text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {additionalLaborItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2 text-sm">{item.itemName}</td>
                      <td className="p-2 text-right text-sm font-semibold">KES {item.cost.toLocaleString()}</td>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Additional Outsourced Cost (KES)</label>
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="0"
              value={form.outsourcedCost}
              onChange={(e) => setForm({ ...form, outsourcedCost: e.target.value })}
            />
          </div>
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
                      setSplitPayments([]);
                    }}
                  >
                    <option value="cash_to_mpesa">Cash to Mpesa Deposit</option>
                    <option value="mpesa_to_paybill">Mpesa to Paybill</option>
                    <option value="split_payment">Split Payment</option>
                    <option value="bank_to_paybill">Bank to Paybill</option>
                  </select>
                </div>

                {/* Cash to Mpesa */}
                {paymentMethod === 'cash_to_mpesa' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Code (Required) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                  placeholder="Enter MPESA transaction code after depositing cash"
                  value={transactionCodes.cash_to_mpesa}
                  onChange={(e) => setTransactionCodes({ ...transactionCodes, cash_to_mpesa: e.target.value.toUpperCase() })}
                />
                  <p className="text-xs text-red-600 mt-1">Staff must deposit cash to MPESA and provide the code</p>
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

                {/* Bank to Paybill */}
                {paymentMethod === 'bank_to_paybill' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="border border-gray-300 rounded-md px-3 py-2 w-full"
                        value={transactionCodes.bank}
                        onChange={(e) => setTransactionCodes({ ...transactionCodes, bank: e.target.value })}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Code (Required) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                        placeholder="Enter bank transaction code"
                        value={transactionCodes.bank_to_paybill}
                        onChange={(e) => setTransactionCodes({ ...transactionCodes, bank_to_paybill: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </>
                )}

                {/* Split Payment */}
                {paymentMethod === 'split_payment' && (
              <div className="space-y-4">
                <div className="border p-4 rounded bg-gray-50">
                  <h5 className="font-semibold mb-3">Add Payment Method</h5>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select
                      className="border border-gray-300 rounded-md px-3 py-2"
                      value={splitPaymentMethod}
                      onChange={(e) => setSplitPaymentMethod(e.target.value as 'cash' | 'mpesa' | 'bank_deposit')}
                    >
                      <option value="cash">Cash</option>
                      <option value="mpesa">MPESA</option>
                      <option value="bank_deposit">Bank Deposit</option>
                    </select>
                    <input
                      type="number"
                      className="border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Amount"
                      value={splitPaymentAmount}
                      onChange={(e) => setSplitPaymentAmount(e.target.value)}
                    />
                    <input
                      type="text"
                      className="border border-gray-300 rounded-md px-3 py-2 uppercase"
                      placeholder="Transaction Code"
                      value={splitPaymentCode}
                      onChange={(e) => setSplitPaymentCode(e.target.value.toUpperCase())}
                    />
                    {splitPaymentMethod === 'bank_deposit' && (
                      <select
                        className="border border-gray-300 rounded-md px-3 py-2"
                        value={splitPaymentBank}
                        onChange={(e) => setSplitPaymentBank(e.target.value)}
                      >
                        <option value="">Select Bank</option>
                        <option value="KCB">KCB</option>
                        <option value="Equity">Equity</option>
                        <option value="Cooperative">Cooperative</option>
                        <option value="Absa">Absa</option>
                        <option value="Standard Chartered">Standard Chartered</option>
                      </select>
                    )}
                    {splitPaymentMethod !== 'bank_deposit' && <div></div>}
                    <button
                      onClick={addSplitPayment}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {splitPayments.length > 0 && (
                  <div>
                    <h5 className="font-semibold mb-2">Payment Methods Added:</h5>
                    <table className="w-full border">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-left text-sm">Method</th>
                          <th className="p-2 text-right text-sm">Amount</th>
                          <th className="p-2 text-left text-sm">Transaction Code</th>
                          <th className="p-2 text-left text-sm">Bank</th>
                          <th className="p-2 text-center text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitPayments.map((payment, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2 text-sm capitalize">{payment.method.replace('_', ' ')}</td>
                            <td className="p-2 text-right text-sm">KES {payment.amount.toLocaleString()}</td>
                            <td className="p-2 text-sm font-mono">{payment.transactionCode}</td>
                            <td className="p-2 text-sm">{payment.bank || '-'}</td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => removeSplitPayment(index)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2 text-right">
                      <span className="font-semibold">Total: KES {getTotalPaid().toLocaleString()}</span>
                    </div>
                  </div>
                )}
                </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="border-t pt-4 mt-4 bg-gray-50 p-4 rounded">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Parts Total:</span>
              <span className="font-semibold">KES {totals.partsTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Additional Labor (Parts):</span>
              <span className="font-semibold">KES {totals.additionalLaborTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Additional Items & Services:</span>
              <span className="font-semibold">KES {totals.additionalLaborItemsTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Additional Labor (General):</span>
              <span className="font-semibold">KES {totals.additionalLaborCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Outsourced Parts:</span>
              <span className="font-semibold text-orange-600">KES {totals.outsourcedPartsCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Additional Outsourced:</span>
              <span className="font-semibold text-orange-600">KES {totals.additionalOutsourced.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold text-lg">
              <span>TOTAL:</span>
              <span className="text-green-600">KES {totals.total.toLocaleString()}</span>
            </div>
            {paymentMethod === 'split_payment' && (
              <div className="flex justify-between border-t pt-2">
                <span>Amount Paid:</span>
                <span className="font-semibold text-green-600">KES {getTotalPaid().toLocaleString()}</span>
              </div>
            )}
            {getTotalPaid() < totals.total && (
              <div className="flex justify-between">
                <span className="text-red-600">Balance:</span>
                <span className="font-semibold text-red-600">KES {(totals.total - getTotalPaid()).toLocaleString()}</span>
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
