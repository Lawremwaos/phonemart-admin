import { useMemo, useState } from "react";
import { useSales } from "../context/SalesContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

export default function AdminDailyFinancialReport() {
  const { sales } = useSales();
  const { items } = useInventory();
  const { currentUser } = useShop();

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Daily Financial Report (Admin)</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Revenue and profit use real buying price (actual_cost) for calculations.
        Staff do not see actual cost or wholesale profit.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold text-green-700">
            KES {totals.revenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-sm text-gray-600">Total Cost (actual)</p>
          <p className="text-2xl font-bold text-red-700">
            KES {totals.totalCost.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Total Profit</p>
          <p className={`text-2xl font-bold ${totals.profit >= 0 ? "text-blue-700" : "text-red-700"}`}>
            KES {totals.profit.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Items Sold</p>
          <p className="text-2xl font-bold text-purple-700">
            {totals.itemsSold}
          </p>
        </div>
      </div>

      {/* Breakdown per product */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b">Breakdown per Product</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
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
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    No sales for this date
                  </td>
                </tr>
              ) : (
                perProduct.map((row) => (
                  <tr key={row.name} className="border-t hover:bg-gray-50">
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

      {/* Breakdown per staff */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b">Breakdown per Staff</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
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
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    No sales for this date
                  </td>
                </tr>
              ) : (
                perStaff.map((row) => (
                  <tr key={row.staff} className="border-t hover:bg-gray-50">
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
