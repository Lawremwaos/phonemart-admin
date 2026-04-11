import { useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useRepair, type Repair } from "../context/RepairContext";
import { useInventory } from "../context/InventoryContext";
import { usePayment } from "../context/PaymentContext";
import { useShop } from "../context/ShopContext";
import { shareViaWhatsApp } from "../utils/receiptUtils";

/** Additional repair items: trust explicit source; never infer "our stock" from name match alone. */
function classifyAdditionalItem(a: NonNullable<Repair["additionalItems"]>[number]): "outsourced" | "inventory" {
  const src = (a.source || "").toString().toLowerCase();
  if (src === "outsourced") return "outsourced";
  if (src === "inventory") return "inventory";
  if (a.supplierName && a.supplierName.trim()) return "outsourced";
  return "inventory";
}

function getAdditionalItemReportCost(
  r: Repair,
  a: NonNullable<Repair["additionalItems"]>[number],
  inventoryItems: Array<{ id: number; name: string; adminCostPrice?: number; costPrice?: number }>,
  getItemCost: (inv: { adminCostPrice?: number; costPrice?: number } | undefined) => number
): number {
  const matchPart = r.partsUsed.find((p) => p.itemName.toLowerCase() === a.itemName.toLowerCase());
  if (matchPart) return matchPart.cost * matchPart.qty;
  if (classifyAdditionalItem(a) === "inventory") {
    const inv = inventoryItems.find(
      (i) => (a.itemId != null && i.id === a.itemId) || i.name.toLowerCase() === a.itemName.toLowerCase()
    );
    return getItemCost(inv);
  }
  return 0;
}

export default function AutomatedDailyReport() {
  const { getDailySales, getDailyRevenue } = useSales();
  const { repairs } = useRepair();
  const { items: inventoryItems, purchases } = useInventory();
  const { getTotalCashCollected, getTotalMpesaCollected, getTotalBankDeposits, getPendingCashDeposits } = usePayment();
  const { currentShop, currentUser } = useShop();
  const isAdmin = currentUser?.roles.includes('admin') ?? false;

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

  // Staff never see admin cost. Use costPrice only for staff; admin can see adminCostPrice.
  const getItemCost = (inv: { adminCostPrice?: number; costPrice?: number } | undefined): number => {
    if (!inv) return 0;
    if (!isAdmin) return inv.costPrice ?? 0;
    return inv.adminCostPrice ?? inv.costPrice ?? 0;
  };

  // Calculate actual parts cost from persisted repair data
  const todayPartsCost = useMemo(() => {
    return todayRepairs.reduce((sum, r) => {
      const partsCost = r.partsUsed.reduce((s, p) => s + (p.cost * p.qty), 0);
      const inventoryAdditionalCost = (r.additionalItems || [])
        .filter((item) => classifyAdditionalItem(item) === "inventory")
        .reduce((s, item) => {
          const inv = inventoryItems.find((i) => i.id === item.itemId || i.name.toLowerCase() === item.itemName.toLowerCase());
          return s + getItemCost(inv);
        }, 0);
      return sum + partsCost + inventoryAdditionalCost;
    }, 0);
  }, [todayRepairs, inventoryItems, isAdmin]);

  // Calculate accessory cost from inventory data (staff don't see admin cost)
  const todayAccessoryCost = useMemo(() => {
    let cost = 0;
    dailySales.forEach(sale => {
      sale.items.forEach(item => {
        const inv = inventoryItems.find(i => i.name.toLowerCase() === item.name.toLowerCase());
        cost += getItemCost(inv) * item.qty;
      });
    });
    return cost;
  }, [dailySales, inventoryItems, isAdmin]);

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

  const getSupplierDisplay = (supplier: string): string =>
    supplier === 'Own Inventory' ? 'From the shop' : supplier;

  // Accessory sale breakdown by type
  const retailSales = dailySales.filter(s => s.saleType === 'retail' || s.saleType === 'in-shop');
  const wholesaleSales = dailySales.filter(s => s.saleType === 'wholesale');
  const retailCount = retailSales.length;
  const wholesaleCount = wholesaleSales.length;
  const retailRevenue = retailSales.reduce((sum, s) => sum + s.total, 0);
  const wholesaleRevenue = wholesaleSales.reduce((sum, s) => sum + s.total, 0);

  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const shopLabel = currentShop?.name || 'PHONEMART';

  /** Part 1: Accessories Daily Report */
  const generateAccessoriesReport = () => {
    let report = `*PHONEMART (${shopLabel}) ACCESSORIES DAILY REPORT*\n`;
    report += `${todayStr}\n\n`;

    report += `*ACCESSORIES SUMMARY*\n\n`;

    report += `*Wholesale:*\n`;
    if (wholesaleSales.length === 0) {
      report += `(None)\n`;
    } else {
      wholesaleSales.forEach((sale) => {
        sale.items.forEach((item) => {
          report += `• ${item.name} x${item.qty} @ KES ${item.price.toLocaleString()} = KES ${(item.qty * item.price).toLocaleString()}\n`;
        });
      });
    }

    const usedInRepairOurOwn: Array<{ name: string; qty: number; totalCost: number }> = [];
    const usedInRepairOutsource: Array<{ name: string; qty: number; supplier?: string; totalCost: number }> = [];
    todayRepairs.forEach((r) => {
      r.partsUsed.forEach((p) => {
        const supplier = getSupplierForItem(p.itemName, p.supplierName);
        const lineCost = p.cost * p.qty;
        const lk = p.lineKind ?? "spare_part";
        const isService = lk === "service";
        const isOutsource = isService
          ? Boolean(p.supplierName?.trim())
          : p.source === "outsourced" || Boolean(p.supplierName) || (supplier && supplier !== "Own Inventory");
        if (isOutsource) {
          const supLabel = isService ? p.supplierName?.trim() || supplier : supplier;
          const existing = usedInRepairOutsource.find((x) => x.name === p.itemName && x.supplier === supLabel);
          if (existing) {
            existing.qty += p.qty;
            existing.totalCost += lineCost;
          } else usedInRepairOutsource.push({ name: p.itemName, qty: p.qty, supplier: supLabel, totalCost: lineCost });
        } else {
          const existing = usedInRepairOurOwn.find((x) => x.name === p.itemName);
          if (existing) {
            existing.qty += p.qty;
            existing.totalCost += lineCost;
          } else usedInRepairOurOwn.push({ name: p.itemName, qty: p.qty, totalCost: lineCost });
        }
      });
      (r.additionalItems || []).forEach((a) => {
        const kind = classifyAdditionalItem(a);
        const lineCost = getAdditionalItemReportCost(r, a, inventoryItems, getItemCost);
        const supplierLabel = a.supplierName?.trim() || "Outsourced";
        if (kind === "outsourced") {
          const existing = usedInRepairOutsource.find((x) => x.name === a.itemName && x.supplier === supplierLabel);
          if (existing) {
            existing.qty += 1;
            existing.totalCost += lineCost;
          } else usedInRepairOutsource.push({ name: a.itemName, qty: 1, supplier: supplierLabel, totalCost: lineCost });
        } else {
          const existing = usedInRepairOurOwn.find((x) => x.name === a.itemName);
          if (existing) {
            existing.qty += 1;
            existing.totalCost += lineCost;
          } else usedInRepairOurOwn.push({ name: a.itemName, qty: 1, totalCost: lineCost });
        }
      });
    });

    report += `\n*Used in Repair Sale:*\n`;
    report += `Our inventory:\n`;
    if (usedInRepairOurOwn.length === 0) {
      report += `(None)\n`;
    } else {
      usedInRepairOurOwn.forEach((item) => {
        report += `• ${item.name} x${item.qty} — our stock — cost KES ${item.totalCost.toLocaleString()}\n`;
      });
    }
    report += `Outsourced:\n`;
    if (usedInRepairOutsource.length === 0) {
      report += `(None)\n`;
    } else {
      usedInRepairOutsource.forEach((item) => {
        report += `• ${item.name} x${item.qty} — outsourced (${item.supplier || "Outsourced"}) — cost KES ${item.totalCost.toLocaleString()}\n`;
      });
    }

    const totalDeposit = cashCollected + mpesaCollected + bankDeposits;
    report += `\n*Total Deposit:* KES ${totalDeposit.toLocaleString()}`;
    if (pendingDepositsAmount > 0) report += `\n(Pending: KES ${pendingDepositsAmount.toLocaleString()})`;
    report += `\n`;

    return report;
  };

  /** Part 2: Repair Daily Report */
  const generateRepairReport = () => {
    let report = `*PHONEMART (${shopLabel}) REPAIR DAILY REPORT*\n`;
    report += `${todayStr}\n\n`;

    report += `*REPAIR SALE SUMMARY*\n\n`;
    if (todayRepairs.length === 0) {
      report += `(No repairs today)\n\n`;
    } else {
      todayRepairs.forEach((r) => {
        const revenue = r.totalAgreedAmount || r.totalCost;
        const partsCost = r.partsUsed.reduce((s, p) => s + (p.cost * p.qty), 0);
        const additionalCost = (r.additionalItems || []).reduce((sum, item) => {
          if (classifyAdditionalItem(item) === "inventory") {
            const inv = inventoryItems.find((i) => i.id === item.itemId || i.name.toLowerCase() === item.itemName.toLowerCase());
            return sum + getItemCost(inv);
          }
          return sum;
        }, 0);
        const totalPartCost = partsCost + additionalCost;
        const profit = revenue - totalPartCost;

        report += `${r.customerName} - ${r.phoneModel}\n`;
        report += `Parts & items: `;
        const partsList: string[] = r.partsUsed.map((p) => {
          const lineCost = p.cost * p.qty;
          const supplier = getSupplierForItem(p.itemName, p.supplierName);
          const lk = p.lineKind ?? "spare_part";
          if (lk === "service") {
            const sup = p.supplierName?.trim();
            const src = sup
              ? `service — supplier: ${getSupplierDisplay(sup)}`
              : "service (in-house / no supplier)";
            return `${p.itemName} [${src}] cost KES ${lineCost.toLocaleString()}`;
          }
          const isOut =
            p.source === "outsourced" || p.supplierName || (supplier && supplier !== "Own Inventory");
          const kindTag = lk === "accessory" ? "accessory" : "spare";
          const src = isOut
            ? `outsourced ${kindTag} (${getSupplierDisplay(supplier)})`
            : `${kindTag} — our inventory`;
          return `${p.itemName} [${src}] cost KES ${lineCost.toLocaleString()}`;
        });
        (r.additionalItems || []).forEach((a) => {
          const kind = classifyAdditionalItem(a);
          const c = getAdditionalItemReportCost(r, a, inventoryItems, getItemCost);
          if (kind === "outsourced") {
            const sup = a.supplierName?.trim() || "outsourced";
            partsList.push(`${a.itemName} [outsourced: ${sup}] cost KES ${c.toLocaleString()}`);
          } else {
            partsList.push(`${a.itemName} [our inventory] cost KES ${c.toLocaleString()}`);
          }
        });
        report += partsList.length ? partsList.join("; ") : '(None)';
        report += `\n`;
        report += `Revenue: KES ${revenue.toLocaleString()}\n`;
        const splitPayments = (r.pendingTransactionCodes as any)?.splitPayments;
        if (splitPayments && splitPayments.length > 0) {
          report += `Payment: Partial/Split – `;
          report += splitPayments.map((p: any) => `${(p.method || '').replace(/_/g, ' ')} KES ${(p.amount || 0).toLocaleString()}`).join(', ');
          report += `\n`;
        }
        report += `Part cost: KES ${totalPartCost.toLocaleString()}\n`;
        report += `Profit: KES ${profit.toLocaleString()}\n\n`;
      });
    }

    report += `*SUPPLIER COST*\n\n`;
    const bySupplier = new Map<string, Array<{ name: string; qty: number; total: number }>>();
    todayRepairs.forEach((r) => {
      r.partsUsed.forEach((p) => {
        const supplier = getSupplierForItem(p.itemName, p.supplierName);
        const lk = p.lineKind ?? "spare_part";
        const key =
          lk === "service"
            ? p.supplierName?.trim() || (supplier && supplier !== "Own Inventory" ? supplier : null)
            : supplier && supplier !== "Own Inventory"
              ? supplier
              : null;
        if (key) {
          if (!bySupplier.has(key)) bySupplier.set(key, []);
          const arr = bySupplier.get(key)!;
          const total = p.cost * p.qty;
          const existing = arr.find((x) => x.name === p.itemName);
          if (existing) {
            existing.qty += p.qty;
            existing.total += total;
          } else arr.push({ name: p.itemName, qty: p.qty, total });
        }
      });
      (r.additionalItems || []).forEach((a) => {
        if (classifyAdditionalItem(a) !== "outsourced") return;
        const hasPartRow = r.partsUsed.some((p) => p.itemName.toLowerCase() === a.itemName.toLowerCase());
        if (hasPartRow) return;
        const supplier = a.supplierName?.trim() || "Outsourced";
        if (supplier === "Own Inventory") return;
        const total = getAdditionalItemReportCost(r, a, inventoryItems, getItemCost);
        if (!bySupplier.has(supplier)) bySupplier.set(supplier, []);
        const arr = bySupplier.get(supplier)!;
        const existing = arr.find((x) => x.name === a.itemName);
        if (existing) {
          existing.qty += 1;
          existing.total += total;
        } else arr.push({ name: a.itemName, qty: 1, total });
      });
    });
    if (bySupplier.size === 0) {
      report += `(No outsourced parts)\n`;
    } else {
      bySupplier.forEach((lines, supplierName) => {
        report += `${supplierName}\n`;
        let supplierTotal = 0;
        lines.forEach((line) => {
          supplierTotal += line.total;
          report += `• ${line.name} x${line.qty}: KES ${line.total.toLocaleString()}\n`;
        });
        report += `Total amount to pay: KES ${supplierTotal.toLocaleString()}\n\n`;
      });
    }

    return report;
  };

  const generateDailyReport = () => {
    const part1 = generateAccessoriesReport();
    const part2 = generateRepairReport();
    return `${part1}\n━━━━━━━━━━━━━━━━━━━━\n*PART 2: REPAIR*\n━━━━━━━━━━━━━━━━━━━━\n\n${part2}\n_End of Report_`;
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

  const handleSendAccessoriesOnly = () => {
    const report = generateAccessoriesReport();
    shareViaWhatsApp(report, currentShop?.phone || undefined);
  };

  const handleSendRepairOnly = () => {
    const report = generateRepairReport();
    shareViaWhatsApp(report, currentShop?.phone || undefined);
  };

  const totalRevenue = dailyRevenue + todayRepairRevenue;
  const grossProfit = totalRevenue - totalCosts;

  // Check for all missing item costs before allowing report send. Staff only need costPrice (not admin cost).
  const repairsWithMissingCosts = useMemo(() => {
    return todayRepairs
      .filter(r => r.status === 'COLLECTED' || r.paymentApproved)
      .map(r => {
        const missingOutsourcedParts = r.partsUsed.filter(p =>
          (p.source === 'outsourced' || p.supplierName) && p.cost <= 0
        );
        const missingInHouseParts = r.partsUsed.filter((p) => {
          if (p.source !== 'in-house') return false;
          if (p.cost > 0) return false;
          const inv = inventoryItems.find((i) => i.id === p.itemId || i.name.toLowerCase() === p.itemName.toLowerCase());
          const inventoryCost = getItemCost(inv);
          return inventoryCost <= 0;
        });
        const missingAdditional = (r.additionalItems || []).filter(item =>
          classifyAdditionalItem(item) === 'outsourced' &&
          !r.partsUsed.some(p => p.itemName === item.itemName && p.cost > 0)
        );
        const missingInventoryAdditional = (r.additionalItems || []).filter((item) => {
          if (classifyAdditionalItem(item) !== 'inventory') return false;
          const inv = inventoryItems.find((i) => i.id === item.itemId || i.name.toLowerCase() === item.itemName.toLowerCase());
          return getItemCost(inv) <= 0;
        });
        if (
          missingOutsourcedParts.length === 0 &&
          missingInHouseParts.length === 0 &&
          missingAdditional.length === 0 &&
          missingInventoryAdditional.length === 0
        ) return null;

        return {
          repair: r,
          missingParts: [
            ...missingOutsourcedParts.map(p => `${p.itemName} (outsourced)`),
            ...missingInHouseParts.map(p => `${p.itemName} (in-house)`),
            ...missingAdditional.map(a => `${a.itemName} (outsourced additional)`),
            ...missingInventoryAdditional.map(a => `${a.itemName} (inventory additional)`),
          ],
        };
      })
      .filter(Boolean) as Array<{ repair: typeof todayRepairs[0]; missingParts: string[] }>;
  }, [todayRepairs, inventoryItems, isAdmin]);

  const salesItemsMissingCosts = useMemo(() => {
    return dailySales
      .flatMap((sale) =>
        sale.items.map((saleItem) => {
          const inv = inventoryItems.find((i) => i.name.toLowerCase() === saleItem.name.toLowerCase());
          const cost = getItemCost(inv);
          return {
            name: saleItem.name,
            cost,
          };
        })
      )
      .filter((entry) => entry.cost <= 0)
      .reduce((unique, entry) => {
        if (!unique.some((u) => u.name.toLowerCase() === entry.name.toLowerCase())) {
          unique.push(entry);
        }
        return unique;
      }, [] as Array<{ name: string; cost: number }>);
  }, [dailySales, inventoryItems, isAdmin]);

  const hasMissingCosts = repairsWithMissingCosts.length > 0 || salesItemsMissingCosts.length > 0;

  const handleSendWithCheck = (sendFn: () => void) => {
    if (hasMissingCosts) {
      const names = repairsWithMissingCosts.map(r =>
        `- ${r.repair.customerName} (${r.repair.phoneModel}): ${r.missingParts.join(', ')}`
      ).join('\n');
      const salesMissing = salesItemsMissingCosts.map((item) => `- ${item.name}`).join('\n');
      let message = "Cannot send report. Some used items do not have costs.\n\n";
      if (names) {
        message += `Repairs with missing costs:\n${names}\n\n`;
      }
      if (salesMissing) {
        message += `Sales items missing inventory cost:\n${salesMissing}\n\n`;
      }
      message += "Please fill in all costs first so profit is accurate.";
      alert(message);
      return;
    }
    sendFn();
  };

  return (
    <div className="pm-card pm-pad-lg">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold">End-of-Day Report (Two Parts)</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSendWithCheck(handleSendReport)}
            disabled={hasMissingCosts}
            className={`px-3 py-2 rounded text-sm text-white ${hasMissingCosts ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            title="Sends Accessories + Repair in one message"
          >
            Send Full to Number
          </button>
          <button
            onClick={() => handleSendWithCheck(handleSendToGroup)}
            disabled={hasMissingCosts}
            className={`px-3 py-2 rounded text-sm text-white ${hasMissingCosts ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-700 hover:bg-green-800'}`}
            title="Sends Accessories + Repair in one message"
          >
            Send Full to Group
          </button>
          <button
            onClick={() => handleSendWithCheck(handleSendAccessoriesOnly)}
            disabled={hasMissingCosts}
            className={`px-3 py-2 rounded text-sm text-white border border-green-600 ${hasMissingCosts ? 'bg-gray-400 cursor-not-allowed border-gray-400' : 'bg-white text-green-700 hover:bg-green-50'}`}
            title="Part 1: Accessories only"
          >
            Part 1: Accessories
          </button>
          <button
            onClick={() => handleSendWithCheck(handleSendRepairOnly)}
            disabled={hasMissingCosts}
            className={`px-3 py-2 rounded text-sm text-white border border-green-600 ${hasMissingCosts ? 'bg-gray-400 cursor-not-allowed border-gray-400' : 'bg-white text-green-700 hover:bg-green-50'}`}
            title="Part 2: Repair only"
          >
            Part 2: Repair
          </button>
        </div>
      </div>

      {hasMissingCosts && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
          <p className="text-sm font-semibold text-red-800 mb-1">Cannot send report — item costs missing</p>
          <ul className="text-xs text-red-700 space-y-1">
            {repairsWithMissingCosts.map(r => (
              <li key={r.repair.id}>
                <span className="font-medium">{r.repair.customerName}</span> ({r.repair.phoneModel}): {r.missingParts.join(', ')}
              </li>
            ))}
            {salesItemsMissingCosts.map((item) => (
              <li key={`sale-${item.name}`}>
                <span className="font-medium">Sales Item:</span> {item.name} (inventory cost missing)
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-600 mt-2">Go to <a href="/cost-of-parts" className="underline font-semibold">Cost of Parts</a> for outsourced costs and ensure inventory items have admin/cost price in stock management.</p>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Accessory Sales ({dailySales.length}):</span>
          <span className="font-semibold">KES {dailyRevenue.toLocaleString()}</span>
        </div>
        {retailCount > 0 && (
          <div className="flex justify-between pl-3 text-xs text-gray-500">
            <span>Retail: {retailCount}</span>
            <span>KES {retailRevenue.toLocaleString()}</span>
          </div>
        )}
        {wholesaleCount > 0 && (
          <div className="flex justify-between pl-3 text-xs text-gray-500">
            <span>Wholesale: {wholesaleCount}</span>
            <span>KES {wholesaleRevenue.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">Repair Sales ({todayRepairs.length}):</span>
          <span className="font-semibold">KES {todayRepairRevenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="font-semibold">Total Revenue:</span>
          <span className="font-bold">KES {totalRevenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-red-600">
          <span>Total Cost:</span>
          <span className="font-semibold">KES {totalCosts.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="font-semibold">Total Profit:</span>
          <span className={`font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            KES {grossProfit.toLocaleString()}
          </span>
        </div>
        <div className="border-t pt-2">
          <span className="text-gray-600 font-medium">Deposited:</span>
          {cashCollected > 0 && (
            <div className="flex justify-between pl-3 text-xs text-gray-500">
              <span>Cash:</span><span>KES {cashCollected.toLocaleString()}</span>
            </div>
          )}
          {mpesaCollected > 0 && (
            <div className="flex justify-between pl-3 text-xs text-gray-500">
              <span>MPESA:</span><span>KES {mpesaCollected.toLocaleString()}</span>
            </div>
          )}
          {bankDeposits > 0 && (
            <div className="flex justify-between pl-3 text-xs text-gray-500">
              <span>Bank:</span><span>KES {bankDeposits.toLocaleString()}</span>
            </div>
          )}
          {pendingDepositsAmount > 0 && (
            <div className="flex justify-between pl-3 text-xs text-orange-600">
              <span>Pending:</span><span>KES {pendingDepositsAmount.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
