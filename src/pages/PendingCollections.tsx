import { useState, useMemo } from "react";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";
import { usePayment } from "../context/PaymentContext";

type FilterType = 'all' | 'pending_collection' | 'pending_payment' | 'fully_paid';

export default function PendingCollections() {
  const { repairs, confirmPayment } = useRepair();
  const { shops, currentUser } = useShop();
  const { addPayment } = usePayment();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<typeof repairs[0] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash_to_mpesa' | 'mpesa_to_paybill' | 'bank_to_paybill' | 'split_payment'>('mpesa_to_paybill');
  const [transactionCodes, setTransactionCodes] = useState({
    cash_to_mpesa: "",
    mpesa_to_paybill: "",
    bank_to_paybill: "",
    bank: "",
  });

  // Filter repairs based on customer status and payment
  const filteredRepairs = useMemo(() => {
    let filtered = repairs;

    // Filter by shop if not admin
    if (!currentUser?.roles.includes('admin') && currentUser?.shopId) {
      filtered = filtered.filter(repair => repair.shopId === currentUser.shopId);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(repair =>
        repair.customerName.toLowerCase().includes(term) ||
        repair.phoneNumber.includes(term) ||
        repair.phoneModel.toLowerCase().includes(term) ||
        repair.imei.includes(term)
      );
    }

    // Filter by status
    switch (filter) {
      case 'pending_collection':
        filtered = filtered.filter(repair =>
          (repair.customerStatus === 'coming_back' || (repair.depositAmount && repair.depositAmount > 0)) &&
          repair.paymentStatus === 'fully_paid'
        );
        break;
      case 'pending_payment':
        filtered = filtered.filter(repair =>
          repair.paymentStatus === 'pending' || repair.paymentStatus === 'partial'
        );
        break;
      case 'fully_paid':
        filtered = filtered.filter(repair => repair.paymentStatus === 'fully_paid');
        break;
      default:
        // Show all repairs where customer has left phone
        filtered = filtered.filter(repair =>
          repair.customerStatus === 'coming_back' || (repair.depositAmount && repair.depositAmount > 0)
        );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [repairs, filter, searchTerm, currentUser]);

  const getShopName = (shopId?: string) => {
    if (!shopId) return 'N/A';
    return shops.find(s => s.id === shopId)?.name || shopId;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (repair: typeof repairs[0]) => {
    if (repair.paymentStatus === 'fully_paid' && (repair.customerStatus === 'coming_back' || repair.depositAmount > 0)) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Ready for Collection</span>;
    }
    if (repair.paymentStatus === 'partial') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Partial Payment</span>;
    }
    if (repair.paymentStatus === 'pending') {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Pending Payment</span>;
    }
    return null;
  };

  const stats = useMemo(() => {
    const allPending = repairs.filter(r => r.customerStatus === 'coming_back' || (r.depositAmount && r.depositAmount > 0));
    return {
      total: allPending.length,
      pendingCollection: allPending.filter(r => r.paymentStatus === 'fully_paid').length,
      pendingPayment: allPending.filter(r => r.paymentStatus === 'pending' || r.paymentStatus === 'partial').length,
      totalPendingAmount: allPending
        .filter(r => r.paymentStatus === 'pending' || r.paymentStatus === 'partial')
        .reduce((sum, r) => sum + r.balance, 0),
    };
  }, [repairs]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Pending Collections & Payments</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Pending</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Ready for Collection</p>
          <p className="text-2xl font-bold text-green-600">{stats.pendingCollection}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Pending Payment</p>
          <p className="text-2xl font-bold text-red-600">{stats.pendingPayment}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Pending Amount</p>
          <p className="text-2xl font-bold text-orange-600">KES {stats.totalPendingAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
            >
              <option value="all">All Pending</option>
              <option value="pending_collection">Ready for Collection</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="fully_paid">Fully Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              placeholder="Search by customer name, phone, model, or IMEI"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Repairs Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        {filteredRepairs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No pending collections or payments found.</p>
          </div>
        ) : (
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
                    Phone Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                {filteredRepairs.map((repair) => (
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
                      <div className="text-sm text-gray-500">IMEI: {repair.imei}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {repair.issue}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(repair)}
                    </td>
                    {currentUser?.roles.includes('admin') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getShopName(repair.shopId)}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {repair.paymentStatus !== 'fully_paid' && (
                        <button
                          onClick={() => {
                            setSelectedRepair(repair);
                            setShowPaymentModal(true);
                            // Pre-fill payment method if stored
                            if ((repair as any).pendingTransactionCodes) {
                              setPaymentMethod((repair as any).pendingTransactionCodes.paymentMethod);
                            }
                          }}
                          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                        >
                          Confirm Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Confirmation Modal */}
      {showPaymentModal && selectedRepair && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Confirm Payment</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Customer: <strong>{selectedRepair.customerName}</strong></p>
              <p className="text-sm text-gray-600">Phone: <strong>{selectedRepair.phoneNumber}</strong></p>
              <p className="text-sm text-gray-600">Total Amount: <strong>KES {(selectedRepair.totalAgreedAmount || selectedRepair.totalCost).toLocaleString()}</strong></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  className="border border-gray-300 rounded-md px-3 py-2 w-full"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="cash_to_mpesa">Cash to Mpesa Deposit</option>
                  <option value="mpesa_to_paybill">Mpesa to Paybill</option>
                  <option value="bank_to_paybill">Bank to Paybill</option>
                </select>
              </div>

              {paymentMethod === 'cash_to_mpesa' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"
                    placeholder="Enter MPESA transaction code"
                    value={transactionCodes.cash_to_mpesa}
                    onChange={(e) => setTransactionCodes({ ...transactionCodes, cash_to_mpesa: e.target.value.toUpperCase() })}
                  />
                </div>
              )}

              {paymentMethod === 'mpesa_to_paybill' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MPESA Transaction Code <span className="text-red-500">*</span>
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

              {paymentMethod === 'bank_to_paybill' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank</label>
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
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction Code <span className="text-red-500">*</span>
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
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  // Validate transaction code
                  let code = '';
                  if (paymentMethod === 'cash_to_mpesa') {
                    code = transactionCodes.cash_to_mpesa;
                  } else if (paymentMethod === 'mpesa_to_paybill') {
                    code = transactionCodes.mpesa_to_paybill;
                  } else if (paymentMethod === 'bank_to_paybill') {
                    code = transactionCodes.bank_to_paybill;
                    if (!transactionCodes.bank) {
                      alert("Please select a bank");
                      return;
                    }
                  }

                  if (!code) {
                    alert("Please enter transaction code");
                    return;
                  }

                  // Confirm payment
                  const totalAmount = selectedRepair.totalAgreedAmount || selectedRepair.totalCost;
                  confirmPayment(selectedRepair.id, transactionCodes, paymentMethod);

                  // Add payment record
                  addPayment({
                    type: paymentMethod === 'cash_to_mpesa' ? 'cash' : paymentMethod === 'mpesa_to_paybill' ? 'mpesa' : 'bank_deposit',
                    amount: totalAmount,
                    state: 'fully_paid',
                    bank: paymentMethod === 'bank_to_paybill' ? transactionCodes.bank as any : undefined,
                    depositReference: code,
                    shopId: selectedRepair.shopId,
                    relatedTo: 'repair',
                    relatedId: selectedRepair.id,
                    deposited: paymentMethod === 'cash_to_mpesa' ? true : paymentMethod !== 'bank_to_paybill',
                  });

                  // Close modal and reset
                  setShowPaymentModal(false);
                  setSelectedRepair(null);
                  setTransactionCodes({ cash_to_mpesa: "", mpesa_to_paybill: "", bank_to_paybill: "", bank: "" });
                  alert("Payment confirmed! Phone can now be released.");
                }}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex-1"
              >
                Confirm & Release Phone
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedRepair(null);
                  setTransactionCodes({ cash_to_mpesa: "", mpesa_to_paybill: "", bank_to_paybill: "", bank: "" });
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
