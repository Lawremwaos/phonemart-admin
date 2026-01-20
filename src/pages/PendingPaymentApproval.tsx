import { useMemo } from "react";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";
import { usePayment } from "../context/PaymentContext";

export default function PendingPaymentApproval() {
  const { repairs, approvePayment } = useRepair();
  const { currentUser, shops } = useShop();
  const { addPayment } = usePayment();

  // ADMIN ONLY - Redirect non-admins
  if (!currentUser || !currentUser.roles.includes('admin')) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p>Only administrators can approve payments. Staff should use "Pending Collections" to confirm phone pickup.</p>
        </div>
      </div>
    );
  }

  // Filter repairs that need payment approval (admin sees all shops)
  const pendingApprovals = useMemo(() => {
    return repairs.filter(repair => {
      const hasPayment = repair.paymentMade || repair.amountPaid > 0;
      return hasPayment && !repair.paymentApproved && repair.amountPaid > 0;
    });
  }, [repairs]);

  const getShopName = (shopId?: string) => {
    if (!shopId) return 'Unknown';
    const shop = shops.find(s => s.id === shopId);
    return shop?.name || 'Unknown';
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleApprovePayment = (repair: typeof repairs[0]) => {
    if (!window.confirm(`Approve payment of KES ${repair.amountPaid.toLocaleString()} for ${repair.customerName}?`)) {
      return;
    }

    // Approve the payment
    approvePayment(repair.id);

    // Record the payment
    if (repair.pendingTransactionCodes) {
      const { paymentMethod, transactionCodes } = repair.pendingTransactionCodes;
      let paymentType: 'cash' | 'mpesa' | 'bank_deposit' = 'cash';
      let depositReference = '';
      let bank: any = undefined;

      if (paymentMethod === 'cash_to_deposit') {
        paymentType = 'cash';
        depositReference = transactionCodes.cash_to_deposit || '';
      } else if (paymentMethod === 'mpesa_to_paybill' || paymentMethod === 'mpesa_to_mpesa_shop') {
        paymentType = 'mpesa';
        depositReference = transactionCodes.mpesa_to_paybill || transactionCodes.mpesa_to_mpesa_shop || '';
      } else if (paymentMethod === 'bank_to_mpesa_shop' || paymentMethod === 'bank_to_shop_bank' || paymentMethod === 'sacco_to_mpesa') {
        paymentType = 'bank_deposit';
        depositReference = transactionCodes.bank_to_mpesa_shop || transactionCodes.bank_to_shop_bank || transactionCodes.sacco_to_mpesa || '';
        bank = transactionCodes.bank;
      }

      addPayment({
        type: paymentType,
        amount: repair.amountPaid,
        state: repair.balance <= 0 ? 'fully_paid' : 'partial',
        bank: bank,
        depositReference: depositReference,
        shopId: repair.shopId,
        relatedTo: 'repair',
        relatedId: repair.id,
        deposited: paymentType !== 'cash',
      });
    }

    alert('Payment approved successfully!');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Pending Payment Approval</h2>
      <p className="text-gray-600">Approve payments that have been made by customers</p>

      {pendingApprovals.length === 0 ? (
        <div className="bg-white p-8 rounded shadow text-center">
          <p className="text-gray-500">No pending payment approvals</p>
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount Paid
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  {currentUser?.roles.includes('admin') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shop
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingApprovals.map((repair) => (
                  <tr key={repair.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(repair.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{repair.customerName}</div>
                      <div className="text-sm text-gray-500">{repair.phoneNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{repair.phoneModel}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      KES {(repair.totalAgreedAmount || repair.totalCost).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      KES {repair.amountPaid.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                      KES {repair.balance.toLocaleString()}
                    </td>
                    {currentUser?.roles.includes('admin') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getShopName(repair.shopId)}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleApprovePayment(repair)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        Approve Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
