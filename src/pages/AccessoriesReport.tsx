import { useState, useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { shareViaWhatsApp, shareViaEmail } from "../utils/receiptUtils";

type Period = 'daily' | 'weekly' | 'monthly';

export default function AccessoriesReport() {
  const { sales, getDailySales, getWeeklySales, getMonthlySales } = useSales();
  const { items: inventoryItems } = useInventory();
  const { currentShop, currentUser } = useShop();
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [period, setPeriod] = useState<Period>('daily');
  const isAdmin = currentUser?.roles.includes('admin') ?? false;

  const periodLabel = (p: Period) => p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'Monthly';

  const filteredSales = useMemo(() => {
    let list = period === 'daily' ? getDailySales() : period === 'weekly' ? getWeeklySales() : getMonthlySales();
    if (!isAdmin && currentShop?.id) {
      list = list.filter(s => s.shopId === currentShop?.id);
    }
    return list;
  }, [period, sales, isAdmin, currentShop?.id, getDailySales, getWeeklySales, getMonthlySales]);

  const getSupplierForItem = (itemName: string): string => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (inv?.shopId === currentShop?.id) return 'Own Inventory';
    if (inv?.supplier) return inv.supplier;
    return 'Own Inventory';
  };

  const getSupplierDisplay = (supplier: string): string =>
    supplier === 'Own Inventory' ? `In-stock (${currentShop?.name || 'shop'})` : supplier;

  const isAccessorySaleItem = (sale: typeof sales[0], item: typeof sale.items[0]) => {
    if (sale.saleType === 'repair') return true;
    if (item.itemId != null) {
      const inv = inventoryItems.find((i) => i.id === item.itemId);
      return inv?.category?.toLowerCase() === 'accessory';
    }
    const inv = inventoryItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
    return inv?.category?.toLowerCase() === 'accessory';
  };

  const accessoryAnalysis = useMemo(() => {
    return filteredSales.map((sale) => {
      const accessoryItems = sale.items.filter((item) => isAccessorySaleItem(sale, item));
      const itemsBreakdown = accessoryItems.map((item) => {
        const actualSellingPrice = item.price;
        const invItem = inventoryItems.find(i =>
          (item.itemId && i.id === item.itemId) || i.name.toLowerCase() === item.name.toLowerCase()
        );
        const costForStaff = invItem?.costPrice ?? item.adminBasePrice ?? 0;
        const costForAdmin = invItem?.actualCost ?? invItem?.adminCostPrice ?? costForStaff;
        const supplier = getSupplierForItem(item.name);
        const staffProfit = item.qty * (actualSellingPrice - costForStaff);
        const realProfit = isAdmin ? item.qty * (actualSellingPrice - costForAdmin) : staffProfit;
        return {
          itemName: item.name,
          qty: item.qty,
          sellingPrice: actualSellingPrice,
          totalRevenue: item.qty * actualSellingPrice,
          totalCost: item.qty * (isAdmin ? costForAdmin : costForStaff),
          profit: isAdmin ? realProfit : staffProfit,
          supplier,
          fromRepair: sale.saleType === 'repair',
        };
      });
      const revenue = itemsBreakdown.reduce((s, i) => s + i.totalRevenue, 0);
      const totalCost = itemsBreakdown.reduce((s, i) => s + i.totalCost, 0);
      const profit = itemsBreakdown.reduce((s, i) => s + i.profit, 0);
      return { sale, revenue, itemsBreakdown, totalCost, profit };
    }).filter((aa) => aa.itemsBreakdown.length > 0);
  }, [filteredSales, inventoryItems, isAdmin]);

  const totals = useMemo(() => ({
    revenue: accessoryAnalysis.reduce((s, a) => s + a.revenue, 0),
    cost: accessoryAnalysis.reduce((s, a) => s + a.totalCost, 0),
    profit: accessoryAnalysis.reduce((s, a) => s + a.profit, 0),
  }), [accessoryAnalysis]);

  const formatDate = (d: Date) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const buildReportText = (bold: boolean) => {
    const b = (s: string) => bold ? `*${s}*` : s;
    let text = `${b('ACCESSORIES REPORT')} - ${periodLabel(period)}\n`;
    text += `${formatDate(new Date())}\n\n`;
    text += `${b('SUMMARY')}\n`;
    text += `Sales: ${accessoryAnalysis.length} | Items: ${accessoryAnalysis.reduce((s, a) => s + a.itemsBreakdown.reduce((t, i) => t + i.qty, 0), 0)}\n`;
    text += `Revenue: KES ${totals.revenue.toLocaleString()} | Cost: KES ${totals.cost.toLocaleString()}\n`;
    text += `${b('Profit: KES ' + totals.profit.toLocaleString())}\n\n`;
    if (accessoryAnalysis.length > 0) {
      text += `${b('ACCESSORIES')}\n`;
      accessoryAnalysis.forEach((aa, idx) => {
        text += `${idx + 1}. ${aa.sale.saleType === 'wholesale' ? 'Wholesale' : aa.sale.saleType === 'repair' ? 'From Repair' : 'Retail'}\n`;
        aa.itemsBreakdown.forEach(item => {
          text += `  - ${item.itemName} x${item.qty} KES ${item.totalRevenue.toLocaleString()} (${getSupplierDisplay(item.supplier)})\n`;
        });
        text += `Rev: KES ${aa.revenue.toLocaleString()} Cost: KES ${aa.totalCost.toLocaleString()} ${b('Profit: KES ' + aa.profit.toLocaleString())}\n`;
      });
    }
    text += `\n${b('End of Report')}`;
    return text;
  };

  const handleShareWhatsApp = () => {
    shareViaWhatsApp(buildReportText(true), whatsAppNumber.trim() || undefined);
  };

  const handleShareToGroup = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildReportText(true))}`, '_blank');
  };

  const handleShareEmail = () => {
    shareViaEmail(
      `Accessories Report - ${periodLabel(period)} - ${formatDate(new Date())}`,
      buildReportText(false)
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Accessories Report</h1>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded text-sm font-medium transition ${
                  period === p ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {periodLabel(p)}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Direct number (optional)</label>
            <input type="tel" placeholder="+254712345678" value={whatsAppNumber} onChange={(e) => setWhatsAppNumber(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm w-40" />
          </div>
          <button onClick={handleShareWhatsApp} className="px-4 py-2 rounded text-sm bg-green-600 text-white hover:bg-green-700">
            Send to Number
          </button>
          <button onClick={handleShareToGroup} className="px-4 py-2 rounded text-sm bg-green-700 text-white hover:bg-green-800">
            Send to WhatsApp Group
          </button>
          <button onClick={handleShareEmail} className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700">
            Email Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-600">Sales</p>
          <p className="text-xl font-bold text-blue-700">{accessoryAnalysis.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-600">Revenue</p>
          <p className="text-xl font-bold text-green-700">KES {totals.revenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-600">Cost</p>
          <p className="text-xl font-bold text-red-700">KES {totals.cost.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-600">Profit</p>
          <p className={`text-xl font-bold ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>KES {totals.profit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Detailed Accessory Sales</h2>
        {accessoryAnalysis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No accessory sales in this period.</p>
        ) : (
          <div className="space-y-4">
            {accessoryAnalysis.map((aa, idx) => (
              <div key={aa.sale.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {aa.sale.saleType === 'repair' ? 'From Repair' : aa.sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{new Date(aa.sale.date).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-700 font-semibold">Revenue: KES {aa.revenue.toLocaleString()}</p>
                    <p className="text-sm text-red-600">Cost: KES {aa.totalCost.toLocaleString()}</p>
                    <p className={`text-sm font-bold ${aa.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Profit: KES {aa.profit.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {aa.itemsBreakdown.map((item, i) => (
                    <span key={i} className="inline-block mr-2 mb-1">
                      {item.itemName} x{item.qty} KES {item.totalRevenue.toLocaleString()} ({getSupplierDisplay(item.supplier)})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
