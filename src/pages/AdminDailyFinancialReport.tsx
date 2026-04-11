import { useMemo, useState } from "react";
import { useSales } from "../context/SalesContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { useRepair } from "../context/RepairContext";

export default function AdminDailyFinancialReport() {
  const { sales } = useSales();
  const { items } = useInventory();
  const { currentUser } = useShop();
  const { repairs } = useRepair();

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().split("T")[0]
  );

  if (!currentUser?.roles.includes("admin")) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p>Only administrators can access this report.</p>
        </div>
      </div>
    );
  }

  const targetDate = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const dailySales = useMemo(() => {
    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === targetDate.getTime();
    });
  }, [sales, targetDate]);

  // Get actual cost for an item (admin-only; real buying price)
  const getActualCost = (itemName: string): number => {
    const inv = items.find(
      (i) => i.name.toLowerCase() === itemName.toLowerCase()
    );
    return inv?.actualCost ?? inv?.adminCostPrice ?? inv?.costPrice ?? 0;
  };

  const totals = useMemo(() => {
    let revenue = 0;
    let totalCost = 0;
    let itemsSold = 0;
    dailySales.forEach((sale) => {
      revenue += sale.total;
      sale.items.forEach((item) => {
        itemsSold += item.qty;
        const cost = getActualCost(item.name);
        totalCost += cost * item.qty;
      });
    });
    const profit = revenue - totalCost;
    return { revenue, totalCost, profit, itemsSold };
  }, [dailySales, items]);

  const perProduct = useMemo(() => {
    const map = new Map<
      string,
      { revenue: number; cost: number; qty: number; profit: number }
    >();
    dailySales.forEach((sale) => {
      sale.items.forEach((item) => {
        const key = item.name;
        const costPerUnit = getActualCost(item.name);
        const revenue = item.qty * item.price;
        const cost = costPerUnit * item.qty;
        const existing = map.get(key);
        if (existing) {
          existing.revenue += revenue;
          existing.cost += cost;
          existing.qty += item.qty;
          existing.profit += revenue - cost;
        } else {
          map.set(key, {
            revenue,
            cost,
            qty: item.qty,
            profit: revenue - cost,
          });
        }
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [dailySales, items]);

  const perStaff = useMemo(() => {
    const map = new Map<
      string,
      { revenue: number; cost: number; profit: number; sales: number }
    >();
    dailySales.forEach((sale) => {
      const staffName = sale.soldBy || "Unknown";
      let saleRevenue = 0;
      let saleCost = 0;
      sale.items.forEach((item) => {
        saleRevenue += item.qty * item.price;
        saleCost += getActualCost(item.name) * item.qty;
      });
      const existing = map.get(staffName);
      if (existing) {
        existing.revenue += saleRevenue;
        existing.cost += saleCost;
        existing.profit += saleRevenue - saleCost;
        existing.sales += 1;
      } else {
        map.set(staffName, {
          revenue: saleRevenue,
          cost: saleCost,
          profit: saleRevenue - saleCost,
          sales: 1,
        });
      }
    });
    return Array.from(map.entries()).map(([staff, data]) => ({
      staff,
      ...data,
    }));
  }, [dailySales, items]);

  const repairsForDate = useMemo(() => {
    return repairs.filter((repair) => {
      const repairDate = new Date(repair.date);
      repairDate.setHours(0, 0, 0, 0);
      return repairDate.getTime() === targetDate.getTime();
    });
  }, [repairs, targetDate]);

  const repairStockUsage = useMemo(() => {
    const map = new Map<string, { qty: number; count: number }>();

    for (const repair of repairsForDate) {
      for (const part of repair.partsUsed) {
        if (part.source !== "outsourced" && part.lineKind !== "service") {
          const key = part.itemName;
          const existing = map.get(key);
          if (existing) {
            existing.qty += part.qty;
            existing.count += 1;
          } else {
            map.set(key, { qty: part.qty, count: 1 });
          }
        }
      }
    }

    return Array.from(map.entries())
      .map(([itemName, data]) => ({ itemName, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [repairsForDate]);

  const accessoryStockBreakdown = useMemo(() => {
    const regular = new Map<string, number>();
    const wholesale = new Map<string, number>();

    const addQty = (bucket: Map<string, number>, name: string, qty: number) => {
      bucket.set(name, (bucket.get(name) ?? 0) + qty);
    };

    for (const sale of dailySales) {
      const isWholesale = sale.saleType === "wholesale";
      const bucket = isWholesale ? wholesale : regular;

      for (const item of sale.items) {
        let isAccessory = false;
        if (item.itemId != null) {
          const inv = items.find((invItem) => invItem.id === item.itemId);
          isAccessory = inv?.category === "Accessory";
        } else {
          const inv = items.find((invItem) => invItem.name.toLowerCase() === item.name.toLowerCase());
          isAccessory = inv?.category === "Accessory";
        }

        if (isAccessory) {
          addQty(bucket, item.name, item.qty);
        }
      }
    }

    const toRows = (bucket: Map<string, number>) =>
      Array.from(bucket.entries())
        .map(([itemName, qty]) => ({ itemName, qty }))
        .sort((a, b) => b.qty - a.qty);

    return {
      regularRows: toRows(regular),
      wholesaleRows: toRows(wholesale),
      regularTotal: Array.from(regular.values()).reduce((sum, qty) => sum + qty, 0),
      wholesaleTotal: Array.from(wholesale.values()).reduce((sum, qty) => sum + qty, 0),
    };
  }, [dailySales, items]);

  return (
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Finance</p>
          <h1 className="pm-page-title">Daily Financial Report</h1>
          <p className="pm-page-desc">Admin-only revenue, cost, and profit view using actual buying prices.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--pm-ink-soft)]">Date</label>
          <input
            type="date"
            className="pm-input pm-input-narrow"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-[var(--pm-ink-soft)]">
        Revenue and profit use real buying price (actual_cost) for calculations.
        Staff do not see actual cost or wholesale profit.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="pm-card pm-pad border-l-4 border-green-500">
          <p className="text-sm text-[var(--pm-ink-soft)]">Total Revenue</p>
          <p className="text-2xl font-bold text-green-700">
            KES {totals.revenue.toLocaleString()}
          </p>
        </div>
        <div className="pm-card pm-pad border-l-4 border-red-500">
          <p className="text-sm text-[var(--pm-ink-soft)]">Total Cost (actual)</p>
          <p className="text-2xl font-bold text-red-700">
            KES {totals.totalCost.toLocaleString()}
          </p>
        </div>
        <div className="pm-card pm-pad border-l-4 border-blue-500">
          <p className="text-sm text-[var(--pm-ink-soft)]">Total Profit</p>
          <p className={`text-2xl font-bold ${totals.profit >= 0 ? "text-blue-700" : "text-red-700"}`}>
            KES {totals.profit.toLocaleString()}
          </p>
        </div>
        <div className="pm-card pm-pad border-l-4 border-purple-500">
          <p className="text-sm text-[var(--pm-ink-soft)]">Items Sold</p>
          <p className="text-2xl font-bold text-purple-700">
            {totals.itemsSold}
          </p>
        </div>
      </div>

      {/* Breakdown per product */}
      <div className="pm-card pm-pad-0 overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b border-[var(--pm-border)]">Breakdown per Product</h2>
        <div className="pm-table-shell rounded-none border-x-0 border-b-0 border-t-0 shadow-none">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left font-medium">Product</th>
                <th className="p-3 text-right font-medium">Qty</th>
                <th className="p-3 text-right font-medium">Revenue (KES)</th>
                <th className="p-3 text-right font-medium">Cost (actual) (KES)</th>
                <th className="p-3 text-right font-medium">Profit (KES)</th>
              </tr>
            </thead>
            <tbody>
              {perProduct.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[var(--pm-ink-soft)]">
                    No sales for this date
                  </td>
                </tr>
              ) : (
                perProduct.map((row) => (
                  <tr key={row.name} className="border-t border-[var(--pm-border)] hover:bg-[var(--pm-surface-soft)]">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-right">{row.qty}</td>
                    <td className="p-3 text-right text-green-700">
                      {row.revenue.toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {row.cost.toLocaleString()}
                    </td>
                    <td className={`p-3 text-right font-semibold ${row.profit >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {row.profit.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pm-card pm-pad-0 overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b border-[var(--pm-border)]">Stock Usage Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <div className="pm-card pm-pad">
            <p className="text-sm text-[var(--pm-ink-soft)]">Repair Stock Used</p>
            <p className="text-2xl font-bold text-[var(--pm-ink)]">
              {repairStockUsage.reduce((sum, row) => sum + row.qty, 0)}
            </p>
          </div>
          <div className="pm-card pm-pad">
            <p className="text-sm text-[var(--pm-ink-soft)]">Accessory Regular (Qty)</p>
            <p className="text-2xl font-bold text-blue-700">{accessoryStockBreakdown.regularTotal}</p>
          </div>
          <div className="pm-card pm-pad">
            <p className="text-sm text-[var(--pm-ink-soft)]">Accessory Wholesale (Qty)</p>
            <p className="text-2xl font-bold text-purple-700">{accessoryStockBreakdown.wholesaleTotal}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 p-4 pt-0">
          <div className="pm-table-shell">
            <div className="p-3 border-b border-[var(--pm-border)] font-medium">Repair Side Stock Used</div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {repairStockUsage.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-3 text-center text-[var(--pm-ink-soft)]">No in-house repair stock usage</td>
                  </tr>
                ) : (
                  repairStockUsage.map((row) => (
                    <tr key={row.itemName} className="border-t border-[var(--pm-border)]">
                      <td className="p-3">{row.itemName}</td>
                      <td className="p-3 text-right font-semibold">{row.qty}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pm-table-shell">
            <div className="p-3 border-b border-[var(--pm-border)] font-medium">Accessories - Regular Sale</div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {accessoryStockBreakdown.regularRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-3 text-center text-[var(--pm-ink-soft)]">No regular accessory sales</td>
                  </tr>
                ) : (
                  accessoryStockBreakdown.regularRows.map((row) => (
                    <tr key={row.itemName} className="border-t border-[var(--pm-border)]">
                      <td className="p-3">{row.itemName}</td>
                      <td className="p-3 text-right font-semibold">{row.qty}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pm-table-shell">
            <div className="p-3 border-b border-[var(--pm-border)] font-medium">Accessories - Wholesale Sale</div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {accessoryStockBreakdown.wholesaleRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-3 text-center text-[var(--pm-ink-soft)]">No wholesale accessory sales</td>
                  </tr>
                ) : (
                  accessoryStockBreakdown.wholesaleRows.map((row) => (
                    <tr key={row.itemName} className="border-t border-[var(--pm-border)]">
                      <td className="p-3">{row.itemName}</td>
                      <td className="p-3 text-right font-semibold">{row.qty}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Breakdown per staff */}
      <div className="pm-card pm-pad-0 overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b border-[var(--pm-border)]">Breakdown per Staff</h2>
        <div className="pm-table-shell rounded-none border-x-0 border-b-0 border-t-0 shadow-none">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left font-medium">Staff</th>
                <th className="p-3 text-right font-medium">Sales</th>
                <th className="p-3 text-right font-medium">Revenue (KES)</th>
                <th className="p-3 text-right font-medium">Cost (actual) (KES)</th>
                <th className="p-3 text-right font-medium">Profit (KES)</th>
              </tr>
            </thead>
            <tbody>
              {perStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[var(--pm-ink-soft)]">
                    No sales for this date
                  </td>
                </tr>
              ) : (
                perStaff.map((row) => (
                  <tr key={row.staff} className="border-t border-[var(--pm-border)] hover:bg-[var(--pm-surface-soft)]">
                    <td className="p-3 font-medium">{row.staff}</td>
                    <td className="p-3 text-right">{row.sales}</td>
                    <td className="p-3 text-right text-green-700">
                      {row.revenue.toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {row.cost.toLocaleString()}
                    </td>
                    <td className={`p-3 text-right font-semibold ${row.profit >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {row.profit.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
