import { useState } from "react";
import { useRepair } from "../context/RepairContext";
import type { RepairStatus } from "../context/RepairContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { usePayment } from "../context/PaymentContext";

const REPAIR_STATUSES: RepairStatus[] = [
  'RECEIVED',
  'IN_PROGRESS',
  'WAITING_PARTS',
  'REPAIR_COMPLETED',
  'PAYMENT_PENDING',
  'FULLY_PAID',
  'COLLECTED',
];

export default function Repairs() {
  const { repairs, addRepair, updateRepairStatus, updateRepairPayment } = useRepair();
  const { items } = useInventory();
  const { currentShop } = useShop();
  const { addPayment } = usePayment();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    phoneNumber: "",
    imei: "",
    phoneModel: "",
    issue: "",
    technician: "",
    outsourcedCost: "",
    laborCost: "",
  });

  const [selectedParts, setSelectedParts] = useState<Array<{
    itemId: number;
    itemName: string;
    qty: number;
    cost: number;
  }>>([]);

  const [selectedPartId, setSelectedPartId] = useState("");
  const [partQty, setPartQty] = useState(1);

  function addPart() {
    if (!selectedPartId || partQty <= 0) return;
    
    const item = items.find(i => i.id === Number(selectedPartId));
    if (!item) return;

    const existingPart = selectedParts.find(p => p.itemId === item.id);
    if (existingPart) {
      setSelectedParts(prev =>
        prev.map(p =>
          p.itemId === item.id
            ? { ...p, qty: p.qty + partQty }
            : p
        )
      );
    } else {
      setSelectedParts(prev => [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          qty: partQty,
          cost: item.costPrice || item.price,
        },
      ]);
    }

    setSelectedPartId("");
    setPartQty(1);
  }

  function removePart(index: number) {
    setSelectedParts(prev => prev.filter((_, i) => i !== index));
  }

  async function handleAddRepair() {
    if (!form.customerName || !form.phoneNumber || !form.issue || !form.technician) {
      alert("Please fill in all required fields");
      return;
    }

    const result = await addRepair({
      customerName: form.customerName,
      phoneNumber: form.phoneNumber,
      imei: form.imei,
      phoneModel: form.phoneModel,
      issue: form.issue,
      technician: form.technician,
      partsUsed: selectedParts,
      outsourcedCost: Number(form.outsourcedCost || 0),
      laborCost: Number(form.laborCost || 0),
      status: 'RECEIVED',
      shopId: currentShop?.id,
      paymentStatus: 'pending',
      amountPaid: 0,
      balance: 0,
    });

    if (!result) {
      alert("Failed to add repair. Please try again.");
      return;
    }

    // Reset form
    setForm({
      customerName: "",
      phoneNumber: "",
      imei: "",
      phoneModel: "",
      issue: "",
      technician: "",
      outsourcedCost: "",
      laborCost: "",
    });
    setSelectedParts([]);
    setShowForm(false);
  }

  function handleStatusChange(repairId: string, newStatus: RepairStatus) {
    updateRepairStatus(repairId, newStatus);
  }

  function handlePayment(repairId: string, amount: number, paymentType: 'cash' | 'mpesa' | 'bank_deposit', bank?: string, depositRef?: string) {
    const repair = repairs.find(r => r.id === repairId);
    if (!repair) return;

    updateRepairPayment(repairId, amount);
    
    // Add payment record
    addPayment({
      type: paymentType,
      amount,
      state: repair.balance - amount <= 0 ? 'fully_paid' : 'partial',
      bank: bank as any,
      depositReference: depositRef,
      shopId: repair.shopId,
      relatedTo: 'repair',
      relatedId: repairId,
      deposited: paymentType === 'cash' ? false : true,
    });
  }

  const getStatusColor = (status: RepairStatus) => {
    const colors: Record<RepairStatus, string> = {
      RECEIVED: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      WAITING_PARTS: 'bg-orange-100 text-orange-800',
      REPAIR_COMPLETED: 'bg-purple-100 text-purple-800',
      PAYMENT_PENDING: 'bg-red-100 text-red-800',
      FULLY_PAID: 'bg-green-100 text-green-800',
      COLLECTED: 'bg-gray-100 text-gray-800',
    };
    return colors[status];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Repairs Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "+ New Repair"}
        </button>
      </div>

      {/* Add Repair Form */}
      {showForm && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">New Repair Intake</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              className="border p-2 rounded"
              placeholder="Customer Name *"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="Phone Number *"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="IMEI"
              value={form.imei}
              onChange={(e) => setForm({ ...form, imei: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="Phone Model *"
              value={form.phoneModel}
              onChange={(e) => setForm({ ...form, phoneModel: e.target.value })}
            />
            <input
              className="border p-2 rounded col-span-2"
              placeholder="Issue / Problem *"
              value={form.issue}
              onChange={(e) => setForm({ ...form, issue: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="Technician *"
              value={form.technician}
              onChange={(e) => setForm({ ...form, technician: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              type="number"
              placeholder="Outsourced Cost (KES)"
              value={form.outsourcedCost}
              onChange={(e) => setForm({ ...form, outsourcedCost: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              type="number"
              placeholder="Labor Cost (KES)"
              value={form.laborCost}
              onChange={(e) => setForm({ ...form, laborCost: e.target.value })}
            />
          </div>

          {/* Parts Selection */}
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <h4 className="font-semibold mb-2">Parts Used</h4>
            <div className="flex gap-2 mb-2">
              <select
                className="border p-2 rounded flex-1"
                value={selectedPartId}
                onChange={(e) => setSelectedPartId(e.target.value)}
              >
                <option value="">Select Part</option>
                {items
                  .filter(item => item.category === 'Spare' || item.category === 'Accessory')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (KES {item.costPrice || item.price})
                    </option>
                  ))}
              </select>
              <input
                className="border p-2 rounded w-20"
                type="number"
                min="1"
                placeholder="Qty"
                value={partQty}
                onChange={(e) => setPartQty(Number(e.target.value))}
              />
              <button
                onClick={addPart}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Add Part
              </button>
            </div>
            {selectedParts.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedParts.map((part, index) => (
                  <div key={index} className="flex justify-between items-center bg-white p-2 rounded">
                    <span>{part.itemName} x{part.qty} = KES {part.cost * part.qty}</span>
                    <button
                      onClick={() => removePart(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleAddRepair}
            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Add Repair
          </button>
        </div>
      )}

      {/* Repairs Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Model</th>
              <th className="p-3 text-left">Issue</th>
              <th className="p-3 text-left">Technician</th>
              <th className="p-3 text-right">Total Cost</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {repairs.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-center text-gray-500">
                  No repairs added
                </td>
              </tr>
            ) : (
              repairs.map((repair) => (
                <tr key={repair.id} className="border-t">
                  <td className="p-3">{repair.customerName}</td>
                  <td className="p-3">{repair.phoneNumber}</td>
                  <td className="p-3">{repair.phoneModel}</td>
                  <td className="p-3 text-sm">{repair.issue}</td>
                  <td className="p-3">{repair.technician}</td>
                  <td className="p-3 text-right">KES {repair.totalCost.toLocaleString()}</td>
                  <td className="p-3 text-right text-green-600">KES {repair.amountPaid.toLocaleString()}</td>
                  <td className="p-3 text-right text-red-600">KES {repair.balance.toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <select
                      value={repair.status}
                      onChange={(e) => handleStatusChange(repair.id, e.target.value as RepairStatus)}
                      className={`border rounded px-2 py-1 text-sm ${getStatusColor(repair.status)}`}
                    >
                      {REPAIR_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    {repair.balance > 0 && (
                      <button
                        onClick={() => {
                          const amount = prompt(`Enter payment amount (Balance: KES ${repair.balance}):`);
                          if (amount) {
                            const paymentType = prompt("Payment type (cash/mpesa/bank_deposit):") as 'cash' | 'mpesa' | 'bank_deposit';
                            let bank: string | undefined, depositRef: string | undefined;
                            if (paymentType === 'bank_deposit') {
                              bank = prompt("Bank name:") || undefined;
                              depositRef = prompt("Deposit reference:") || undefined;
                            }
                            handlePayment(repair.id, Number(amount), paymentType, bank, depositRef);
                          }
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Add Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
