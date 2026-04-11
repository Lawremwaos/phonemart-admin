import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRepair, type Repair } from "../context/RepairContext";
import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";
import { canMarkRepairCollected, repairToReceiptState } from "../utils/repairReceiptHelpers";

export default function Repairs() {
  const navigate = useNavigate();
  const { repairs, updateRepairPayment, confirmCollection } = useRepair();
  const [repairRowAction, setRepairRowAction] = useState<Repair | null>(null);
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

    // Payment workflow states
    if (repair.paymentStatus === 'partial') {
      return { text: 'Awaiting Balance', color: 'bg-amber-100 text-amber-800' };
    }
    if (repair.paymentStatus === 'fully_paid' && !repair.paymentApproved) {
      return { text: 'Awaiting Admin Confirmation', color: 'bg-yellow-100 text-yellow-800' };
    }
    if (repair.paymentStatus === 'pending') {
      return { text: 'Payment Pending', color: 'bg-red-100 text-red-800' };
    }
    if (repair.paymentStatus === 'fully_paid' && repair.paymentApproved) {
      return { text: 'Fully Paid', color: 'bg-green-100 text-green-800' };
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

  const paymentMethodLabel = (repair: Repair): string => {
    const pending = repair.pendingTransactionCodes;
    if (pending?.splitPayments && pending.splitPayments.length > 0) return "Split Payment";
    const method = pending?.paymentMethod;
    if (method === "mpesa_to_paybill") return "M-Pesa to Till ATC";
    if (method === "mpesa_to_mpesa_shop") return "M-Pesa to Shop";
    if (method === "cash_to_deposit") return "Cash Deposit";
    if (method === "bank_to_mpesa_shop") return "Bank to M-Pesa";
    if (method === "bank_to_shop_bank") return "Bank to Shop Bank";
    if (method === "sacco_to_mpesa") return "Sacco to M-Pesa";
    if (repair.paymentMade) return "Paid";
    return "-";
  };

  const supplierLabel = (repair: Repair): string => {
    const names = new Set<string>();
    repair.partsUsed.forEach((part) => {
      if (part.supplierName?.trim()) names.add(part.supplierName.trim());
    });
    repair.additionalItems?.forEach((item) => {
      if (item.supplierName?.trim()) names.add(item.supplierName.trim());
    });
    if (names.size === 0) return "-";
    return Array.from(names).join(", ");
  };

  const goToPaymentFlow = (repair: Repair) => {
    // If customer already paid and admin only needs to approve, jump to approval screen.
    if (repair.paymentStatus === "fully_paid" && !repair.paymentApproved) {
      navigate(`/pending-payment-approval?repairId=${encodeURIComponent(repair.id)}`);
      return;
    }
    // Otherwise jump to pending payment flow and focus this repair.
    navigate(`/pending-collections/pending-payment?repairId=${encodeURIComponent(repair.id)}`);
  };

  return (
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Repairs</p>
          <h2 className="pm-page-title">Repairs Management</h2>
          <p className="pm-page-desc">Track repair status, payments, and collection confirmation.</p>
        </div>
        <div className="flex gap-3 items-center">
          {isAdmin && (
            <select
              value={selectedShopFilter}
              onChange={(e) => setSelectedShopFilter(e.target.value)}
              className="pm-input"
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
            className="pm-btn pm-btn-primary"
          >
            + New Repair
          </button>
        </div>
      </div>

      {/* Shop Summary (Admin Only) */}
      {isAdmin && selectedShopFilter === 'all' && Object.keys(repairsByShop).length > 0 && (
        <div className="pm-card pm-pad">
          <h3 className="text-lg font-semibold mb-3">Repairs by Shop</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(repairsByShop).map(([shopId, shopRepairs]) => (
              <div key={shopId} className="rounded-lg border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-3">
                <div className="font-semibold text-[var(--pm-accent-strong)]">{getShopName(shopId)}</div>
                <div className="mt-1 text-sm text-[var(--pm-ink-soft)]">{shopRepairs.length} repair{shopRepairs.length !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repairs Table */}
      <div className="pm-table-shell">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              {isAdmin && <th className="p-3 text-left">Shop</th>}
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Model</th>
              <th className="p-3 text-left">Issue</th>
              <th className="p-3 text-left">Supplier</th>
              <th className="p-3 text-left">Technician</th>
              <th className="p-3 text-right">Total Cost</th>
              <th className="p-3 text-left">Payment Done By</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3 text-center">Status</th>
              {isAdmin && <th className="p-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRepairs.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 14 : 12} className="p-4 text-center text-[var(--pm-ink-soft)]">
                  No repairs found
                </td>
              </tr>
            ) : (
              filteredRepairs.map((repair) => (
                <tr
                  key={repair.id}
                  className={`border-t border-[var(--pm-border)] hover:bg-[var(--pm-surface-soft)] ${isAdmin ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (isAdmin) setRepairRowAction(repair);
                  }}
                >
                  {isAdmin && (
                    <td className="p-3">
                      <span className="rounded bg-[var(--pm-accent-soft)] px-2 py-1 text-xs font-medium text-[var(--pm-accent-strong)]">
                        {getShopName(repair.shopId)}
                      </span>
                    </td>
                  )}
                  <td className="p-3 text-sm text-[var(--pm-ink-soft)]">{formatDate(repair.date)}</td>
                  <td className="p-3">{repair.customerName}</td>
                  <td className="p-3">{repair.phoneNumber}</td>
                  <td className="p-3">{repair.phoneModel}</td>
                  <td className="p-3 text-sm">{repair.issue}</td>
                  <td className="p-3 text-sm">{supplierLabel(repair)}</td>
                  <td className="p-3">{repair.technician}</td>
                  <td className="p-3 text-right">KES {(repair.totalAgreedAmount || repair.totalCost).toLocaleString()}</td>
                  <td className="p-3 text-sm">{paymentMethodLabel(repair)}</td>
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
                  {isAdmin && (
                    <td className="p-3 text-center">
                      {repair.balance > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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
                          className="pm-btn pm-btn-secondary pm-btn-sm"
                        >
                          Add Payment
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToPaymentFlow(repair);
                        }}
                        className="pm-btn pm-btn-primary pm-btn-sm ml-2"
                      >
                        Confirm Payment
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && repairRowAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRepairRowAction(null)}
          role="presentation"
        >
          <div
            className="pm-modal-panel max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="repair-action-title"
          >
            <h3 id="repair-action-title" className="text-lg font-bold text-[var(--pm-ink)]">
              Repair: {repairRowAction.customerName}
            </h3>
            <p className="mt-1 text-sm text-[var(--pm-ink-soft)]">
              {repairRowAction.phoneModel} · KES {(repairRowAction.totalAgreedAmount || repairRowAction.totalCost).toLocaleString()}
            </p>
            <p className="mt-4 text-sm text-[var(--pm-ink-soft)]">What do you want to do?</p>
            <div className="flex flex-col gap-3 mt-4">
              <button
                type="button"
                disabled={!canMarkRepairCollected(repairRowAction)}
                title={
                  !canMarkRepairCollected(repairRowAction)
                    ? "Requires full payment, admin approval, and zero balance"
                    : undefined
                }
                className="pm-btn pm-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (!canMarkRepairCollected(repairRowAction)) return;
                  if (
                    !window.confirm(
                      `Confirm that ${repairRowAction.customerName} has collected their phone? This completes the repair sale and opens the receipt.`
                    )
                  ) {
                    return;
                  }
                  confirmCollection(repairRowAction.id);
                  navigate("/receipt", { state: { sale: repairToReceiptState(repairRowAction) } });
                  setRepairRowAction(null);
                }}
              >
                Collection — customer collected phone
              </button>
              <button
                type="button"
                className="pm-btn pm-btn-secondary w-full"
                onClick={() => {
                  setRepairRowAction(null);
                  navigate("/pending-collections");
                }}
              >
                Confirmation — payment / approvals (Pending Collections)
              </button>
              <button
                type="button"
                className="pm-btn pm-btn-primary w-full"
                onClick={() => {
                  setRepairRowAction(null);
                  goToPaymentFlow(repairRowAction);
                }}
              >
                Confirm Payment
              </button>
              <button
                type="button"
                className="pm-btn pm-btn-secondary w-full"
                onClick={() => setRepairRowAction(null)}
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
