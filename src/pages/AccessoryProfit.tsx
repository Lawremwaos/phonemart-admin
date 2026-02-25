import { useState, useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

type Period = 'today' | 'week' | 'month';

export default function AccessoryProfit() {
  const { sales } = useSales();
  const { items } = useInventory();
  const { shops, currentUser } = useShop();
  const isAdmin = currentUser?.roles.includes('admin') ?? false;
  const [period, setPeriod] = useState<Period>('today');
  const [selectedShopId, setSelectedShopId] = useState<string>('all');

  // Get date range based on period
  const getDateRange = (p: Period) => {
    const now = new Date();
    const start = new Date();
    
    switch (p) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    
    return { start, end: now };
  };

  const { start, end } = getDateRange(period);

  // Helper to check if sale item is an accessory
  const isAccessorySaleItem = (sale: typeof sales[0], item: typeof sale.items[0]) => {
    // Check if sale type is repair (accessories sold in repairs)
    if (sale.saleType === 'repair') return true;
    
    // Check if sale type is retail/wholesale and item is accessory
    if (sale.saleType === 'retail' || sale.saleType === 'wholesale') {
      const inventoryItem = items.find(i => i.id === item.itemId);
      const category = inventoryItem?.category?.toString().toLowerCase();
      return category === 'accessory';
    }
    
    return false;
  };

  // Filter accessory sales by date and shop
  const accessorySales = useMemo(() => {
    let filtered = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= start && saleDate <= end;
    });

    // Filter for accessory items only
    filtered = filtered.map(sale => ({
      ...sale,
      items: sale.items.filter(item => isAccessorySaleItem(sale, item)),
    })).filter(sale => sale.items.length > 0);

    if (!isAdmin) {
      filtered = filtered.filter(sale => sale.shopId === currentUser?.shopId);
    } else if (selectedShopId !== 'all') {
      filtered = filtered.filter(sale => sale.shopId === selectedShopId);
    }

    return filtered;
  }, [sales, start, end, isAdmin, selectedShopId, currentUser?.shopId, items]);

  // Calculate profit breakdown
  const profitBreakdown = useMemo(() => {
    let totalRevenue = 0;
    let totalCostStaff = 0; // Cost based on staff selling price (admin_base_price)
    let totalCostActual = 0; // Actual cost (admin only)
    let totalProfitStaff = 0; // Profit based on staff price (staff sees this)
    let totalProfitActual = 0; // Real profit based on actual cost (admin only)
    let saleCount = 0;
    let itemCount = 0;

    const saleDetails = accessorySales.flatMap(sale => {
      return sale.items.map(item => {
        const inventoryItem = items.find(i => 
          (item.itemId && i.id === item.itemId) || 
          i.name.toLowerCase() === item.name.toLowerCase()
        );
        
        // Staff selling price (costPrice) - what staff sees and uses for profit calculation
        // This is the price set by admin when purchasing (staffSellingPrice)
        const staffBasePrice = inventoryItem?.costPrice ?? item.adminBasePrice ?? 0;
        
        // Actual cost (admin only) - real wholesale purchase cost
        const actualCost = inventoryItem?.actualCost ?? item.actualCost ?? inventoryItem?.adminCostPrice ?? 0;
        
        // Selling price (what customer paid)
        const sellingPrice = item.price;
        
        // Quantities
        const qty = item.qty;
        
        // Revenue
        const revenue = sellingPrice * qty;
        
        // Costs
        const costStaff = staffBasePrice * qty;
        const costActual = actualCost * qty;
        
        // Profits
        const profitStaff = revenue - costStaff; // Staff performance profit
        const profitActual = revenue - costActual; // Real profit (admin only)

        totalRevenue += revenue;
        totalCostStaff += costStaff;
        totalCostActual += costActual;
        totalProfitStaff += profitStaff;
        totalProfitActual += profitActual;
        itemCount += qty;

        return {
          saleId: sale.id,
          saleDate: sale.date,
          saleType: sale.saleType,
          repairId: sale.repairId,
          shopId: sale.shopId,
          shopName: shops.find(s => s.id === sale.shopId)?.name || 'Unassigned',
          itemName: item.name,
          qty,
          sellingPrice,
          staffBasePrice,
          actualCost: isAdmin ? actualCost : undefined, // Hide from staff
          revenue,
          costStaff,
          costActual: isAdmin ? costActual : undefined, // Hide from staff
          profitStaff,
          profitActual: isAdmin ? profitActual : undefined, // Hide from staff
        };
      });
    });

    saleCount = accessorySales.length;

    return {
      saleDetails,
      summary: {
        saleCount,
        itemCount,
        totalRevenue,
        totalCostStaff,
        totalCostActual: isAdmin ? totalCostActual : undefined,
        totalProfitStaff,
        totalProfitActual: isAdmin ? totalProfitActual : undefined,
      },
    };
  }, [accessorySales, items, shops, isAdmin]);

  const periodLabel = (p: Period) => {
    switch (p) {
      case 'today': return 'Today';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Accessory Profit Report</h2>
        <div className="flex gap-3 items-center">
          {isAdmin && (
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white"
            >
              <option value="all">All Shops</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          )}
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded transition ${
                  period === p
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {periodLabel(p)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm text-gray-600 mb-1">Total Sales</h3>
          <p className="text-2xl font-bold text-blue-600">{profitBreakdown.summary.saleCount}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm text-gray-600 mb-1">Items Sold</h3>
          <p className="text-2xl font-bold text-blue-600">{profitBreakdown.summary.itemCount}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm text-gray-600 mb-1">Total Revenue</h3>
          <p className="text-2xl font-bold text-green-600">KES {profitBreakdown.summary.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm text-gray-600 mb-1">
            {isAdmin ? 'Real Profit' : 'Performance Profit'}
          </h3>
          <p className={`text-2xl font-bold ${
            (isAdmin ? (profitBreakdown.summary.totalProfitActual ?? 0) : profitBreakdown.summary.totalProfitStaff) >= 0 
              ? 'text-green-600' 
              : 'text-red-600'
          }`}>
            KES {(isAdmin ? (profitBreakdown.summary.totalProfitActual ?? 0) : profitBreakdown.summary.totalProfitStaff).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Admin-only: Real Profit vs Performance Profit */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Profit Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded p-4">
              <h4 className="text-sm text-gray-600 mb-1">Performance Profit (Staff View)</h4>
              <p className="text-xl font-semibold text-blue-600">
                KES {profitBreakdown.summary.totalProfitStaff.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Based on: Selling Price - Admin Base Price
              </p>
            </div>
            <div className="border rounded p-4">
              <h4 className="text-sm text-gray-600 mb-1">Real Profit (Admin Only)</h4>
              <p className="text-xl font-semibold text-green-600">
                KES {profitBreakdown.summary.totalProfitActual?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Based on: Selling Price - Actual Cost
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Sales List */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="text-lg font-semibold p-4 border-b">Detailed Accessory Sales</h3>
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              {isAdmin && <th className="p-3 text-left text-sm">Shop</th>}
              <th className="p-3 text-left text-sm">Date</th>
              <th className="p-3 text-left text-sm">Item</th>
              <th className="p-3 text-left text-sm">Source</th>
              <th className="p-3 text-right text-sm">Qty</th>
              <th className="p-3 text-right text-sm">Selling Price</th>
              {isAdmin && <th className="p-3 text-right text-sm">Actual Cost</th>}
              <th className="p-3 text-right text-sm">Staff Base Price</th>
              <th className="p-3 text-right text-sm">Revenue</th>
              {isAdmin && <th className="p-3 text-right text-sm">Real Profit</th>}
              <th className="p-3 text-right text-sm font-semibold">Performance Profit</th>
            </tr>
          </thead>
          <tbody>
            {profitBreakdown.saleDetails.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 11 : 9} className="p-4 text-center text-gray-500">
                  No accessory sales found for {periodLabel(period)}
                </td>
              </tr>
            ) : (
              profitBreakdown.saleDetails.map((sale, index) => (
                <tr key={`${sale.saleId}-${index}`} className="border-t hover:bg-gray-50">
                  {isAdmin && (
                    <td className="p-3 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {sale.shopName}
                      </span>
                    </td>
                  )}
                  <td className="p-3 text-sm text-gray-600">
                    {new Date(sale.saleDate).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-sm font-medium">{sale.itemName}</td>
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 text-xs rounded ${
                      sale.saleType === 'repair' 
                        ? 'bg-purple-100 text-purple-800' 
                        : sale.saleType === 'wholesale'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {sale.saleType === 'repair' ? 'From Repair' : sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'}
                    </span>
                  </td>
                  <td className="p-3 text-right text-sm">{sale.qty}</td>
                  <td className="p-3 text-right text-sm">KES {sale.sellingPrice.toLocaleString()}</td>
                  {isAdmin && (
                    <td className="p-3 text-right text-sm text-gray-600">
                      KES {sale.actualCost?.toLocaleString() || '—'}
                    </td>
                  )}
                  <td className="p-3 text-right text-sm text-gray-600">
                    KES {sale.staffBasePrice.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-sm font-medium text-green-600">
                    KES {sale.revenue.toLocaleString()}
                  </td>
                  {isAdmin && (
                    <td className={`p-3 text-right text-sm font-semibold ${
                      (sale.profitActual ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      KES {sale.profitActual?.toLocaleString() || '—'}
                    </td>
                  )}
                  <td className={`p-3 text-right text-sm font-bold ${
                    sale.profitStaff >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    KES {sale.profitStaff.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
