import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSales } from "../context/SalesContext";
import { useRepair } from "../context/RepairContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { useSupplier } from "../context/SupplierContext";
import { shareViaWhatsApp, shareViaEmail } from "../utils/receiptUtils";

export default function TodaysSalesReport() {
  const { getTodaysSalesReport, getDailySales } = useSales();
  const { repairs } = useRepair();
  const { items: inventoryItems, purchases } = useInventory();
  const { currentShop, currentUser } = useShop();
  const { suppliers } = useSupplier();
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const report = getTodaysSalesReport();
  const todaysSales = getDailySales();
  const isAdmin = currentUser?.roles.includes('admin') ?? false;

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

  // Helper: find supplier for an item. Items allocated to current shop = in-stock (Own Inventory).
  const getSupplierForItem = (itemName: string, storedSupplier?: string): string => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    // If item is allocated to current shop, it's in-stock (don't show purchase supplier like "Urban Accessories")
    if (inv?.shopId === currentShop?.id) return 'Own Inventory';
    if (storedSupplier) return storedSupplier;
    if (inv?.supplier) return inv.supplier;
    for (const p of purchases) {
      if (p.items.some(pi => pi.itemName.toLowerCase() === itemName.toLowerCase())) {
        return p.supplier;
      }
    }
    return 'Own Inventory';
  };

  // Display: in-stock = "In-stock accessories (ShopName)", else supplier name
  const getSupplierDisplay = (supplier: string): string =>
    supplier === 'Own Inventory' ? `In-stock accessories (${currentShop?.name || 'shop'})` : supplier;

  // True if part is an accessory (by inventory category or supplier category)
  const isAccessoryPart = (itemName: string, supplierName?: string): boolean => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (inv?.category?.toLowerCase() === 'accessory') return true;
    if (supplierName) {
      const sup = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
      if (sup?.categories?.includes('accessories')) return true;
    }
    return false;
  };

  // Helper: find cost price for an inventory item. Staff never see adminCostPrice.
  const getCostPrice = (itemName: string): number => {
    const inv = inventoryItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!isAdmin) {
      if (inv?.costPrice != null && inv.costPrice > 0) return inv.costPrice;
      for (const p of purchases) {
        const pi = p.items.find(pi => pi.itemName.toLowerCase() === itemName.toLowerCase());
        if (pi) return pi.costPrice;
      }
      return 0;
    }
    if (inv?.adminCostPrice != null && inv.adminCostPrice > 0) return inv.adminCostPrice;
    if (inv?.costPrice != null && inv.costPrice > 0) return inv.costPrice;
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

      // All parts with their costs (from repair_parts table); tag accessory vs spare
      const partsBreakdown = repair.partsUsed.map(part => {
        const costPerUnit = part.cost > 0 ? part.cost : getCostPrice(part.itemName);
        const supplier = getSupplierForItem(part.itemName, part.supplierName);
        const source = part.source || (part.supplierName ? 'outsourced' : 'in-house');
        const isAccessory = isAccessoryPart(part.itemName, part.supplierName);
        const inv = inventoryItems.find(i => i.name.toLowerCase() === part.itemName.toLowerCase());
        const sellingPrice = inv?.price ?? 0;
        return {
          itemName: part.itemName,
          qty: part.qty,
          costPerUnit,
          totalCost: costPerUnit * part.qty,
          supplier,
          source: source as 'inventory' | 'outsourced',
          isAccessory,
          sellingPrice,
        };
      });

      // Additional outsourced items not yet in partsUsed (cost not entered yet)
      const outsourcedBreakdown = (repair.additionalItems || [])
        .filter(item => item.source === 'outsourced')
        .filter(item => !repair.partsUsed.some(p => p.itemName === item.itemName))
        .map(item => {
          const inv = inventoryItems.find(i => i.name.toLowerCase() === item.itemName.toLowerCase());
          return {
            itemName: item.itemName,
            qty: 1,
            costPerUnit: 0,
            totalCost: 0,
            supplier: getSupplierForItem(item.itemName, item.supplierName),
            source: 'outsourced' as const,
            isAccessory: isAccessoryPart(item.itemName, item.supplierName),
            sellingPrice: inv?.price ?? 0,
          };
        });

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
  }, [filteredRepairs, inventoryItems, purchases, isAdmin, suppliers]);

  // Helper: is this sale item an accessory? (by category or sale type)
  const isAccessorySaleItem = (sale: { saleType: string }, item: { name: string; itemId?: number }) => {
    if (sale.saleType === 'repair') return true;
    if (item.itemId != null) {
      const inv = inventoryItems.find((i) => i.id === item.itemId);
      return inv?.category?.toLowerCase() === 'accessory';
    }
    return isAccessoryPart(item.name);
  };

  // --- ACCESSORY ANALYSIS (per-sale; only accessory items; staff_profit = selling_price - admin_base_price, real_profit = selling_price - actual_cost for admin)
  // IMPORTANT: item.price is the ACTUAL selling price entered when making the sale, NOT admin_base_price
  const accessoryAnalysis = useMemo(() => {
    return todaysSales.map((sale) => {
      const accessoryItems = sale.items.filter((item) => isAccessorySaleItem(sale, item));
      const itemsBreakdown = accessoryItems.map((item) => {
        // item.price is the actual selling price that was entered when making the sale
        const actualSellingPrice = item.price;
        
        // Cost bases for profit calculation
        const adminBase = item.adminBasePrice ?? getCostPrice(item.name);
        const costForStaff = adminBase;
        const costForAdmin = item.actualCost ?? adminBase;
        const supplier = getSupplierForItem(item.name);
        
        // Profit calculation: selling_price - cost (NOT admin_base_price - cost)
        const staffProfit = item.qty * (actualSellingPrice - costForStaff);
        const realProfit = isAdmin ? item.qty * (actualSellingPrice - costForAdmin) : staffProfit;
        
        return {
          itemName: item.name,
          qty: item.qty,
          sellingPrice: actualSellingPrice, // This is the actual selling price, not admin_base_price
          costPrice: isAdmin ? costForAdmin : costForStaff,
          totalRevenue: item.qty * actualSellingPrice,
          totalCost: item.qty * (isAdmin ? costForAdmin : costForStaff),
          profit: realProfit,
          staffProfit,
          supplier,
          fromRepair: sale.saleType === 'repair',
          repairId: sale.repairId,
        };
      });
      const revenue = itemsBreakdown.reduce((s, i) => s + i.totalRevenue, 0);
      const totalCost = itemsBreakdown.reduce((s, i) => s + i.totalCost, 0);
      const profit = itemsBreakdown.reduce((s, i) => s + i.profit, 0);
      return { sale, revenue, itemsBreakdown, totalCost, profit };
    }).filter((aa) => aa.itemsBreakdown.length > 0);
  }, [todaysSales, inventoryItems, purchases, isAdmin, suppliers]);

  // --- IN-STOCK ACCESSORIES: total amount sold at (selling price)
  const inStockAccessorySummary = useMemo(() => {
    let amountSoldAt = 0;
    const items: string[] = [];
    accessoryAnalysis.forEach((aa) => {
      aa.itemsBreakdown.forEach((item) => {
        if (item.supplier !== 'Own Inventory') return;
        amountSoldAt += item.totalRevenue;
        if (!items.includes(item.itemName)) items.push(item.itemName);
      });
    });
    return { amountSoldAt, items };
  }, [accessoryAnalysis]);

  // --- SUPPLIER SUMMARY (outsourced only; in-stock shown separately with "Amount (sold at)")
  const supplierSummary = useMemo(() => {
    const map: Record<string, { name: string; partsCost: number; items: string[]; repairCount: number; accessoryCount: number }> = {};

    repairAnalysis.forEach(ra => {
      ra.allParts.forEach(part => {
        if (part.supplier === 'Own Inventory') return;
        if (!map[part.supplier]) map[part.supplier] = { name: part.supplier, partsCost: 0, items: [], repairCount: 0, accessoryCount: 0 };
        map[part.supplier].partsCost += part.totalCost;
        if (!map[part.supplier].items.includes(part.itemName)) map[part.supplier].items.push(part.itemName);
        map[part.supplier].repairCount++;
      });
    });

    accessoryAnalysis.forEach(aa => {
      aa.itemsBreakdown.forEach(item => {
        if (item.supplier === 'Own Inventory') return;
        if (!map[item.supplier]) map[item.supplier] = { name: item.supplier, partsCost: 0, items: [], repairCount: 0, accessoryCount: 0 };
        map[item.supplier].partsCost += item.totalCost;
        if (!map[item.supplier].items.includes(item.itemName)) map[item.supplier].items.push(item.itemName);
        map[item.supplier].accessoryCount++;
      });
    });

    return Object.values(map).sort((a, b) => b.partsCost - a.partsCost);
  }, [repairAnalysis, accessoryAnalysis]);

  // Accessory line items from repair invoices (unified: from sales with saleType 'repair')
  const accessoryPartsFromRepairs = useMemo(() => {
    const list: Array<{ itemName: string; qty: number; sellingPrice: number; supplier: string; repairId?: string }> = [];
    todaysSales.filter((s) => s.saleType === 'repair').forEach((sale) => {
      sale.items.forEach((item) => {
        list.push({
          itemName: item.name,
          qty: item.qty,
          sellingPrice: item.price,
          supplier: getSupplierForItem(item.name),
          repairId: sale.repairId,
        });
      });
    });
    return list;
  }, [todaysSales]);

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

  // Repairs with outsourced parts that have no cost entered — staff cannot send report until these are filled
  const incompleteOutsourced = useMemo(() => {
    const list: Array<{ repairId: string; ticket?: string; customerName: string; itemNames: string[] }> = [];
    repairAnalysis.forEach((ra) => {
      const missing = ra.allParts
        .filter((p) => p.source === 'outsourced' && (p.totalCost === 0 || p.costPerUnit === 0))
        .map((p) => p.itemName);
      if (missing.length > 0) {
        list.push({
          repairId: ra.repair.id,
          ticket: ra.repair.ticketNumber,
          customerName: ra.repair.customerName,
          itemNames: missing,
        });
      }
    });
    return list;
  }, [repairAnalysis]);

  const canSendReport = incompleteOutsourced.length === 0;
  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // --- BUILD REPORT TEXT ---
  const buildReportText = (bold: boolean) => {
    const b = (s: string) => bold ? `*${s}*` : s;
    let text = '';
    text += `${b('DAILY REPORT')} ${formatDate(new Date())}\n\n`;

    text += `${b('SUMMARY')}\n`;
    text += `Accessories:${todaysSales.length} | Repairs:${filteredRepairs.length}\n`;
    text += `Revenue:KES ${totals.totalRevenue.toLocaleString()} | Cost:KES ${totals.totalCosts.toLocaleString()}\n`;
    text += `${b('Profit:KES ' + totals.totalProfit.toLocaleString())}\n`;
    text += `Deposited:KES ${report.totalDeposited.toLocaleString()}\n`;

    if (repairAnalysis.length > 0) {
      text += `\n${b('REPAIRS')}\n`;
      repairAnalysis.forEach((ra, idx) => {
        const r = ra.repair;
        text += `${idx + 1}.${r.customerName}-${r.phoneModel}`;
        if (r.ticketNumber) text += ` ${r.ticketNumber}`;
        text += `\n`;
        text += `${r.issue}`;
        if (r.serviceType) text += ` (${r.serviceType})`;
        text += ` |Rev:${ra.revenue.toLocaleString()}\n`;
        if (ra.allParts.length > 0) {
          ra.allParts.forEach(p => {
            const costStr = p.supplier === 'Own Inventory' ? '-' : (p.totalCost > 0 ? `KES ${p.totalCost.toLocaleString()}` : '?');
            text += `-${p.itemName} x${p.qty} ${costStr} (${getSupplierDisplay(p.supplier)})\n`;
          });
        }
        const splitPayments = (r.pendingTransactionCodes as any)?.splitPayments;
        if (splitPayments && splitPayments.length > 0) {
          text += `Payment: Partial/Split – `;
          text += splitPayments.map((p: any) => `${(p.method || '').replace(/_/g, ' ')} KES ${(p.amount || 0).toLocaleString()}`).join(', ');
          text += `\n`;
        }
        text += `Cost:${ra.totalCost.toLocaleString()} ${b('Profit:' + ra.profit.toLocaleString())}\n`;
      });
    }

    if (accessoryAnalysis.length > 0) {
      text += `\n${b('ACCESSORIES')}\n`;
      accessoryAnalysis.forEach((aa, idx) => {
        text += `${idx + 1}.${aa.sale.saleType === 'wholesale' ? 'W/sale' : 'Retail'}`;
        if (aa.sale.paymentType) text += ` |${aa.sale.paymentType}`;
        text += `\n`;
        aa.itemsBreakdown.forEach(item => {
          const fromShop = item.supplier === 'Own Inventory';
          const costStr = fromShop ? '' : ` KES ${item.costPrice.toLocaleString()}`;
          text += `-${item.itemName} x${item.qty}${costStr} (${getSupplierDisplay(item.supplier)})\n`;
        });
        text += `Rev:${aa.revenue.toLocaleString()} Cost:${aa.totalCost.toLocaleString()} ${b('Profit:' + aa.profit.toLocaleString())}\n`;
      });
    }

    if (inStockAccessorySummary.items.length > 0 || supplierSummary.length > 0) {
      text += `\n${b('SUPPLIERS / IN-STOCK')}\n`;
      if (inStockAccessorySummary.items.length > 0) {
        text += `${getSupplierDisplay('Own Inventory')}: KES ${inStockAccessorySummary.amountSoldAt.toLocaleString()} (sold at)\n`;
      }
      supplierSummary.forEach(s => {
        text += `${s.name}: KES ${s.partsCost.toLocaleString()}\n`;
      });
    }

    // Transaction References
    if (report.transactionReferences.length > 0) {
      text += `${b('TRANSACTIONS')}\n`;
      report.transactionReferences.forEach((ref, idx) => {
        text += `${idx + 1}. ${ref.method.toUpperCase()}: ${ref.reference} - KES ${ref.amount.toLocaleString()}`;
        if (ref.bank) text += ` (${ref.bank})`;
        text += `\n`;
      });
      text += `\n`;
    }

    text += `${b('End of Report')}`;
    return text;
  };

  const blockSendMessage = () => {
    const lines = incompleteOutsourced.map(
      (r) => `• ${r.customerName}${r.ticket ? ` (${r.ticket})` : ''}: ${r.itemNames.join(', ')} — cost not entered`
    );
    alert(
      "You cannot send the daily report until all outsourced parts have their cost entered.\n\n" +
      "Repairs with missing outsourced cost:\n\n" +
      lines.join("\n") +
      "\n\nGo to Cost of Parts (or the repair ticket) and enter the cost for each outsourced item, then try again."
    );
  };

  const handleShareWhatsApp = () => {
    // Double-check: prevent execution if report cannot be sent
    if (!canSendReport || incompleteOutsourced.length > 0) {
      blockSendMessage();
      return;
    }
    const text = buildReportText(true);
    const targetPhone = whatsAppNumber.trim() || undefined;
    shareViaWhatsApp(text, targetPhone);
  };

  const handleShareToGroup = () => {
    // Double-check: prevent execution if report cannot be sent
    if (!canSendReport || incompleteOutsourced.length > 0) {
      blockSendMessage();
      return;
    }
    const text = buildReportText(true);
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const handleShareEmail = () => {
    // Double-check: prevent execution if report cannot be sent
    if (!canSendReport || incompleteOutsourced.length > 0) {
      blockSendMessage();
      return;
    }
    const subject = `Daily Sales Report - ${formatDate(new Date())}`;
    const body = buildReportText(false);
    shareViaEmail(subject, body);
  };

  const fullyPaidRepairs = filteredRepairs.filter(r => r.paymentStatus === 'fully_paid').length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Daily Report - Detailed Repair Sales</h1>
        <div className="flex gap-3 items-center flex-wrap">
          <Link to="/pending-collections/fully-paid" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm">
            View Fully Paid ({fullyPaidRepairs})
          </Link>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Direct number (optional)</label>
            <input type="tel" placeholder="+254712345678" value={whatsAppNumber} onChange={(e) => setWhatsAppNumber(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm w-40" />
          </div>
          <button 
            onClick={handleShareWhatsApp} 
            disabled={!canSendReport} 
            className={`px-4 py-2 rounded text-sm transition ${
              canSendReport 
                ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer' 
                : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
            }`}
            title={!canSendReport ? "Enter outsourced part costs first" : undefined}
          >
            Send to Number
          </button>
          <button 
            onClick={handleShareToGroup} 
            disabled={!canSendReport} 
            className={`px-4 py-2 rounded text-sm transition ${
              canSendReport 
                ? 'bg-green-700 text-white hover:bg-green-800 cursor-pointer' 
                : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
            }`}
            title={!canSendReport ? "Enter outsourced part costs first" : undefined}
          >
            Send to WhatsApp Group
          </button>
          <button 
            onClick={handleShareEmail} 
            disabled={!canSendReport} 
            className={`px-4 py-2 rounded text-sm transition ${
              canSendReport 
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
            }`}
            title={!canSendReport ? "Enter outsourced part costs first" : undefined}
          >
            Email Report
          </button>
        </div>
      </div>

      {/* Block send when outsourced parts have no cost */}
      {!canSendReport && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
          <p className="font-semibold text-amber-900">Report cannot be sent yet</p>
          <p className="text-sm text-amber-800 mt-1">
            Some repairs today use outsourced parts whose cost has not been entered. Enter the cost for each outsourced item before sending the daily report (WhatsApp or Email).
          </p>
          <ul className="text-sm text-amber-800 mt-2 list-disc list-inside">
            {incompleteOutsourced.map((r) => (
              <li key={r.repairId}>
                {r.customerName}{r.ticket ? ` (${r.ticket})` : ""}: {r.itemNames.join(", ")} — cost not entered
              </li>
            ))}
          </ul>
          <Link to="/cost-of-parts" className="inline-block mt-3 bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700">
            Go to Cost of Parts →
          </Link>
        </div>
      )}

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

      {/* Supplier Costs Summary: in-stock accessories (selling price) + outsourced supplier costs */}
      {(inStockAccessorySummary.items.length > 0 || supplierSummary.length > 0) && (
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
                  <th className="p-2 text-right">Total Cost / Amount (sold at)</th>
                </tr>
              </thead>
              <tbody>
                {inStockAccessorySummary.items.length > 0 && (
                  <tr className="border-t hover:bg-gray-50 bg-green-50/50">
                    <td className="p-2 font-semibold">{getSupplierDisplay('Own Inventory')}</td>
                    <td className="p-2 text-gray-600">{inStockAccessorySummary.items.join(', ')}</td>
                    <td className="p-2 text-center">—</td>
                    <td className="p-2 text-center">—</td>
                    <td className="p-2 text-right font-bold text-green-700">KES {inStockAccessorySummary.amountSoldAt.toLocaleString()} (sold at)</td>
                  </tr>
                )}
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
                  <td className="p-2" colSpan={4}>Total Supplier Costs (outsourced only)</td>
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
                      <p className="text-sm text-gray-600">{r.phoneModel} - {r.issue}{r.serviceType ? ` (${r.serviceType})` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Revenue: <span className="font-bold text-green-700">KES {ra.revenue.toLocaleString()}</span></p>
                      <p className="text-sm text-gray-600">Cost: <span className="font-bold text-red-600">KES {ra.totalCost.toLocaleString()}</span></p>
                      <p className={`text-sm font-bold ${ra.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        Profit: KES {ra.profit.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {ra.allParts.filter(p => !(p as { isAccessory?: boolean }).isAccessory).length > 0 && (
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Spare parts & supplier costs:</p>
                      <div className="space-y-1">
                        {ra.allParts.filter(p => !(p as { isAccessory?: boolean }).isAccessory).map((part, pidx) => (
                          <div key={pidx} className="flex justify-between items-center text-sm">
                            <div>
                              <span className="font-medium">{part.itemName}</span>
                              <span className="text-gray-500"> x{part.qty}</span>
                              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{getSupplierDisplay(part.supplier)}</span>
                              {part.supplier !== 'Own Inventory' && (
                                <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">Outsourced</span>
                              )}
                            </div>
                            <span className="font-semibold text-red-600">
                              {part.supplier === 'Own Inventory' ? '-' : (part.totalCost > 0 ? `KES ${part.totalCost.toLocaleString()}` : '-')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {ra.allParts.filter(p => (p as { isAccessory?: boolean }).isAccessory).length > 0 && (
                    <div className="bg-purple-50 rounded p-3 mt-2">
                      <p className="text-xs font-semibold text-purple-800 mb-2">Accessories attached (recorded in Detailed Accessory Sale):</p>
                      <div className="space-y-1">
                        {ra.allParts.filter(p => (p as { isAccessory?: boolean }).isAccessory).map((part, pidx) => (
                          <div key={pidx} className="flex justify-between items-center text-sm">
                            <span className="font-medium">{part.itemName}</span>
                            <span className="text-gray-500"> x{part.qty}</span>
                            <span className="text-green-700 font-semibold">KES {((part as { sellingPrice?: number }).sellingPrice ?? 0) * part.qty} (sold at)</span>
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

      {/* Detailed Accessory Sales (includes accessories from Sales page + accessories used in repairs) */}
      <div className="bg-white p-5 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Detailed Accessory Sales</h2>
        {accessoryPartsFromRepairs.length > 0 && (
          <div className="mb-6 border rounded-lg p-4 bg-purple-50/50">
            <p className="text-sm font-semibold text-purple-800 mb-2">Accessories used in repairs today</p>
            <div className="space-y-1">
              {accessoryPartsFromRepairs.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{p.itemName} x{p.qty}</span>
                  <span className="text-green-700 font-semibold">Sold at: KES {(p.sellingPrice * p.qty).toLocaleString()}</span>
                </div>
              ))}
              <p className="text-xs text-gray-600 mt-1">({getSupplierDisplay('Own Inventory')} – amount sold at, not cost)</p>
            </div>
          </div>
        )}
        {accessoryAnalysis.length === 0 && accessoryPartsFromRepairs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No accessory sales recorded today.</p>
        ) : accessoryAnalysis.length === 0 ? null : (
          <div className="space-y-4">
            {accessoryAnalysis.map((aa, idx) => (
              <div key={aa.sale.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {aa.sale.saleType === 'repair' ? 'From repair' : aa.sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'} #{idx + 1}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{new Date(aa.sale.date).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Revenue: <span className="font-bold text-green-700">KES {aa.revenue.toLocaleString()}</span></p>
                    <p className="text-sm text-gray-600">Cost: <span className="font-bold text-red-600">KES {aa.totalCost.toLocaleString()}</span></p>
                    <p className={`text-sm font-bold ${aa.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isAdmin ? 'Real profit' : 'Performance profit'}: KES {aa.profit.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{isAdmin ? 'selling_price − actual_cost' : 'selling_price − admin_base_price'}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded p-3">
                  <div className="space-y-1">
                    {aa.itemsBreakdown.map((item, iidx) => (
                        <div key={iidx} className="flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium">{item.itemName}</span>
                            <span className="text-gray-500"> x{item.qty}</span>
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{getSupplierDisplay(item.supplier)}</span>
                            {item.fromRepair && <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Repair</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-green-700 mr-3">Sold: KES {item.sellingPrice.toLocaleString()}</span>
                            {item.costPrice != null && item.costPrice > 0 ? (
                              <span className="text-red-600">Cost: KES {item.costPrice.toLocaleString()}</span>
                            ) : (
                              <span className="text-gray-500">Cost: —</span>
                            )}
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
