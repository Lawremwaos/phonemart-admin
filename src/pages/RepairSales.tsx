import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import { useRepair } from "../context/RepairContext";
import { useSales } from "../context/SalesContext";
import type { RepairStatus } from "../context/RepairContext";
// import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";
import { useSupplier } from "../context/SupplierContext";
import ShopSelector from "../components/ShopSelector";
import type { RepairLineKind } from "../utils/repairPartSource";
import { lineKindLabel, sourceLabelForReceipt } from "../utils/repairPartSource";

type PartSource = "in-house" | "outsourced";

type RepairPart = {
  itemId: number;
  itemName: string;
  qty: number;
  cost: number;
  source: PartSource;
  lineKind: RepairLineKind;
  supplierId?: string;
  supplierName?: string;
};

type PaymentMethod = 'cash_to_deposit' | 'mpesa_to_paybill' | 'mpesa_to_mpesa_shop' | 'bank_to_mpesa_shop' | 'bank_to_shop_bank' | 'sacco_to_mpesa';

type SplitPaymentEntry = {
  method: PaymentMethod;
  amount: number;
  transactionCode: string;
  bank?: string;
};

export default function RepairSales() {
  const navigate = useNavigate();
  const { items, addStock } = useInventory();
  const { addRepair } = useRepair();
  const { addRepairAccessorySale } = useSales();
  // Payments are recorded after admin approval on the Pending Payment Approval page
  const { currentShop, currentUser } = useShop();
  const { suppliers, addSupplier } = useSupplier();
  const isAdmin = currentUser?.roles.includes('admin') ?? false;
  // Staff see only local suppliers; admin sees all
  const sparePartSuppliers = suppliers.filter(s => s.categories.includes('spare_parts')).filter(s => isAdmin || s.supplierType !== 'wholesale');
  const accessorySuppliers = useMemo(
    () => suppliers.filter((s) => s.categories.includes("accessories")),
    [suppliers]
  );
  const spareShopItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.shopId === currentShop?.id &&
          i.stock > 0 &&
          (i.category === "Spare" || i.category === "Phone")
      ),
    [items, currentShop?.id]
  );
  const accessoryShopItems = useMemo(
    () =>
      items.filter((i) => i.shopId === currentShop?.id && i.stock > 0 && i.category === "Accessory"),
    [items, currentShop?.id]
  );

  const serviceSuppliers = useMemo(() => {
    const byId = new Map<string, (typeof suppliers)[0]>();
    for (const s of sparePartSuppliers) byId.set(s.id, s);
    for (const s of accessorySuppliers) {
      if (!byId.has(s.id)) byId.set(s.id, s);
    }
    return Array.from(byId.values());
  }, [sparePartSuppliers, accessorySuppliers]);

  const [customerStatus, setCustomerStatus] = useState<'waiting' | 'coming_back'>('waiting');
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
  const [partLineKind, setPartLineKind] = useState<RepairLineKind>("spare_part");
  const [partName, setPartName] = useState("");
  const [partSource, setPartSource] = useState<PartSource>("in-house");
  const [spareInventoryPickId, setSpareInventoryPickId] = useState<string>("");
  const [accessoryInventoryPickId, setAccessoryInventoryPickId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [manualSupplierName, setManualSupplierName] = useState("");
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
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [splitPayments, setSplitPayments] = useState<SplitPaymentEntry[]>([]);
  const [splitPaymentMethod, setSplitPaymentMethod] = useState<PaymentMethod>('mpesa_to_paybill');
  const [splitPaymentAmount, setSplitPaymentAmount] = useState("");
  const [splitPaymentCode, setSplitPaymentCode] = useState("");
  const [splitPaymentBank, setSplitPaymentBank] = useState("");
  const [isSubmittingRepairSale, setIsSubmittingRepairSale] = useState(false);
  const repairSaleSubmitLock = useRef(false);

  // Auto-set technician from logged-in user
  const technician = currentUser?.name || "";

  async function addNewSupplier() {
    if (!newSupplierName.trim()) {
      alert("Please enter supplier name");
      return;
    }
    const supplierName = newSupplierName.trim();
    const categories =
      partLineKind === "accessory" ? (["accessories"] as const) : (["spare_parts"] as const);
    try {
      await addSupplier({ name: supplierName, categories: [...categories], supplierType: "local" });
      setPendingSupplierName(supplierName);
      setNewSupplierName("");
      setShowAddSupplier(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Could not add supplier: ${err?.message || "Unknown error"}. Please try again.`);
    }
  }

  function resolveSupplierName(): string | undefined {
    if (manualSupplierName.trim()) return manualSupplierName.trim();
    if (selectedSupplierId) {
      const s = suppliers.find((x) => x.id === selectedSupplierId);
      return s?.name;
    }
    return undefined;
  }

  function addPart() {
    const supplierNameResolved = resolveSupplierName();

    if (partLineKind === "service") {
      if (!partName.trim()) {
        alert("Describe the service (e.g. software update, cleaning).");
        return;
      }
      setSelectedParts((prev) => [
        ...prev,
        {
          itemId: Date.now(),
          itemName: partName.trim(),
          qty: 1,
          cost: 0,
          source: "in-house",
          lineKind: "service",
          supplierName: supplierNameResolved,
        },
      ]);
      setPartName("");
      setManualSupplierName("");
      setSelectedSupplierId("");
      return;
    }

    if (partSource === "outsourced") {
      if (!supplierNameResolved) {
        alert("Select a supplier or type the supplier name for outsourced items.");
        return;
      }
    }

    let selectedItemId = Date.now();
    let supplierId: string | undefined;
    let cost = 0;
    let itemName = partName.trim();

    if (partLineKind === "spare_part") {
      if (partSource === "in-house") {
        const fromPick = spareInventoryPickId
          ? items.find((i) => i.id === Number(spareInventoryPickId))
          : undefined;
        const inventoryItem =
          fromPick ||
          items.find(
            (i) =>
              i.name.toLowerCase() === partName.trim().toLowerCase() &&
              i.stock > 0 &&
              i.shopId === currentShop?.id &&
              (i.category === "Spare" || i.category === "Phone")
          );
        if (!inventoryItem) {
          alert(
            "For spare parts from our stock: pick from the list or type the exact name of a Spare/Phone item with stock at this shop."
          );
          return;
        }
        selectedItemId = inventoryItem.id;
        itemName = inventoryItem.name;
        cost = inventoryItem.adminCostPrice || inventoryItem.costPrice || 0;
        addStock(inventoryItem.id, -1);
      } else {
        if (!itemName) {
          alert("Enter the spare part name.");
          return;
        }
        supplierId = selectedSupplierId || undefined;
        cost = 0;
      }
    } else {
      // accessory
      if (partSource === "in-house") {
        const accId = accessoryInventoryPickId ? Number(accessoryInventoryPickId) : null;
        const inventoryItem = accId
          ? items.find((i) => i.id === accId && i.category === "Accessory")
          : items.find(
              (i) =>
                i.name.toLowerCase() === partName.trim().toLowerCase() &&
                i.stock > 0 &&
                i.shopId === currentShop?.id &&
                i.category === "Accessory"
            );
        if (!inventoryItem) {
          alert("Select an accessory from inventory with stock at this shop, or type the exact accessory name.");
          return;
        }
        selectedItemId = inventoryItem.id;
        itemName = inventoryItem.name;
        cost = inventoryItem.adminCostPrice || inventoryItem.costPrice || 0;
        addStock(inventoryItem.id, -1);
      } else {
        if (!itemName) {
          alert("Enter the accessory name.");
          return;
        }
        supplierId = selectedSupplierId || undefined;
        cost = 0;
      }
    }

    setSelectedParts((prev) => [
      ...prev,
      {
        itemId: selectedItemId,
        itemName,
        qty: 1,
        cost,
        source: partSource,
        lineKind: partLineKind,
        supplierId,
        supplierName: partSource === "outsourced" ? supplierNameResolved : undefined,
      },
    ]);

    setPartName("");
    setPartSource("in-house");
    setSelectedSupplierId("");
    setManualSupplierName("");
    setSpareInventoryPickId("");
    setAccessoryInventoryPickId("");
  }

  function removePart(index: number) {
    const part = selectedParts[index];
    if (part.source === "in-house" && part.lineKind !== "service") {
      const item = items.find((i) => i.id === part.itemId);
      if (item) {
        addStock(item.id, part.qty);
      }
    }
    setSelectedParts((prev) => prev.filter((_, i) => i !== index));
  }

  const bankMethods: PaymentMethod[] = ['bank_to_mpesa_shop', 'bank_to_shop_bank', 'sacco_to_mpesa'];

  function addSplitPayment() {
    const amount = Number(splitPaymentAmount);
    if (!splitPaymentAmount || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    const code = splitPaymentCode.trim().toUpperCase();
    if (!code) {
      alert("Please enter transaction code");
      return;
    }
    if (bankMethods.includes(splitPaymentMethod) && !transactionCodes.bank && !splitPaymentBank) {
      alert("Please select a bank for this payment");
      return;
    }
    const bank = bankMethods.includes(splitPaymentMethod) ? (splitPaymentBank || transactionCodes.bank || transactionCodes.customBank) : undefined;
    setSplitPayments(prev => [
      ...prev,
      { method: splitPaymentMethod, amount, transactionCode: code, bank },
    ]);
    setSplitPaymentAmount("");
    setSplitPaymentCode("");
    setSplitPaymentBank("");
  }

  function removeSplitPayment(index: number) {
    setSplitPayments(prev => prev.filter((_, i) => i !== index));
  }

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

  function getAmountPaid() {
    const depositAmount = Number(form.depositAmount || 0);
    if (depositAmount > 0) return depositAmount;
    if (paymentMade === 'no') return 0;
    if (paymentMode === 'split' && splitPayments.length > 0) {
      return splitPayments.reduce((sum, p) => sum + p.amount, 0);
    }
    return Number(form.totalAgreedAmount || 0);
  }

  function validateTransactionCodes() {
    if (paymentMade === 'no') return true;

    if (paymentMode === 'split') {
      if (splitPayments.length === 0) {
        alert("Add at least one payment (e.g. M-Pesa amount + code, then Bank amount + code).");
        return false;
      }
      for (let i = 0; i < splitPayments.length; i++) {
        const p = splitPayments[i];
        if (p.amount <= 0 || !p.transactionCode.trim()) {
          alert(`Payment ${i + 1}: enter amount and transaction code.`);
          return false;
        }
        if (bankMethods.includes(p.method) && !p.bank?.trim()) {
          alert(`Payment ${i + 1}: select bank for ${p.method}.`);
          return false;
        }
      }
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

  async function handleCompleteRepairSale() {
    if (repairSaleSubmitLock.current || isSubmittingRepairSale) return;

    if (!form.customerName || !form.customerPhone || !form.phoneModel || !form.issue || !form.totalAgreedAmount) {
      alert("Please fill in all required fields (Customer Name, Phone, Model, Issue, Total Agreed Amount)");
      return;
    }

    if (!validateTransactionCodes()) {
      return;
    }

    repairSaleSubmitLock.current = true;
    setIsSubmittingRepairSale(true);

    try {
    const finalTotal = Number(form.totalAgreedAmount);
    const depositAmount = Number(form.depositAmount || 0);
    const paidAmount = getAmountPaid();
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

    // Generate ticket number (unless deposit)
    // If deposit is made, no ticket number (receipt will be generated)
    // If no deposit, assign ticket number
    const ticketNumber = depositAmount > 0 ? undefined : `TKT-${Date.now().toString().slice(-6)}`;

    // Create repair record
    const repair = {
      customerName: form.customerName,
      phoneNumber: form.customerPhone,
      imei: form.imei,
      phoneModel: `${form.phoneBrand} ${form.phoneModel}`.trim(),
      issue: form.issue,
      technician: technician,
      partsUsed: selectedParts.map((p) => ({
        itemId: p.itemId,
        itemName: p.itemName,
        qty: p.qty,
        cost: p.cost,
        supplierName: p.supplierName,
        source: p.source,
        lineKind: p.lineKind,
      })),
      additionalItems: [],
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
      pendingTransactionCodes: paymentMode === 'split' && splitPayments.length > 0
        ? { splitPayments: splitPayments.map(p => ({ method: p.method, amount: p.amount, transactionCode: p.transactionCode, bank: p.bank })) }
        : { paymentMethod, transactionCodes: { ...transactionCodes } },
      ticketNumber: ticketNumber,
      collected: false,
      serviceType:
        selectedParts.filter((p) => p.lineKind === "service").map((p) => p.itemName).join("; ") || undefined,
    };

    const repairId = await addRepair(repair);
    if (!repairId) {
      alert("Failed to save repair. Please try again.");
      return;
    }


    // Record accessory sales for in-house parts that are accessories (unified table, linked to repair)
    const accessoryParts = selectedParts.filter((p) => {
      if (p.lineKind !== "accessory" || p.source !== "in-house" || !p.itemId) return false;
      const inv = items.find((i) => i.id === p.itemId);
      return inv?.category?.toLowerCase() === "accessory";
    });
    if (accessoryParts.length > 0) {
      const accessorySaleItems = accessoryParts.map((p) => {
        const inv = items.find((i) => i.id === p.itemId);
        return {
          itemId: p.itemId,
          name: p.itemName,
          qty: p.qty,
          sellingPrice: inv?.price ?? 0,
          adminBasePrice: inv?.adminCostPrice ?? inv?.costPrice ?? p.cost,
          actualCost: inv?.actualCost ?? undefined,
        };
      });
      try {
        await addRepairAccessorySale(repairId, currentShop?.id, accessorySaleItems, currentUser?.name);
      } catch (e) {
        console.error("Failed to record accessory sale:", e);
      }
    }

    // Outsourced part costs are tracked via repair_parts in Supabase.
    // Staff enters actual costs on the "Cost of Parts" page after the repair.

    // Add payment records only if payment was made (but not yet approved)
    // Payment will be recorded after admin approval

    // Create receipt data - simplified to show only phone, parts, and total
    const receiptData = {
      id: Date.now().toString(),
      date: new Date(),
      shopId: currentShop?.id,
      saleType: 'repair' as const,
      items: selectedParts.map((p) => ({
        name: p.itemName,
        qty: p.qty,
        price: 0,
        lineKind: p.lineKind,
        sourceLabel: sourceLabelForReceipt(p.lineKind, p.source),
        kindLabel: lineKindLabel(p.lineKind),
        supplierName: p.supplierName,
      })),
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
      serviceType:
        selectedParts.filter((p) => p.lineKind === "service").map((p) => p.itemName).join("; ") || undefined,
      ...(paymentMode === 'split' && splitPayments.length > 0 ? { splitPayments } : {}),
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
    setPartLineKind("spare_part");
    setManualSupplierName("");
    setSpareInventoryPickId("");
    setAccessoryInventoryPickId("");
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
    setPaymentMode('single');
    setSplitPayments([]);
    setSplitPaymentAmount('');
    setSplitPaymentCode('');
    setSplitPaymentBank('');

    // Only navigate to receipt if deposit is made
    // Otherwise, just show success message and navigate to pending collections
    if (depositAmount > 0) {
      // Update receipt data with actual repair ID
      receiptData.id = repairId;
      navigate('/receipt', { state: { sale: receiptData } });
    } else {
      alert(`Repair sale completed! Ticket Number: ${ticketNumber}\n\nRepair will be sent to admin for payment approval.`);
      navigate('/pending-collections');
    }
    } finally {
      repairSaleSubmitLock.current = false;
      setIsSubmittingRepairSale(false);
    }
  }

  const supplierListForLine =
    partLineKind === "spare_part"
      ? sparePartSuppliers
      : partLineKind === "accessory"
        ? accessorySuppliers
        : serviceSuppliers;

  return (
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Repairs</p>
          <h2 className="pm-page-title">Repair Sales</h2>
          <p className="pm-page-desc">Capture repair intake, parts usage, and payment details in one flow.</p>
        </div>
      </div>
      <ShopSelector />
      {currentShop && (
        <p className="text-sm text-gray-600">Only stock <strong>allocated to {currentShop.name}</strong> is available for spare parts and accessories from our inventory. Unallocated items cannot be selected.</p>
      )}

      {/* Customer Status */}
      <div className="pm-card pm-pad">
        <label className="pm-label">Customer Status</label>
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
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-4">Customer & Phone Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="pm-label">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="pm-input"
              placeholder="Enter customer name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </div>
          <div>
            <label className="pm-label">
              Customer Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              className="pm-input"
              placeholder="+254712345678"
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            />
          </div>
          <div>
            <label className="pm-label">Phone Brand</label>
            <input
              type="text"
              className="pm-input"
              placeholder="e.g., Samsung, iPhone, etc."
              value={form.phoneBrand}
              onChange={(e) => setForm({ ...form, phoneBrand: e.target.value })}
            />
          </div>
          <div>
            <label className="pm-label">
              Phone Model <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="pm-input"
              placeholder="e.g., Galaxy S21, iPhone 14"
              value={form.phoneModel}
              onChange={(e) => setForm({ ...form, phoneModel: e.target.value })}
            />
          </div>
          <div>
            <label className="pm-label">IMEI Number</label>
            <input
              type="text"
              className="pm-input"
              placeholder="IMEI (optional)"
              value={form.imei}
              onChange={(e) => setForm({ ...form, imei: e.target.value })}
            />
          </div>
          <div>
            <label className="pm-label">
              Issue / Problem <span className="text-red-500">*</span>
            </label>
            <textarea
              className="pm-input"
              placeholder="Describe the issue..."
              rows={3}
              value={form.issue}
              onChange={(e) => setForm({ ...form, issue: e.target.value })}
            />
          </div>
          <div>
            <label className="pm-label">
              Total Agreed Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              className="pm-input"
              placeholder="Enter total amount customer agreed to pay"
              value={form.totalAgreedAmount}
              onChange={(e) => setForm({ ...form, totalAgreedAmount: e.target.value })}
            />
          </div>
          <div>
            <label className="pm-label">
              Payment Timing <span className="text-red-500">*</span>
            </label>
            <select
              className="pm-input"
              value={form.paymentTiming}
              onChange={(e) => setForm({ ...form, paymentTiming: e.target.value as 'before' | 'after' })}
            >
              <option value="before">Before Repair (Payment First)</option>
              <option value="after">After Repair (Payment on Collection)</option>
            </select>
          </div>
          <div>
            <label className="pm-label">
              Deposit Amount (KES)
            </label>
            <input
              type="number"
              className="pm-input"
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

      {/* Parts, accessories & services */}
      <div className="pm-card pm-pad-lg space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Spare parts, accessories & services</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add a spare part or accessory (from our stock or outsourced), or a service that does not require a physical part. Supplier is required when outsourced; optional for services.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="pm-label mb-1">Line type</label>
            <select
              className="pm-input"
              value={partLineKind}
              onChange={(e) => {
                const v = e.target.value as RepairLineKind;
                setPartLineKind(v);
                setPartSource("in-house");
                setSelectedSupplierId("");
                setManualSupplierName("");
                setSpareInventoryPickId("");
                setAccessoryInventoryPickId("");
                setPartName("");
                setShowAddSupplier(false);
              }}
            >
              <option value="spare_part">Spare part used</option>
              <option value="accessory">Accessory used</option>
              <option value="service">Service (no spare part)</option>
            </select>
          </div>
        </div>

        {partLineKind === "service" ? (
          <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div>
              <label className="pm-label mb-1">
                Service description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="pm-input"
                placeholder="e.g. Software update, ultrasonic cleaning"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <label className="pm-label mb-1">Supplier (optional)</label>
                <select
                  className="pm-input"
                  value={selectedSupplierId}
                  onChange={(e) => {
                    if (e.target.value === "add_new") {
                      setShowAddSupplier(true);
                    } else {
                      setSelectedSupplierId(e.target.value);
                    }
                  }}
                >
                  <option value="">— Select or type below —</option>
                  {supplierListForLine.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                  <option value="add_new">+ Add new supplier</option>
                </select>
                {showAddSupplier && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-md p-3 shadow-lg z-10">
                    <input
                      type="text"
                      className="pm-input w-full mb-2"
                      placeholder="Supplier name"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void addNewSupplier()}
                        className="pm-btn pm-btn-primary pm-btn-sm"
                      >
                        Add
                      </button>
                      <button
                        type="button"
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
              <div>
                <label className="pm-label mb-1">Or type supplier name</label>
                <input
                  type="text"
                  className="pm-input"
                  placeholder="Manual supplier name"
                  value={manualSupplierName}
                  onChange={(e) => setManualSupplierName(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={addPart}
              className="pm-btn pm-btn-primary"
            >
              Add line
            </button>
          </div>
        ) : (
          <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div>
              <label className="pm-label mb-1">Source</label>
              <select
                className="pm-input w-full max-w-md"
                value={partSource}
                onChange={(e) => {
                  setPartSource(e.target.value as PartSource);
                  if (e.target.value === "in-house") {
                    setSelectedSupplierId("");
                    setManualSupplierName("");
                  }
                }}
              >
                <option value="in-house">Our inventory (this shop)</option>
                <option value="outsourced">Outsourced</option>
              </select>
            </div>

            {partSource === "in-house" && partLineKind === "spare_part" && (
              <div>
                <label className="pm-label mb-1">Pick spare / phone part</label>
                <select
                  className="pm-input"
                  value={spareInventoryPickId}
                  onChange={(e) => {
                    setSpareInventoryPickId(e.target.value);
                    const it = items.find((i) => i.id === Number(e.target.value));
                    if (it) setPartName(it.name);
                  }}
                >
                  <option value="">— Select from stock —</option>
                  {spareShopItems.map((it) => (
                    <option key={it.id} value={String(it.id)}>
                      {it.name} (stock {it.stock})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Or type the exact name of a Spare/Phone item with stock at this shop.</p>
              </div>
            )}

            {partSource === "in-house" && partLineKind === "accessory" && (
              <div>
                <label className="pm-label mb-1">Pick accessory</label>
                <select
                  className="pm-input"
                  value={accessoryInventoryPickId}
                  onChange={(e) => {
                    setAccessoryInventoryPickId(e.target.value);
                    const it = items.find((i) => i.id === Number(e.target.value));
                    if (it) setPartName(it.name);
                  }}
                >
                  <option value="">— Select from stock —</option>
                  {accessoryShopItems.map((it) => (
                    <option key={it.id} value={String(it.id)}>
                      {it.name} (stock {it.stock})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Or type the exact accessory name with stock at this shop.</p>
              </div>
            )}

            <div>
              <label className="pm-label mb-1">
                {partSource === "in-house" ? "Name (must match stock if not using pick list)" : "Item name"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="pm-input"
                placeholder={partLineKind === "accessory" ? "Accessory name" : "Spare part name"}
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
              />
            </div>

            {partSource === "outsourced" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <label className="pm-label mb-1">Supplier</label>
                  <select
                    className="pm-input"
                    value={selectedSupplierId}
                    onChange={(e) => {
                      if (e.target.value === "add_new") {
                        setShowAddSupplier(true);
                      } else {
                        setSelectedSupplierId(e.target.value);
                      }
                    }}
                  >
                    <option value="">— Select supplier —</option>
                    {supplierListForLine.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                    <option value="add_new">+ Add new supplier</option>
                  </select>
                  {showAddSupplier && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-md p-3 shadow-lg z-10">
                      <input
                        type="text"
                        className="pm-input w-full mb-2"
                        placeholder="Supplier name"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void addNewSupplier()}
                          className="pm-btn pm-btn-primary pm-btn-sm"
                        >
                          Add
                        </button>
                        <button
                          type="button"
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
                <div>
                  <label className="pm-label mb-1">Or type supplier name</label>
                  <input
                    type="text"
                    className="pm-input"
                    placeholder="If not in list"
                    value={manualSupplierName}
                    onChange={(e) => setManualSupplierName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={addPart}
              className="pm-btn pm-btn-primary"
            >
              Add line
            </button>
          </div>
        )}

        {selectedParts.length > 0 && (
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Item / service</th>
                  <th className="p-2 text-left">Source</th>
                  <th className="p-2 text-left">Supplier</th>
                  <th className="p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedParts.map((part, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2">{lineKindLabel(part.lineKind)}</td>
                    <td className="p-2 font-medium">{part.itemName}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          part.lineKind === "service"
                            ? "bg-blue-100 text-blue-800"
                            : part.source === "in-house"
                              ? "bg-green-100 text-green-800"
                              : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {sourceLabelForReceipt(part.lineKind, part.source)}
                      </span>
                    </td>
                    <td className="p-2">{part.supplierName || "—"}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removePart(index)}
                        className="text-red-600 hover:text-red-800"
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
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-4">Costs & Payment</h3>

        {/* Payment Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-semibold mb-3">Payment Information</h4>
          <div className="space-y-4">
            {/* Payment Made/Not Made Option */}
            <div>
              <label className="pm-label">
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
                  <label className="pm-label">Payment type</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={paymentMode === 'single'}
                        onChange={() => { setPaymentMode('single'); setSplitPayments([]); }}
                        className="mr-2"
                      />
                      Single method (full amount one way)
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={paymentMode === 'split'}
                        onChange={() => setPaymentMode('split')}
                        className="mr-2"
                      />
                      Partial / split (e.g. part M-Pesa + part Bank)
                    </label>
                  </div>
                </div>

                {paymentMode === 'split' ? (
                  <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h5 className="font-medium text-gray-800">Split payments</h5>
                    {splitPayments.length > 0 && (
                      <ul className="space-y-2 mb-3">
                        {splitPayments.map((p, idx) => (
                          <li key={idx} className="flex justify-between items-center bg-white rounded px-3 py-2 border">
                            <span className="text-sm">{p.method.replace(/_/g, ' ')}: KES {p.amount.toLocaleString()} – {p.transactionCode}{p.bank ? ` (${p.bank})` : ''}</span>
                            <button type="button" onClick={() => removeSplitPayment(idx)} className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm text-gray-600">Total from payments: KES {(splitPayments.reduce((s, p) => s + p.amount, 0)).toLocaleString()}{form.totalAgreedAmount ? ` (Agreed: KES ${Number(form.totalAgreedAmount).toLocaleString()})` : ''}</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end flex-wrap">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                        <select
                          className="pm-select text-sm"
                          value={splitPaymentMethod}
                          onChange={(e) => setSplitPaymentMethod(e.target.value as PaymentMethod)}
                        >
                          <option value="cash_to_deposit">Cash to Deposit</option>
                          <option value="mpesa_to_paybill">M-pesa to Paybill</option>
                          <option value="mpesa_to_mpesa_shop">M-pesa to M-pesa Shop</option>
                          <option value="bank_to_mpesa_shop">Bank to M-pesa Shop</option>
                          <option value="bank_to_shop_bank">Bank to Shop Bank</option>
                          <option value="sacco_to_mpesa">Sacco to M-pesa</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount (KES)</label>
                        <input type="number" min="1" step="1" className="pm-input text-sm" value={splitPaymentAmount} onChange={(e) => setSplitPaymentAmount(e.target.value)} placeholder="Amount" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Transaction code</label>
                        <input type="text" className="pm-input text-sm uppercase" value={splitPaymentCode} onChange={(e) => setSplitPaymentCode(e.target.value)} placeholder="Code" />
                      </div>
                      {bankMethods.includes(splitPaymentMethod) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Bank</label>
                          <select className="pm-select text-sm" value={splitPaymentBank || transactionCodes.bank} onChange={(e) => setSplitPaymentBank(e.target.value)}>
                            <option value="">Select</option>
                            <option value="KCB">KCB</option>
                            <option value="Equity">Equity</option>
                            <option value="Cooperative">Cooperative</option>
                            <option value="Absa">Absa</option>
                            <option value="Standard Chartered">Standard Chartered</option>
                          </select>
                        </div>
                      )}
                      <button type="button" onClick={addSplitPayment} className="pm-btn pm-btn-primary pm-btn-sm">Add payment</button>
                    </div>
                  </div>
                ) : (
                  <>
                <div>
                  <label className="pm-label">Payment Method</label>
                  <select
                    className="pm-input"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
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
                    <label className="pm-label">
                      Transaction Code (Required) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="pm-input uppercase"
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
                    <label className="pm-label">
                      MPESA Transaction Code (Required) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="pm-input uppercase"
                      placeholder="Enter MPESA transaction code"
                      value={transactionCodes.mpesa_to_paybill}
                      onChange={(e) => setTransactionCodes({ ...transactionCodes, mpesa_to_paybill: e.target.value.toUpperCase() })}
                    />
                  </div>
                )}

                {/* Mpesa to M-pesa Shop */}
                {paymentMethod === 'mpesa_to_mpesa_shop' && (
                  <div>
                    <label className="pm-label">
                      MPESA Transaction Code (Required) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="pm-input uppercase"
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
                      <label className="pm-label">
                        Bank <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="pm-select w-full mb-2"
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
                          className="pm-input w-full mt-2"
                          placeholder="Enter bank name"
                          value={transactionCodes.customBank}
                          onChange={(e) => setTransactionCodes({ ...transactionCodes, customBank: e.target.value, bank: e.target.value })}
                        />
                      )}
                    </div>
                    <div>
                      <label className="pm-label">
                        Transaction Code (Required) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="pm-input uppercase"
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
                      <label className="pm-label">
                        Bank <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="pm-select w-full mb-2"
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
                          className="pm-input w-full mt-2"
                          placeholder="Enter bank name"
                          value={transactionCodes.customBank}
                          onChange={(e) => setTransactionCodes({ ...transactionCodes, customBank: e.target.value, bank: e.target.value })}
                        />
                      )}
                    </div>
                    <div>
                      <label className="pm-label">
                        Transaction Code (Required) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="pm-input uppercase"
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
                      <label className="pm-label">
                        Sacco <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="pm-input"
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
                      <label className="pm-label">
                        Transaction Code (Required) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="pm-input uppercase"
                        placeholder="Enter transaction code"
                        value={transactionCodes.sacco_to_mpesa}
                        onChange={(e) => setTransactionCodes({ ...transactionCodes, sacco_to_mpesa: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </>
                )}

                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="border-t pt-4 mt-4 bg-gray-50 p-4 rounded">
          <div className="space-y-2">
            <div className="flex justify-between font-bold text-lg">
              <span>Total Agreed Amount:</span>
              <span className="text-green-600">KES {form.totalAgreedAmount ? Number(form.totalAgreedAmount).toLocaleString() : '0'}</span>
            </div>
            {Number(form.depositAmount || 0) > 0 && (
              <>
                <div className="flex justify-between border-t pt-2">
                  <span>Deposit Paid:</span>
                  <span className="font-semibold text-green-600">KES {Number(form.depositAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600 font-semibold">Balance Remaining:</span>
                  <span className="font-bold text-red-600">KES {(Number(form.totalAgreedAmount || 0) - Number(form.depositAmount)).toLocaleString()}</span>
                </div>
              </>
            )}
            {Number(form.depositAmount || 0) === 0 && paymentMade === 'yes' && (
              <>
                <div className="flex justify-between border-t pt-2">
                  <span>Amount Paid:</span>
                  <span className="font-semibold text-green-600">KES {getAmountPaid().toLocaleString()}</span>
                </div>
                {getAmountPaid() < Number(form.totalAgreedAmount || 0) && (
                  <div className="flex justify-between">
                    <span className="text-red-600 font-semibold">Balance Remaining:</span>
                    <span className="font-bold text-red-600">KES {(Number(form.totalAgreedAmount || 0) - getAmountPaid()).toLocaleString()}</span>
                  </div>
                )}
              </>
            )}
            {Number(form.depositAmount || 0) === 0 && paymentMade === 'no' && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-orange-600">Payment Status:</span>
                <span className="font-semibold text-orange-600">Not Paid - Will pay later</span>
              </div>
            )}
            {selectedParts.some((p) => p.lineKind === "service") && (
              <div className="flex justify-between border-t pt-2 gap-2">
                <span className="text-blue-600 shrink-0">Services (no part):</span>
                <span className="font-semibold text-blue-600 text-right">
                  {selectedParts
                    .filter((p) => p.lineKind === "service")
                    .map((p) => p.itemName)
                    .join("; ")}
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleCompleteRepairSale()}
          disabled={isSubmittingRepairSale}
          className="pm-btn pm-btn-primary w-full mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmittingRepairSale
            ? "Saving…"
            : form.depositAmount && Number(form.depositAmount) > 0 
            ? 'Complete Repair Sale & Generate Receipt' 
            : 'Complete Repair Sale & Assign Ticket'}
        </button>
      </div>
    </div>
  );
}
