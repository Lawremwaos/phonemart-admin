import { useNavigate } from "react-router-dom";
import { useRepair } from "../context/RepairContext";
import { usePayment } from "../context/PaymentContext";

export default function Repairs() {
  const navigate = useNavigate();
  const { repairs, updateRepairPayment } = useRepair();
  const { addPayment } = usePayment();

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

  // Calculate automatic status based on repair state
  const getAutomaticStatus = (repair: typeof repairs[0]) => {
    // Check if phone was collected
    if (repair.customerStatus === 'coming_back' || repair.status === 'COLLECTED') {
      return { text: 'Collected', color: 'bg-gray-100 text-gray-800' };
    }
    
    // Check if waiting for parts
    if (repair.status === 'WAITING_PARTS') {
      return { text: 'Waiting Parts', color: 'bg-orange-100 text-orange-800' };
    }
    
    // Check if payment is pending
    if (repair.paymentStatus === 'pending' || repair.paymentStatus === 'partial') {
      return { text: 'Payment Pending', color: 'bg-red-100 text-red-800' };
    }
    
    // Default status
    return { text: repair.status.replace('_', ' '), color: 'bg-blue-100 text-blue-800' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Repairs Management</h2>
        <button
          onClick={() => navigate('/repair-sales')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + New Repair
        </button>
      </div>

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
                    {(() => {
                      const autoStatus = getAutomaticStatus(repair);
                      return (
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${autoStatus.color}`}>
                          {autoStatus.text}
                        </span>
                      );
                    })()}
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
