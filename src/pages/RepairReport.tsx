import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useRepair } from "../context/RepairContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { shareViaWhatsApp, shareViaEmail } from "../utils/receiptUtils";

type Period = 'daily' | 'weekly' | 'monthly';

export default function RepairReport() {
  const { repairs } = useRepair();
  const { items: inventoryItems, purchases } = useInventory();
  const { currentShop, currentUser } = useShop();
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [period, setPeriod] = useState<Period>('daily');
  const isAdmin = currentUser?.roles.includes('admin') ?? false;

  const getDateRange = (p: Period) => {
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (p === 'weekly') {
      start.setDate(start.getDate() - 7);
    } else if (p === 'monthly') {
      start.setMonth(start.getMonth() - 1);
    }
    return { start, end };
  };

  const { start, end } = getDateRange(period);

  const periodLabel = (p: Period) => p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'Monthly';

  const filteredRepairs = useMemo(() => {
    let list = repairs.filter(r => {
      const d = new Date(r.date);
      return d >= start && d <= end;
    });
    if (!isAdmin && currentShop?.id) {
      list = list.filter(r => r.shopId === currentShop?.id);
    }
    return list;
  }, [repairs, start, end, isAdmin, currentShop?.id]);

  const getSupplierForItem = (itemName: string, storedSupplier?: string): string => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (inv?.shopId === currentShop?.id) return 'Own Inventory';
    if (storedSupplier) return storedSupplier;
    if (inv?.supplier) return inv.supplier;
    for (const p of purchases) {
      if (p.items.some(pi => pi.itemName.toLowerCase() === itemName.toLowerCase())) return p.supplier;
    }
    return 'Own Inventory';
  };

  const getSupplierDisplay = (supplier: string): string =>
    supplier === 'Own Inventory' ? `In-stock (${currentShop?.name || 'shop'})` : supplier;

  const getCostPrice = (itemName: string): number => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!isAdmin) return inv?.costPrice ?? 0;
    return inv?.actualCost ?? inv?.adminCostPrice ?? inv?.costPrice ?? 0;
  };

  const repairAnalysis = useMemo(() => {
    return filteredRepairs.map(repair => {
      const revenue = repair.totalAgreedAmount || repair.totalCost;
      const partsBreakdown = repair.partsUsed.map(part => {
        const costPerUnit = part.cost > 0 ? part.cost : getCostPrice(part.itemName);
        const supplier = getSupplierForItem(part.itemName, part.supplierName);
        return {
          itemName: part.itemName,
          qty: part.qty,
          costPerUnit,
          totalCost: costPerUnit * part.qty,
          supplier,
        };
      });
      const outsourcedBreakdown = (repair.additionalItems || [])
        .filter(item => item.source === 'outsourced')
        .filter(item => !repair.partsUsed.some(p => p.itemName === item.itemName))
        .map(item => ({
          itemName: item.itemName,
          qty: 1,
          costPerUnit: 0,
          totalCost: 0,
          supplier: getSupplierForItem(item.itemName, item.supplierName),
        }));
      const allParts = [...partsBreakdown, ...outsourcedBreakdown];
      const totalPartsCost = allParts.reduce((sum, p) => sum + p.totalCost, 0);
      const profit = revenue - totalPartsCost;
      return { repair, revenue, allParts, totalPartsCost, profit };
    });
  }, [filteredRepairs, inventoryItems, purchases, isAdmin]);

  const incompleteOutsourced = useMemo(() => {
    const list: Array<{ repairId: string; ticket?: string; customerName: string; itemNames: string[] }> = [];
    repairAnalysis.forEach((ra) => {
      const missing = ra.allParts
        .filter((p) => p.supplier !== 'Own Inventory' && (p.totalCost === 0 || p.costPerUnit === 0))
        .map((p) => p.itemName);
      const uniqueMissing = [...new Set(missing)];
      if (uniqueMissing.length > 0) {
        list.push({
          repairId: ra.repair.id,
          ticket: ra.repair.ticketNumber,
          customerName: ra.repair.customerName,
          itemNames: uniqueMissing,
        });
      }
    });
    return list;
  }, [repairAnalysis]);

  const canSendReport = incompleteOutsourced.length === 0;

  const totals = useMemo(() => ({
    revenue: repairAnalysis.reduce((s, r) => s + r.revenue, 0),
    cost: repairAnalysis.reduce((s, r) => s + r.totalPartsCost, 0),
    profit: repairAnalysis.reduce((s, r) => s + r.profit, 0),
  }), [repairAnalysis]);

  const formatDate = (d: Date) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const buildReportText = (bold: boolean) => {
    const b = (s: string) => bold ? `*${s}*` : s;
    let text = `${b('REPAIR REPORT')} - ${periodLabel(period)}\n`;
    text += `${formatDate(start)}${period !== 'daily' ? ` to ${formatDate(end)}` : ''}\n\n`;
    text += `${b('SUMMARY')}\n`;
    text += `Repairs: ${filteredRepairs.length}\n`;
    text += `Revenue: KES ${totals.revenue.toLocaleString()} | Cost: KES ${totals.cost.toLocaleString()}\n`;
    text += `${b('Profit: KES ' + totals.profit.toLocaleString())}\n\n`;
    if (repairAnalysis.length > 0) {
      text += `${b('REPAIRS')}\n`;
      repairAnalysis.forEach((ra, idx) => {
        const r = ra.repair;
        text += `${idx + 1}. ${r.customerName} - ${r.phoneModel}`;
        if (r.ticketNumber) text += ` ${r.ticketNumber}`;
        text += `\n${r.issue}`;
        if (r.serviceType) text += ` (${r.serviceType})`;
        text += ` | Rev: KES ${ra.revenue.toLocaleString()}\n`;
        ra.allParts.forEach(p => {
          const costStr = p.supplier === 'Own Inventory' ? '-' : (p.totalCost > 0 ? `KES ${p.totalCost.toLocaleString()}` : '?');
          text += `  - ${p.itemName} x${p.qty} ${costStr} (${getSupplierDisplay(p.supplier)})\n`;
        });
        text += `Cost: KES ${ra.totalPartsCost.toLocaleString()} ${b('Profit: KES ' + ra.profit.toLocaleString())}\n`;
      });
    }
    text += `\n${b('End of Report')}`;
    return text;
  };

  const blockSendMessage = () => {
    const lines = incompleteOutsourced.map(
      (r) => `• ${r.customerName}${r.ticket ? ` (${r.ticket})` : ''}: ${r.itemNames.join(', ')} — cost not entered`
    );
    alert(
      "You cannot send the report until all outsourced parts have their cost entered.\n\n" +
      "Repairs with missing outsourced cost:\n\n" + lines.join("\n") +
      "\n\nGo to Cost of Parts and enter the cost for each outsourced item."
    );
  };

  const handleShareWhatsApp = () => {
    if (!canSendReport || incompleteOutsourced.length > 0) { blockSendMessage(); return; }
    shareViaWhatsApp(buildReportText(true), whatsAppNumber.trim() || undefined);
  };

  const handleShareToGroup = () => {
    if (!canSendReport || incompleteOutsourced.length > 0) { blockSendMessage(); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(buildReportText(true))}`, '_blank');
  };

  const handleShareEmail = () => {
    if (!canSendReport || incompleteOutsourced.length > 0) { blockSendMessage(); return; }
    shareViaEmail(
      `Repair Report - ${periodLabel(period)} - ${formatDate(new Date())}`,
      buildReportText(false)
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Repair Report</h1>
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
          <Link to="/pending-collections/fully-paid" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm">
            Pending Collections
          </Link>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Direct number (optional)</label>
            <input type="tel" placeholder="+254712345678" value={whatsAppNumber} onChange={(e) => setWhatsAppNumber(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm w-40" />
          </div>
          <button onClick={handleShareWhatsApp} disabled={!canSendReport}
            className={`px-4 py-2 rounded text-sm ${canSendReport ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'}`}
            title={!canSendReport ? "Enter outsourced part costs first" : undefined}>
            Send to Number
          </button>
          <button onClick={handleShareToGroup} disabled={!canSendReport}
            className={`px-4 py-2 rounded text-sm ${canSendReport ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'}`}
            title={!canSendReport ? "Enter outsourced part costs first" : undefined}>
            Send to WhatsApp Group
          </button>
          <button onClick={handleShareEmail} disabled={!canSendReport}
            className={`px-4 py-2 rounded text-sm ${canSendReport ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'}`}
            title={!canSendReport ? "Enter outsourced part costs first" : undefined}>
            Email Report
          </button>
        </div>
      </div>

      {!canSendReport && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-5 mb-6">
          <p className="font-semibold text-amber-900 text-lg">Report cannot be sent yet</p>
          <p className="text-sm text-amber-800 mt-1">Some repairs use outsourced parts whose cost has not been entered.</p>
          <ul className="text-sm text-amber-800 mt-2 list-disc list-inside">
            {incompleteOutsourced.map((r) => (
              <li key={r.repairId}>{r.customerName}{r.ticket ? ` (${r.ticket})` : ""}: {r.itemNames.join(", ")}</li>
            ))}
          </ul>
          <Link to="/cost-of-parts" className="inline-block mt-3 bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700">
            Fill in cost of outsourced items →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-600">Repairs</p>
          <p className="text-xl font-bold text-blue-700">{filteredRepairs.length}</p>
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
        <h2 className="text-lg font-semibold mb-4">Detailed Repair Sales</h2>
        {repairAnalysis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No repairs in this period.</p>
        ) : (
          <div className="space-y-4">
            {repairAnalysis.map((ra) => (
              <div key={ra.repair.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="font-semibold">{ra.repair.customerName} - {ra.repair.phoneModel}</p>
                    <p className="text-sm text-gray-600">{ra.repair.issue} | {new Date(ra.repair.date).toLocaleDateString()}</p>
                    {ra.repair.ticketNumber && <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{ra.repair.ticketNumber}</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-700 font-semibold">Revenue: KES {ra.revenue.toLocaleString()}</p>
                    <p className="text-sm text-red-600">Cost: KES {ra.totalPartsCost.toLocaleString()}</p>
                    <p className={`text-sm font-bold ${ra.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Profit: KES {ra.profit.toLocaleString()}</p>
                  </div>
                </div>
                {ra.allParts.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {ra.allParts.map((p, i) => (
                      <span key={i} className="inline-block mr-2 mb-1">
                        {p.itemName} x{p.qty} {p.totalCost > 0 ? `KES ${p.totalCost.toLocaleString()}` : '?'} ({getSupplierDisplay(p.supplier)})
                      </span>
                    ))}
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
