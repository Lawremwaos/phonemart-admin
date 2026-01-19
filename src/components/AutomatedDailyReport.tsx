import { useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useRepair } from "../context/RepairContext";
import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";
import { useSupplierDebt } from "../context/SupplierDebtContext";
import { shareViaWhatsApp } from "../utils/receiptUtils";

export default function AutomatedDailyReport() {
  const { getDailySales, getDailyRevenue } = useSales();
  const { repairs } = useRepair();
  const { getTotalCashCollected, getTotalMpesaCollected, getTotalBankDeposits, getPendingCashDeposits } = usePayment();
  const { currentShop } = useShop();
  const { debts } = useSupplierDebt();

  // Get today's data
  const dailySales = getDailySales();
  const dailyRevenue = getDailyRevenue();
  
  const todayRepairs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return repairs.filter(repair => {
      const repairDate = new Date(repair.date);
      repairDate.setHours(0, 0, 0, 0);
      return repairDate.getTime() === today.getTime();
    });
  }, [repairs]);

  const repairsCompleted = todayRepairs.filter(r => r.status === 'REPAIR_COMPLETED' || r.status === 'FULLY_PAID' || r.status === 'COLLECTED').length;
  const todayRepairRevenue = todayRepairs.reduce((sum, r) => sum + r.amountPaid, 0);
  const todayOutsourcedCosts = todayRepairs.reduce((sum, r) => sum + r.outsourcedCost, 0);

  // Get today's supplier debts
  const todaySupplierDebts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return debts.filter(debt => {
      const debtDate = new Date(debt.date);
      debtDate.setHours(0, 0, 0, 0);
      return debtDate.getTime() === today.getTime();
    });
  }, [debts]);

  // Group supplier costs by supplier
  const supplierCostsBreakdown = useMemo(() => {
    const breakdown: Record<string, { name: string; items: Array<{ item: string; qty: number; cost: number }>; total: number }> = {};
    todaySupplierDebts.forEach(debt => {
      if (!breakdown[debt.supplierId]) {
        breakdown[debt.supplierId] = {
          name: debt.supplierName,
          items: [],
          total: 0,
        };
      }
      breakdown[debt.supplierId].items.push({
        item: debt.itemName,
        qty: debt.quantity,
        cost: debt.totalCost,
      });
      breakdown[debt.supplierId].total += debt.totalCost;
    });
    return breakdown;
  }, [todaySupplierDebts]);

  const cashCollected = getTotalCashCollected();
  const mpesaCollected = getTotalMpesaCollected();
  const bankDeposits = getTotalBankDeposits();
  const pendingDeposits = getPendingCashDeposits();
  const pendingDepositsAmount = pendingDeposits.reduce((sum, p) => sum + p.amount, 0);

  const generateDailyReport = () => {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let report = `*📊 END-OF-DAY REPORT*\n`;
    report += `*${currentShop?.name || 'PHONEMART'}*\n`;
    report += `Date: ${today}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Sales Section
    report += `*💰 SALES TODAY*\n`;
    report += `Total Revenue: KES ${dailyRevenue.toLocaleString()}\n`;
    report += `Number of Transactions: ${dailySales.length}\n`;
    report += `\n`;

    // Payment Breakdown
    report += `*💳 PAYMENT BREAKDOWN*\n`;
    report += `Cash Collected: KES ${cashCollected.toLocaleString()}\n`;
    report += `MPESA Collected: KES ${mpesaCollected.toLocaleString()}\n`;
    report += `Bank Deposits: KES ${bankDeposits.toLocaleString()}\n`;
    if (pendingDepositsAmount > 0) {
      report += `⚠️ Pending Cash Deposits: KES ${pendingDepositsAmount.toLocaleString()}\n`;
    }
    report += `\n`;

    // Repairs Section
    report += `*🔧 REPAIRS TODAY*\n`;
    report += `Repairs Completed: ${repairsCompleted}\n`;
    report += `Repair Revenue: KES ${todayRepairRevenue.toLocaleString()}\n`;
    report += `Outsourced Costs: KES ${todayOutsourcedCosts.toLocaleString()}\n`;
    report += `\n`;

    // Supplier Costs Breakdown
    if (Object.keys(supplierCostsBreakdown).length > 0) {
      report += `*🏪 SUPPLIER COSTS TODAY*\n`;
      Object.values(supplierCostsBreakdown).forEach(supplier => {
        report += `\n${supplier.name}:\n`;
        supplier.items.forEach(item => {
          report += `  • ${item.item} (${item.qty}x): KES ${item.cost.toLocaleString()}\n`;
        });
        report += `  Total: KES ${supplier.total.toLocaleString()}\n`;
      });
      report += `\n`;
    }

    // Summary
    const totalRevenue = dailyRevenue + todayRepairRevenue;
    const grossProfit = totalRevenue - todayOutsourcedCosts;
    report += `*📈 SUMMARY*\n`;
    report += `Total Revenue: KES ${totalRevenue.toLocaleString()}\n`;
    report += `Total Costs: KES ${todayOutsourcedCosts.toLocaleString()}\n`;
    report += `Gross Profit: KES ${grossProfit.toLocaleString()}\n`;
    report += `\n`;

    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `\nThank you!`;

    return report;
  };

  const handleSendReport = () => {
    const report = generateDailyReport();
    shareViaWhatsApp(report, currentShop?.whatsappGroup ? undefined : currentShop?.phone);
  };

  // Auto-send at end of day (optional - can be triggered manually)
  // useEffect(() => {
  //   const now = new Date();
  //   const endOfDay = new Date();
  //   endOfDay.setHours(23, 59, 0, 0);
  //   const timeUntilEndOfDay = endOfDay.getTime() - now.getTime();
  //   
  //   if (timeUntilEndOfDay > 0) {
  //     const timer = setTimeout(() => {
  //       handleSendReport();
  //     }, timeUntilEndOfDay);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">End-of-Day Report</h3>
        <button
          onClick={handleSendReport}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.982 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          Send to WhatsApp
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Sales Revenue:</span>
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
        <div className="flex justify-between">
          <span className="text-gray-600">Outsourced Costs:</span>
          <span className="font-semibold text-orange-600">KES {todayOutsourcedCosts.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-gray-600 font-semibold">Gross Profit:</span>
          <span className="font-bold text-blue-600">KES {(dailyRevenue + todayRepairRevenue - todayOutsourcedCosts).toLocaleString()}</span>
        </div>
        {pendingDepositsAmount > 0 && (
          <div className="flex justify-between text-orange-600">
            <span>⚠️ Pending Deposits:</span>
            <span className="font-semibold">KES {pendingDepositsAmount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
