import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useSales } from "../context/SalesContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import ShopSelector from "../components/ShopSelector";

export default function Dashboard() {
  const {
    sales,
    getDailyRevenue,
    getTotalItemsSoldToday,
  } = useSales();
  const { items } = useInventory();
  const { currentShop, currentUser } = useShop();

  // Filter sales by current shop (or all shops for admin)
  const shopSales = useMemo(() => {
    // Admin sees all sales aggregated
    if (currentUser?.role === 'admin') {
      return sales;
    }
    // Technicians/managers see only their shop's sales
    if (!currentShop) return sales;
    return sales.filter(sale => sale.shopId === currentShop.id);
  }, [sales, currentShop, currentUser]);

  const [revenuePeriod, setRevenuePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Recalculate metrics based on shop sales
  const shopDailyRevenue = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return shopSales
      .filter((sale) => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      })
      .reduce((sum, sale) => sum + sale.total, 0);
  }, [shopSales]);

  const shopTotalItemsSold = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return shopSales
      .filter((sale) => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      })
      .reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  }, [shopSales]);

  // Filter inventory by shop (or all for admin)
  const shopItems = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return items;
    }
    if (!currentShop) return items;
    return items.filter(item => item.shopId === currentShop.id);
  }, [items, currentShop, currentUser]);

  // Admin sees aggregated data, others see shop-specific data
  const dailyRevenue = currentUser?.role === 'admin' ? getDailyRevenue() : shopDailyRevenue;
  const totalItemsSold = currentUser?.role === 'admin' ? getTotalItemsSoldToday() : shopTotalItemsSold;
  
  // Low stock items - filter by shop
  const lowStockItems = shopItems.filter(item => item.stock <= item.reorderLevel);
  const lowStockCount = lowStockItems.length;

  // Calculate revenue by period from shop sales
  const revenueData = useMemo(() => {
    const now = new Date();
    const data: Array<{ period: string; revenue: number }> = [];

    if (revenuePeriod === 'daily') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayRevenue = shopSales
          .filter((sale) => {
            const saleDate = new Date(sale.date);
            saleDate.setHours(0, 0, 0, 0);
            return saleDate.getTime() === date.getTime();
          })
          .reduce((sum, sale) => sum + sale.total, 0);

        data.push({
          period: date.toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: dayRevenue,
        });
      }
    } else if (revenuePeriod === 'weekly') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekRevenue = shopSales
          .filter((sale) => {
            const saleDate = new Date(sale.date);
            return saleDate >= weekStart && saleDate <= weekEnd;
          })
          .reduce((sum, sale) => sum + sale.total, 0);

        data.push({
          period: `Week ${4 - i}`,
          revenue: weekRevenue,
        });
      }
    } else if (revenuePeriod === 'monthly') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now);
        month.setMonth(month.getMonth() - i);
        month.setDate(1);
        month.setHours(0, 0, 0, 0);

        const nextMonth = new Date(month);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const monthRevenue = shopSales
          .filter((sale) => {
            const saleDate = new Date(sale.date);
            return saleDate >= month && saleDate < nextMonth;
          })
          .reduce((sum, sale) => sum + sale.total, 0);

        data.push({
          period: month.toLocaleDateString('en-US', { month: 'short' }),
          revenue: monthRevenue,
        });
      }
    }

    return data;
  }, [shopSales, revenuePeriod]);

  // Calculate items sold from shop sales (filtered by shop)
  const shopItemsSoldData = useMemo(() => {
    const itemMap = new Map<string, number>();
    shopSales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = itemMap.get(item.name);
        if (existing) {
          itemMap.set(item.name, existing + item.qty);
        } else {
          itemMap.set(item.name, item.qty);
        }
      });
    });
    return Array.from(itemMap.entries()).map(([name, qty]) => ({ name, qty }));
  }, [shopSales]);
  
  // Inventory movement data - items sold vs available (filtered by shop)
  const inventoryMovement = shopItems.map(item => {
    // Find sold quantity from shop sales data, or use stock difference as fallback
    const soldData = shopItemsSoldData.find(s => s.name === item.name);
    const itemsSold = soldData ? soldData.qty : Math.max(0, item.initialStock - item.stock);
    
    return {
      name: item.name,
      available: item.stock,
      sold: itemsSold,
      category: item.category,
      reorderLevel: item.reorderLevel,
    };
  });

  // Top selling items (all time)
  const topSellingItems = [...inventoryMovement]
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 10);

  // Most sold items for table
  const mostSoldItems = [...inventoryMovement]
    .filter(item => item.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 10);

  // Top-selling accessories
  const topAccessories = [...inventoryMovement]
    .filter(item => item.category === 'Accessory')
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  // Top-selling spares
  const topSpares = [...inventoryMovement]
    .filter(item => item.category === 'Spare')
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        {currentUser?.role === 'admin' ? (
          <p className="text-gray-600 font-semibold">All Shops (Aggregated View)</p>
        ) : currentShop ? (
          <p className="text-gray-600">Shop: {currentShop.name}</p>
        ) : null}
      </div>

      {/* Shop Selector */}
      <ShopSelector />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Sales Today</p>
              <p className="text-2xl font-bold text-green-600">KES {dailyRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Items Sold Today</p>
              <p className="text-2xl font-bold text-blue-600">{totalItemsSold}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Low Stock Items</p>
              <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Charts */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h3 className="text-lg font-semibold">Revenue Overview</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRevenuePeriod('daily')}
              className={`px-4 py-2 rounded ${revenuePeriod === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Daily
            </button>
            <button
              onClick={() => setRevenuePeriod('weekly')}
              className={`px-4 py-2 rounded ${revenuePeriod === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setRevenuePeriod('monthly')}
              className={`px-4 py-2 rounded ${revenuePeriod === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Monthly
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250} className="min-h-[250px]">
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip formatter={(value: number | undefined) => value !== undefined ? `KES ${value.toLocaleString()}` : ''} />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              strokeWidth={3}
              name="Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory Movement Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Inventory Movement - Top Selling Items</h3>
        <ResponsiveContainer width="100%" height={250} className="min-h-[250px]">
          <BarChart data={topSellingItems}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="available" fill="#10b981" name="Available Stock" />
            <Bar dataKey="sold" fill="#3b82f6" name="Items Sold" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Sales by Category</h3>
        <ResponsiveContainer width="100%" height={250} className="min-h-[250px]">
          <BarChart data={inventoryMovement}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="sold" fill="#8b5cf6" name="Items Sold" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Low Stock Items Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Low Stock Items</h3>
        {lowStockItems.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No low stock items. All items are well stocked!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Category</th>
                  <th className="p-3 text-right text-sm font-semibold text-gray-700">Current Stock</th>
                  <th className="p-3 text-right text-sm font-semibold text-gray-700">Reorder Level</th>
                  <th className="p-3 text-center text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium">{item.name}</td>
                    <td className="p-3 text-sm text-gray-600">{item.category}</td>
                    <td className="p-3 text-sm text-right">{item.stock}</td>
                    <td className="p-3 text-sm text-right text-gray-600">{item.reorderLevel}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.stock === 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Most Sold Items Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Most Sold Items</h3>
        {mostSoldItems.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No sales data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                  <th className="p-3 text-left text-sm font-semibold text-gray-700">Category</th>
                  <th className="p-3 text-right text-sm font-semibold text-gray-700">Quantity Sold</th>
                  <th className="p-3 text-right text-sm font-semibold text-gray-700">Available Stock</th>
                </tr>
              </thead>
              <tbody>
                {mostSoldItems.map((item, index) => (
                  <tr key={item.name} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium text-gray-600">#{index + 1}</td>
                    <td className="p-3 text-sm font-medium">{item.name}</td>
                    <td className="p-3 text-sm text-gray-600">{item.category}</td>
                    <td className="p-3 text-sm text-right font-semibold text-blue-600">{item.sold}</td>
                    <td className="p-3 text-sm text-right">{item.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top-Selling Accessories and Spares */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top-Selling Accessories */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top-Selling Accessories</h3>
          {topAccessories.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No accessories sold yet.</p>
          ) : (
            <div className="space-y-3">
              {topAccessories.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">Stock: {item.available}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">{item.sold} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top-Selling Spares */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top-Selling Spares</h3>
          {topSpares.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No spares sold yet.</p>
          ) : (
            <div className="space-y-3">
              {topSpares.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">Stock: {item.available}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">{item.sold} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
