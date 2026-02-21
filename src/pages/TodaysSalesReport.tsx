import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSales } from "../context/SalesContext";
import { useRepair } from "../context/RepairContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { shareViaWhatsApp, shareViaEmail } from "../utils/receiptUtils";

export default function TodaysSalesReport() {
  const { getTodaysSalesReport, getDailySales } = useSales();
  const { repairs } = useRepair();
  const { items: inventoryItems, purchases } = useInventory();
  const { currentShop, currentUser } = useShop();
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const report = getTodaysSalesReport();
  const todaysSales = getDailySales();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = (d: Date) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt.getTime() === today.getTime();
  };

  // Today's repairs
  const todayRepairs = repairs.filter(r => isToday(r.date));
  const filteredRepairs = currentUser?.roles.includes('admin')
    ? todayRepairs
    : todayRepairs.filter(r => r.shopId === currentShop?.id);

  // Helper: find supplier for an item
  const getSupplierForItem = (itemName: string): string => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (inv?.supplier) return inv.supplier;
    for (const p of purchases) {
      if (p.items.some(pi => pi.itemName.toLowerCase() === itemName.toLowerCase())) {
        return p.supplier;
      }
    }
    return 'Unknown';
  };

  // Helper: find cost price for an inventory item
  const getCostPrice = (itemName: string): number => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (inv?.adminCostPrice && inv.adminCostPrice > 0) return inv.adminCostPrice;
    if (inv?.costPrice && inv.costPrice > 0) return inv.costPrice;
    for (const p of purchases) {
      const pi = p.items.find(pi => pi.itemName.toLowerCase() === itemName.toLowerCase());
      if (pi) return pi.costPrice;
    }
    return 0;
  };

  // --- REPAIR ANALYSIS ---
  const repairAnalysis = useMemo(() => {
    return filteredRepairs.map(repair => {
      const revenue = repair.totalAgreedAmount || repair.totalCost;

      // All parts with their costs (from repair_parts table)
      const partsBreakdown = repair.partsUsed.map(part => {
        const costPerUnit = part.cost > 0 ? part.cost : getCostPrice(part.itemName);
        const supplier = getSupplierForItem(part.itemName);
        return {
          itemName: part.itemName,
          qty: part.qty,
          costPerUnit,
          totalCost: costPerUnit * part.qty,
          supplier,
          source: 'inventory' as const,
        };
      });

      // Additional outsourced items not yet in partsUsed (cost not entered yet)
      const outsourcedBreakdown = (repair.additionalItems || [])
        .filter(item => item.source === 'outsourced')
        .filter(item => !repair.partsUsed.some(p => p.itemName === item.itemName))
        .map(item => ({
          itemName: item.itemName,
          qty: 1,
          costPerUnit: 0,
          totalCost: 0,
          supplier: getSupplierForItem(item.itemName),
          source: 'outsourced' as const,
        }));

      const allParts = [...partsBreakdown, ...outsourcedBreakdown];
      // Total cost = sum of all parts costs only (no double counting with outsourcedCost)
      const totalPartsCost = allParts.reduce((sum, p) => sum + p.totalCost, 0);
      const profit = revenue - totalPartsCost;

      return {
        repair,
        revenue,
        allParts,
        totalPartsCost,
        totalCost: totalPartsCost,
        profit,
      };
    });
  }, [filteredRepairs, inventoryItems, purchases]);

  // --- ACCESSORY ANALYSIS ---
  const accessoryAnalysis = useMemo(() => {
    return todaysSales.map(sale => {
      const revenue = sale.total;
      const itemsBreakdown = sale.items.map(item => {
        const costPrice = getCostPrice(item.name);
        const supplier = getSupplierForItem(item.name);
        return {
          itemName: item.name,
          qty: item.qty,
          sellingPrice: item.price,
          costPrice,
          totalRevenue: item.qty * item.price,
          totalCost: item.qty * costPrice,
          profit: item.qty * (item.price - costPrice),
          supplier,
        };
      });
      const totalCost = itemsBreakdown.reduce((sum, i) => sum + i.totalCost, 0);
      const profit = revenue - totalCost;
      return { sale, revenue, itemsBreakdown, totalCost, profit };
    });
  }, [todaysSales, inventoryItems, purchases]);

  // --- SUPPLIER SUMMARY ---
  const supplierSummary = useMemo(() => {
    const map: Record<string, { name: string; partsCost: number; items: string[]; repairCount: number; accessoryCount: number }> = {};

    repairAnalysis.forEach(ra => {
      ra.allParts.forEach(part => {
        if (!map[part.supplier]) map[part.supplier] = { name: part.supplier, partsCost: 0, items: [], repairCount: 0, accessoryCount: 0 };
        map[part.supplier].partsCost += part.totalCost;
        if (!map[part.supplier].items.includes(part.itemName)) map[part.supplier].items.push(part.itemName);
        map[part.supplier].repairCount++;
      });
    });

    accessoryAnalysis.forEach(aa => {
      aa.itemsBreakdown.forEach(item => {
        if (!map[item.supplier]) map[item.supplier] = { name: item.supplier, partsCost: 0, items: [], repairCount: 0, accessoryCount: 0 };
        map[item.supplier].partsCost += item.totalCost;
        if (!map[item.supplier].items.includes(item.itemName)) map[item.supplier].items.push(item.itemName);
        map[item.supplier].accessoryCount++;
      });
    });

    return Object.values(map).sort((a, b) => b.partsCost - a.partsCost);
  }, [repairAnalysis, accessoryAnalysis]);

  // --- TOTALS ---
  const totals = useMemo(() => {
    const repairRevenue = repairAnalysis.reduce((sum, r) => sum + r.revenue, 0);
    const repairCosts = repairAnalysis.reduce((sum, r) => sum + r.totalCost, 0);
    const repairProfit = repairAnalysis.reduce((sum, r) => sum + r.profit, 0);
    const accessoryRevenue = accessoryAnalysis.reduce((sum, a) => sum + a.revenue, 0);
    const accessoryCosts = accessoryAnalysis.reduce((sum, a) => sum + a.totalCost, 0);
    const accessoryProfit = accessoryAnalysis.reduce((sum, a) => sum + a.profit, 0);
    const totalSupplierCost = supplierSummary.reduce((sum, s) => sum + s.partsCost, 0);
    return {
      repairRevenue, repairCosts, repairProfit,
      accessoryRevenue, accessoryCosts, accessoryProfit,
      totalRevenue: repairRevenue + accessoryRevenue,
      totalCosts: repairCosts + accessoryCosts,
      totalProfit: repairProfit + accessoryProfit,
      totalSupplierCost,
    };
  }, [repairAnalysis, accessoryAnalysis, supplierSummary]);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // --- BUILD REPORT TEXT ---
  const buildReportText = (bold: boolean) => {
    const b = (s: string) => bold ? `*${s}*` : s;
    let text = '';
    text += `${b('PHONEMART DAILY REPORT')}\n`;
    text += `${formatDate(new Date())}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Summary
    text += `${b('SUMMARY')}\n`;
    text += `Accessory Sales: ${todaysSales.length}\n`;
    text += `Repair Sales: ${filteredRepairs.length}\n\n`;
    text += `Revenue (Accessories): KES ${totals.accessoryRevenue.toLocaleString()}\n`;
    text += `Revenue (Repairs): KES ${totals.repairRevenue.toLocaleString()}\n`;
    text += `${b('Total Revenue: KES ' + totals.totalRevenue.toLocaleString())}\n\n`;
    text += `Cost (Accessories): KES ${totals.accessoryCosts.toLocaleString()}\n`;
    text += `Cost (Repairs/Parts): KES ${totals.repairCosts.toLocaleString()}\n`;
    text += `${b('Total Costs: KES ' + totals.totalCosts.toLocaleString())}\n\n`;
    text += `${b('TOTAL PROFIT: KES ' + totals.totalProfit.toLocaleString())}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Supplier Costs
    if (supplierSummary.length > 0) {
      text += `${b('SUPPLIER COSTS')}\n`;
      supplierSummary.forEach(s => {
        text += `${s.name}: KES ${s.partsCost.toLocaleString()}\n`;
        text += `  Items: ${s.items.join(', ')}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Transaction References
    if (report.transactionReferences.length > 0) {
      text += `${b('TRANSACTION REFERENCES')}\n`;
      report.transactionReferences.forEach((ref, idx) => {
        text += `${idx + 1}. ${ref.method.toUpperCase()}: ${ref.reference}\n`;
        text += `   Amount: KES ${ref.amount.toLocaleString()}\n`;
        if (ref.bank) text += `   Bank: ${ref.bank}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Detailed Repair Sales
    if (repairAnalysis.length > 0) {
      text += `${b('REPAIR SALES')}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      repairAnalysis.forEach((ra, idx) => {
        const r = ra.repair;
        text += `\n${idx + 1}. ${r.customerName} - ${r.phoneModel}\n`;
        if (r.ticketNumber) text += `   Ticket: ${r.ticketNumber}\n`;
        text += `   Issue: ${r.issue}\n`;
        text += `   Revenue: KES ${ra.revenue.toLocaleString()}\n`;
        if (ra.allParts.length > 0) {
          text += `   Parts Used:\n`;
          ra.allParts.forEach(p => {
            text += `   - ${p.itemName} x${p.qty}`;
            if (p.totalCost > 0) text += ` (Cost: KES ${p.totalCost.toLocaleString()})`;
            text += ` [${p.supplier}]\n`;
          });
        }
        text += `   Total Cost: KES ${ra.totalCost.toLocaleString()}\n`;
        text += `   ${b('Profit: KES ' + ra.profit.toLocaleString())}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Detailed Accessory Sales
    if (accessoryAnalysis.length > 0) {
      text += `${b('ACCESSORY SALES')}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      accessoryAnalysis.forEach((aa, idx) => {
        text += `\n${idx + 1}. ${aa.sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'} Sale\n`;
        aa.itemsBreakdown.forEach(item => {
          text += `   - ${item.itemName} x${item.qty}\n`;
          text += `     Sold: KES ${item.sellingPrice.toLocaleString()} | Cost: KES ${item.costPrice.toLocaleString()} [${item.supplier}]\n`;
        });
        text += `   Revenue: KES ${aa.revenue.toLocaleString()} | Cost: KES ${aa.totalCost.toLocaleString()}\n`;
        text += `   ${b('Profit: KES ' + aa.profit.toLocaleString())}\n`;
        if (aa.sale.paymentType) text += `   Payment: ${aa.sale.paymentType}\n`;
        if (aa.sale.depositReference) text += `   Ref: ${aa.sale.depositReference}\n`;
      });
      text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    }

    text += `\nDeposited: KES ${report.totalDeposited.toLocaleString()}\n`;
    text += `\n${b('End of Report')}`;
    return text;
  };

  const handleShareWhatsApp = () => {
    const text = buildReportText(true);
    const targetPhone = whatsAppNumber.trim() || undefined;
    shareViaWhatsApp(text, targetPhone);
  };

  const handleShareToGroup = () => {
    const text = buildReportText(true);
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = `Daily Sales Report - ${formatDate(new Date())}`;
    const body = buildReportText(false);
    shareViaEmail(subject, body);
  };

  const fullyPaidRepairs = filteredRepairs.filter(r => r.paymentStatus === 'fully_paid').length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Today's Sales Report</h1>
        <div className="flex gap-3 items-center flex-wrap">
          <Link to="/pending-collections/fully-paid" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm">
            View Fully Paid ({fullyPaidRepairs})
          </Link>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Direct number (optional)</label>
            <input type="tel" placeholder="+254712345678" value={whatsAppNumber} onChange={(e) => setWhatsAppNumber(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm w-40" />
          </div>
          <button onClick={handleShareWhatsApp} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
            Send to Number
          </button>
          <button onClick={handleShareToGroup} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm">
            Send to WhatsApp Group
          </button>
          <button onClick={handleShareEmail} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
            Email Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
          <p className="text-xs text-gray-600">Accessory Sales</p>
          <p className="text-xl font-bold text-blue-700">{todaysSales.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-orange-500">
          <p className="text-xs text-gray-600">Repair Sales</p>
          <p className="text-xl font-bold text-orange-700">{filteredRepairs.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
          <p className="text-xs text-gray-600">Total Revenue</p>
          <p className="text-xl font-bold text-green-700">KES {totals.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
          <p className="text-xs text-gray-600">Total Costs</p>
          <p className="text-xl font-bold text-red-700">KES {totals.totalCosts.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-emerald-500">
          <p className="text-xs text-gray-600">Total Profit</p>
          <p className={`text-xl font-bold ${totals.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            KES {totals.totalProfit.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow border-l-4 border-purple-500">
          <p className="text-xs text-gray-600">Deposited</p>
          <p className="text-xl font-bold text-purple-700">KES {report.totalDeposited.toLocaleString()}</p>
        </div>
      </div>

      {/* Revenue vs Costs Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Repairs Breakdown</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Revenue</span><span className="font-bold text-green-700">KES {totals.repairRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Parts & Outsourcing Costs</span><span className="font-bold text-red-600">KES {totals.repairCosts.toLocaleString()}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="font-semibold">Repair Profit</span><span className={`font-bold ${totals.repairProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>KES {totals.repairProfit.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded shadow">
          <h2 className="text-lg font-semibold mb-3">Accessories Breakdown</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Revenue</span><span className="font-bold text-green-700">KES {totals.accessoryRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Cost of Goods</span><span className="font-bold text-red-600">KES {totals.accessoryCosts.toLocaleString()}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="font-semibold">Accessories Profit</span><span className={`font-bold ${totals.accessoryProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>KES {totals.accessoryProfit.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      {/* Supplier Costs Summary */}
      {supplierSummary.length > 0 && (
        <div className="bg-white p-5 rounded shadow mb-6">
          <h2 className="text-lg font-semibold mb-3">Supplier Costs Today</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Supplier</th>
                  <th className="p-2 text-left">Items Supplied</th>
                  <th className="p-2 text-center">Repairs</th>
                  <th className="p-2 text-center">Accessories</th>
                  <th className="p-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummary.map(s => (
                  <tr key={s.name} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-semibold">{s.name}</td>
                    <td className="p-2 text-gray-600">{s.items.join(', ')}</td>
                    <td className="p-2 text-center">{s.repairCount}</td>
                    <td className="p-2 text-center">{s.accessoryCount}</td>
                    <td className="p-2 text-right font-bold text-red-600">KES {s.partsCost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="p-2" colSpan={4}>Total Supplier Costs</td>
                  <td className="p-2 text-right text-red-700">KES {totals.totalSupplierCost.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Transaction References */}
      {report.transactionReferences.length > 0 && (
        <div className="bg-white p-5 rounded shadow mb-6">
          <h2 className="text-lg font-semibold mb-3">Transaction References</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Method</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Reference</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report.transactionReferences.map((ref, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 capitalize">{ref.method}</td>
                    <td className="px-4 py-2 font-mono">{ref.reference}</td>
                    <td className="px-4 py-2 text-right">KES {ref.amount.toLocaleString()}</td>
                    <td className="px-4 py-2">{ref.bank || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Repair Sales */}
      <div className="bg-white p-5 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Detailed Repair Sales</h2>
        {repairAnalysis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No repair sales recorded today.</p>
        ) : (
          <div className="space-y-4">
            {repairAnalysis.map((ra, idx) => {
              const r = ra.repair;
              return (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          Repair #{idx + 1}
                        </span>
                        {r.ticketNumber && (
                          <span className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-700 rounded">
                            {r.ticketNumber}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold">{r.customerName}</p>
                      <p className="text-sm text-gray-600">{r.phoneModel} - {r.issue}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Revenue: <span className="font-bold text-green-700">KES {ra.revenue.toLocaleString()}</span></p>
                      <p className="text-sm text-gray-600">Cost: <span className="font-bold text-red-600">KES {ra.totalCost.toLocaleString()}</span></p>
                      <p className={`text-sm font-bold ${ra.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        Profit: KES {ra.profit.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {ra.allParts.length > 0 && (
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Parts & Supplier Costs:</p>
                      <div className="space-y-1">
                        {ra.allParts.map((part, pidx) => (
                          <div key={pidx} className="flex justify-between items-center text-sm">
                            <div>
                              <span className="font-medium">{part.itemName}</span>
                              <span className="text-gray-500"> x{part.qty}</span>
                              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{part.supplier}</span>
                              {part.source === 'outsourced' && (
                                <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">Outsourced</span>
                              )}
                            </div>
                            <span className="font-semibold text-red-600">
                              {part.totalCost > 0 ? `KES ${part.totalCost.toLocaleString()}` : '-'}
                            </span>
                          </div>
                        ))}
                        
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Accessory Sales */}
      <div className="bg-white p-5 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Detailed Accessory Sales</h2>
        {accessoryAnalysis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No accessory sales recorded today.</p>
        ) : (
          <div className="space-y-4">
            {accessoryAnalysis.map((aa, idx) => (
              <div key={aa.sale.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {aa.sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'} #{idx + 1}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{new Date(aa.sale.date).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Revenue: <span className="font-bold text-green-700">KES {aa.revenue.toLocaleString()}</span></p>
                    <p className="text-sm text-gray-600">Cost: <span className="font-bold text-red-600">KES {aa.totalCost.toLocaleString()}</span></p>
                    <p className={`text-sm font-bold ${aa.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      Profit: KES {aa.profit.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded p-3">
                  <div className="space-y-1">
                    {aa.itemsBreakdown.map((item, iidx) => (
                      <div key={iidx} className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-medium">{item.itemName}</span>
                          <span className="text-gray-500"> x{item.qty}</span>
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{item.supplier}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-green-700 mr-3">Sold: KES {item.sellingPrice.toLocaleString()}</span>
                          <span className="text-red-600">Cost: KES {item.costPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {aa.sale.paymentType && (
                  <div className="mt-2 text-sm text-gray-600">
                    Payment: <span className="capitalize font-medium">{aa.sale.paymentType}</span>
                    {aa.sale.depositReference && <> | Ref: <span className="font-mono">{aa.sale.depositReference}</span></>}
                    {aa.sale.bank && <> | Bank: <span className="font-medium">{aa.sale.bank}</span></>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
