import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRepair } from "../context/RepairContext";
import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";

export default function Repairs() {
  const navigate = useNavigate();
  const { repairs, updateRepairPayment } = useRepair();
  const { addPayment } = usePayment();
  const { currentUser, shops } = useShop();
  const isAdmin = currentUser?.roles.includes('admin') ?? false;
  const [selectedShopFilter, setSelectedShopFilter] = useState<string>('all');

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

  // Filter repairs by shop (for admin)
  const filteredRepairs = useMemo(() => {
    let filtered = repairs;
    if (isAdmin && selectedShopFilter !== 'all') {
      filtered = repairs.filter(r => r.shopId === selectedShopFilter);
    } else if (!isAdmin) {
      // Staff only see their shop's repairs
      const currentShopId = currentUser?.shopId;
      filtered = repairs.filter(r => r.shopId === currentShopId);
    }
    return filtered;
  }, [repairs, isAdmin, selectedShopFilter, currentUser?.shopId]);

  // Group repairs by shop (for admin view)
  const repairsByShop = useMemo(() => {
    if (!isAdmin) return {};
    const grouped: Record<string, typeof repairs> = {};
    repairs.forEach(repair => {
      const shopId = repair.shopId || 'unassigned';
      if (!grouped[shopId]) grouped[shopId] = [];
      grouped[shopId].push(repair);
    });
    return grouped;
  }, [repairs, isAdmin]);

  // Get shop name by ID
  const getShopName = (shopId?: string): string => {
    if (!shopId) return 'Unassigned';
    const shop = shops.find(s => s.id === shopId);
    return shop?.name || shopId;
  };

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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Repairs Management</h2>
        <div className="flex gap-3 items-center">
          {isAdmin && (
            <select
              value={selectedShopFilter}
              onChange={(e) => setSelectedShopFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white"
            >
              <option value="all">All Shops</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          )}
          <button
            onClick={() => navigate('/repair-sales')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + New Repair
          </button>
        </div>
      </div>

      {/* Shop Summary (Admin Only) */}
      {isAdmin && selectedShopFilter === 'all' && Object.keys(repairsByShop).length > 0 && (
        <div className="bg-white rounded shadow p-4">
          <h3 className="text-lg font-semibold mb-3">Repairs by Shop</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(repairsByShop).map(([shopId, shopRepairs]) => (
              <div key={shopId} className="border rounded p-3">
                <div className="font-semibold text-blue-700">{getShopName(shopId)}</div>
                <div className="text-sm text-gray-600 mt-1">{shopRepairs.length} repair{shopRepairs.length !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repairs Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              {isAdmin && <th className="p-3 text-left">Shop</th>}
              <th className="p-3 text-left">Date</th>
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
            {filteredRepairs.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 12 : 11} className="p-4 text-center text-gray-500">
                  No repairs found
                </td>
              </tr>
            ) : (
              filteredRepairs.map((repair) => (
                <tr key={repair.id} className="border-t hover:bg-gray-50">
                  {isAdmin && (
                    <td className="p-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                        {getShopName(repair.shopId)}
                      </span>
                    </td>
                  )}
                  <td className="p-3 text-sm text-gray-600">{formatDate(repair.date)}</td>
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
