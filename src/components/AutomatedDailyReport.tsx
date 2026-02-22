import { useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useRepair } from "../context/RepairContext";
import { useInventory } from "../context/InventoryContext";
import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";
import { shareViaWhatsApp } from "../utils/receiptUtils";

export default function AutomatedDailyReport() {
  const { getDailySales, getDailyRevenue } = useSales();
  const { repairs } = useRepair();
  const { items: inventoryItems, purchases } = useInventory();
  const { getTotalCashCollected, getTotalMpesaCollected, getTotalBankDeposits, getPendingCashDeposits } = usePayment();
  const { currentShop } = useShop();

  const dailySales = getDailySales();
  const dailyRevenue = getDailyRevenue();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = (d: Date) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime() === today.getTime();
  };

  const todayRepairs = useMemo(() => repairs.filter(r => isToday(r.date)), [repairs]);

  const todayRepairRevenue = todayRepairs.reduce((sum, r) => sum + (r.totalAgreedAmount || r.totalCost), 0);

  // Calculate actual parts cost from persisted repair data
  const todayPartsCost = useMemo(() => {
    return todayRepairs.reduce((sum, r) => {
      const partsCost = r.partsUsed.reduce((s, p) => s + (p.cost * p.qty), 0);
      return sum + partsCost;
    }, 0);
  }, [todayRepairs]);

  // Calculate accessory cost from inventory data
  const todayAccessoryCost = useMemo(() => {
    let cost = 0;
    dailySales.forEach(sale => {
      sale.items.forEach(item => {
        const inv = inventoryItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
        const costPrice = inv?.adminCostPrice || inv?.costPrice || 0;
        cost += costPrice * item.qty;
      });
    });
    return cost;
  }, [dailySales, inventoryItems]);

  const totalCosts = todayPartsCost + todayAccessoryCost;

  

  const cashCollected = getTotalCashCollected();
  const mpesaCollected = getTotalMpesaCollected();
  const bankDeposits = getTotalBankDeposits();
  const pendingDeposits = getPendingCashDeposits();
  const pendingDepositsAmount = pendingDeposits.reduce((sum, p) => sum + p.amount, 0);

  const getSupplierForItem = (itemName: string, storedSupplier?: string): string => {
    if (storedSupplier) return storedSupplier;
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (inv?.supplier) return inv.supplier;
    for (const p of purchases) {
      if (p.items.some(pi => pi.itemName.toLowerCase() === itemName.toLowerCase())) return p.supplier;
    }
    return 'Own Inventory';
  };

  const generateDailyReport = () => {
    const todayStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const totalRevenue = dailyRevenue + todayRepairRevenue;
    const grossProfit = totalRevenue - totalCosts;

    let report = `*PHONEMART DAILY REPORT*\n`;
    report += `*${currentShop?.name || 'PHONEMART'}*\n`;
    report += `Date: ${todayStr}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    report += `*SUMMARY*\n`;
    report += `Accessory Sales: ${dailySales.length}\n`;
    report += `Repair Sales: ${todayRepairs.length}\n`;
    report += `Total Revenue: KES ${totalRevenue.toLocaleString()}\n`;
    report += `Total Costs: KES ${totalCosts.toLocaleString()}\n`;
    report += `*Total Profit: KES ${grossProfit.toLocaleString()}*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Detailed Repairs
    if (todayRepairs.length > 0) {
      report += `*REPAIR SALES*\n`;
      report += `━━━━━━━━━━━━━━━━━━━━\n`;
      todayRepairs.forEach((r, idx) => {
        const revenue = r.totalAgreedAmount || r.totalCost;
        const partsCost = r.partsUsed.reduce((s, p) => s + (p.cost * p.qty), 0);
        const profit = revenue - partsCost;

        report += `\n${idx + 1}.${r.customerName}-${r.phoneModel}\n`;
        if (r.ticketNumber) report += `Ticket:${r.ticketNumber}\n`;
        report += `Issue: ${r.issue}\n`;
        if (r.serviceType) report += `Service: ${r.serviceType}\n`;
        report += `Revenue:KES ${revenue.toLocaleString()}\n`;
        if (r.partsUsed.length > 0) {
          report += `Parts used:\n`;
          r.partsUsed.forEach(p => {
            const costStr = p.cost > 0 ? `Cost KES ${(p.cost * p.qty).toLocaleString()}` : 'Cost pending';
            const supplier = getSupplierForItem(p.itemName, p.supplierName);
            report += `-${p.itemName} x${p.qty} (${costStr})(${supplier})\n`;
          });
        }
        report += `Total cost: KES ${partsCost.toLocaleString()}\n`;
        report += `*Profit:KES ${profit.toLocaleString()}*\n`;
      });
      report += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Payment breakdown
    report += `*PAYMENTS*\n`;
    report += `Cash: KES ${cashCollected.toLocaleString()}\n`;
    report += `MPESA: KES ${mpesaCollected.toLocaleString()}\n`;
    report += `Bank: KES ${bankDeposits.toLocaleString()}\n`;
    if (pendingDepositsAmount > 0) {
      report += `Pending: KES ${pendingDepositsAmount.toLocaleString()}\n`;
    }
    report += `\n`;

    report += `*End of Report*`;

    return report;
  };

  const handleSendReport = () => {
    const report = generateDailyReport();
    shareViaWhatsApp(report, currentShop?.phone || undefined);
  };

  const handleSendToGroup = () => {
    const report = generateDailyReport();
    const encodedText = encodeURIComponent(report);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const totalRevenue = dailyRevenue + todayRepairRevenue;
  const grossProfit = totalRevenue - totalCosts;

  // Check for outsourced parts missing cost entries
  const repairsWithMissingCosts = useMemo(() => {
    return todayRepairs
      .filter(r => r.status === 'COLLECTED' || r.paymentApproved)
      .map(r => {
        const missingParts = r.partsUsed.filter(p =>
          (p.source === 'outsourced' || p.supplierName) && p.cost === 0
        );
        const missingAdditional = (r.additionalItems || []).filter(item =>
          item.source === 'outsourced' &&
          !r.partsUsed.some(p => p.itemName === item.itemName && p.cost > 0)
        );
        if (missingParts.length === 0 && missingAdditional.length === 0) return null;
        return {
          repair: r,
          missingParts: [...missingParts.map(p => p.itemName), ...missingAdditional.map(a => a.itemName)],
        };
      })
      .filter(Boolean) as Array<{ repair: typeof todayRepairs[0]; missingParts: string[] }>;
  }, [todayRepairs]);

  const hasMissingCosts = repairsWithMissingCosts.length > 0;

  const handleSendWithCheck = (sendFn: () => void) => {
    if (hasMissingCosts) {
      const names = repairsWithMissingCosts.map(r =>
        `- ${r.repair.customerName} (${r.repair.phoneModel}): ${r.missingParts.join(', ')}`
      ).join('\n');
      alert(`Cannot send report. The following repairs have outsourced parts without cost entries:\n\n${names}\n\nPlease fill in the cost of parts first.`);
      return;
    }
    sendFn();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold">End-of-Day Report</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleSendWithCheck(handleSendReport)}
            disabled={hasMissingCosts}
            className={`px-3 py-2 rounded text-sm text-white ${hasMissingCosts ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
          >
            Send to Number
          </button>
          <button
            onClick={() => handleSendWithCheck(handleSendToGroup)}
            disabled={hasMissingCosts}
            className={`px-3 py-2 rounded text-sm text-white ${hasMissingCosts ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-700 hover:bg-green-800'}`}
          >
            Send to Group
          </button>
        </div>
      </div>

      {hasMissingCosts && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
          <p className="text-sm font-semibold text-red-800 mb-1">Cannot send report — outsourced parts cost missing</p>
          <ul className="text-xs text-red-700 space-y-1">
            {repairsWithMissingCosts.map(r => (
              <li key={r.repair.id}>
                <span className="font-medium">{r.repair.customerName}</span> ({r.repair.phoneModel}): {r.missingParts.join(', ')}
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-600 mt-2">Go to <a href="/cost-of-parts" className="underline font-semibold">Cost of Parts</a> to fill in the missing costs.</p>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Accessory Revenue:</span>
          <span className="font-semibold">KES {dailyRevenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Repair Revenue:</span>
          <span className="font-semibold">KES {todayRepairRevenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Cash Collected:</span>
          <span className="font-semibold">KES {cashCollected.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">MPESA Collected:</span>
          <span className="font-semibold">KES {mpesaCollected.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Bank Deposits:</span>
          <span className="font-semibold">KES {bankDeposits.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-red-600">
          <span>Parts & Supplier Costs:</span>
          <span className="font-semibold">KES {totalCosts.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-gray-600 font-semibold">Gross Profit:</span>
          <span className={`font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            KES {grossProfit.toLocaleString()}
          </span>
        </div>
        {pendingDepositsAmount > 0 && (
          <div className="flex justify-between text-orange-600">
            <span>Pending Deposits:</span>
            <span className="font-semibold">KES {pendingDepositsAmount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
