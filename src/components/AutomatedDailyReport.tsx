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

  const repairsCompleted = todayRepairs.filter(r =>
    r.status === 'REPAIR_COMPLETED' || r.status === 'FULLY_PAID' || r.status === 'COLLECTED'
  ).length;
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

  // Supplier costs breakdown from today's repairs
  const supplierCostsBreakdown = useMemo(() => {
    const map: Record<string, { name: string; items: Array<{ item: string; qty: number; cost: number }>; total: number }> = {};

    const getSupplier = (itemName: string): string => {
      const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
      if (inv?.supplier) return inv.supplier;
      for (const p of purchases) {
        if (p.items.some(pi => pi.itemName.toLowerCase() === itemName.toLowerCase())) return p.supplier;
      }
      return 'Unknown';
    };

    todayRepairs.forEach(r => {
      r.partsUsed.filter(p => p.cost > 0).forEach(part => {
        const supplier = getSupplier(part.itemName);
        if (!map[supplier]) map[supplier] = { name: supplier, items: [], total: 0 };
        map[supplier].items.push({ item: part.itemName, qty: part.qty, cost: part.cost * part.qty });
        map[supplier].total += part.cost * part.qty;
      });
    });

    return map;
  }, [todayRepairs, inventoryItems, purchases]);

  const cashCollected = getTotalCashCollected();
  const mpesaCollected = getTotalMpesaCollected();
  const bankDeposits = getTotalBankDeposits();
  const pendingDeposits = getPendingCashDeposits();
  const pendingDepositsAmount = pendingDeposits.reduce((sum, p) => sum + p.amount, 0);

  const generateDailyReport = () => {
    const todayStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    let report = `*PHONEMART DAILY REPORT*\n`;
    report += `*${currentShop?.name || 'PHONEMART'}*\n`;
    report += `Date: ${todayStr}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    report += `*SALES TODAY*\n`;
    report += `Accessory Revenue: KES ${dailyRevenue.toLocaleString()}\n`;
    report += `Accessory Cost: KES ${todayAccessoryCost.toLocaleString()}\n`;
    report += `Transactions: ${dailySales.length}\n\n`;

    report += `*PAYMENT BREAKDOWN*\n`;
    report += `Cash: KES ${cashCollected.toLocaleString()}\n`;
    report += `MPESA: KES ${mpesaCollected.toLocaleString()}\n`;
    report += `Bank: KES ${bankDeposits.toLocaleString()}\n`;
    if (pendingDepositsAmount > 0) {
      report += `Pending Deposits: KES ${pendingDepositsAmount.toLocaleString()}\n`;
    }
    report += `\n`;

    report += `*REPAIRS TODAY*\n`;
    report += `Repairs Completed: ${repairsCompleted}\n`;
    report += `Repair Revenue: KES ${todayRepairRevenue.toLocaleString()}\n`;
    report += `Parts/Outsourcing Cost: KES ${todayPartsCost.toLocaleString()}\n\n`;

    if (Object.keys(supplierCostsBreakdown).length > 0) {
      report += `*SUPPLIER COSTS*\n`;
      Object.values(supplierCostsBreakdown).forEach(supplier => {
        report += `${supplier.name}:\n`;
        supplier.items.forEach(item => {
          report += `  - ${item.item} (x${item.qty}): KES ${item.cost.toLocaleString()}\n`;
        });
        report += `  Total: KES ${supplier.total.toLocaleString()}\n`;
      });
      report += `\n`;
    }

    const totalRevenue = dailyRevenue + todayRepairRevenue;
    const grossProfit = totalRevenue - totalCosts;
    report += `*SUMMARY*\n`;
    report += `Total Revenue: KES ${totalRevenue.toLocaleString()}\n`;
    report += `Total Costs: KES ${totalCosts.toLocaleString()}\n`;
    report += `*Gross Profit: KES ${grossProfit.toLocaleString()}*\n\n`;

    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    report += `Generated: ${new Date().toLocaleString()}`;

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

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold">End-of-Day Report</h3>
        <div className="flex gap-2">
          <button onClick={handleSendReport} className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">
            Send to Number
          </button>
          <button onClick={handleSendToGroup} className="bg-green-700 text-white px-3 py-2 rounded hover:bg-green-800 text-sm">
            Send to Group
          </button>
        </div>
      </div>

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
