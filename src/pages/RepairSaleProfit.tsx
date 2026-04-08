import { useState, useMemo } from "react";
import { useRepair } from "../context/RepairContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

type Period = 'today' | 'week' | 'month';

export default function RepairSaleProfit() {
  const { repairs } = useRepair();
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

  // Filter repairs by date and shop
  const filteredRepairs = useMemo(() => {
    let filtered = repairs.filter(r => {
      const repairDate = new Date(r.date);
      return repairDate >= start && repairDate <= end;
    });

    if (!isAdmin) {
      filtered = filtered.filter(r => r.shopId === currentUser?.shopId);
    } else if (selectedShopId !== 'all') {
      filtered = filtered.filter(r => r.shopId === selectedShopId);
    }

    return filtered;
  }, [repairs, start, end, isAdmin, selectedShopId, currentUser?.shopId]);

  // Calculate profit breakdown
  const profitBreakdown = useMemo(() => {
    let totalRevenue = 0;
    let totalStaffCost = 0;
    let totalWholesaleCost = 0;
    let totalLaborCost = 0;
    let totalOutsourcedCost = 0;
    let totalStaffPartsCost = 0;
    let totalWholesalePartsCost = 0;
    let repairCount = 0;

    const repairDetails = filteredRepairs.map(repair => {
      // In-house parts: staff view uses staff/base price; admin can also compare wholesale/actual cost.
      const staffPartsCost = repair.partsUsed
        .filter(p => p.source === 'in-house' || !p.source)
        .reduce((sum, p) => {
          const item = items.find(i => i.id === p.itemId);
          const cost = item?.costPrice ?? p.cost ?? 0;
          return sum + (cost * p.qty);
        }, 0);

      const wholesalePartsCost = repair.partsUsed
        .filter(p => p.source === 'in-house' || !p.source)
        .reduce((sum, p) => {
          const item = items.find(i => i.id === p.itemId);
          const cost = item?.actualCost ?? item?.adminCostPrice ?? item?.costPrice ?? p.cost ?? 0;
          return sum + (cost * p.qty);
        }, 0);

      // Outsourced parts cost
      const outsourcedCost = repair.outsourcedCost || 0;
      
      // Labor cost
      const laborCost = repair.laborCost || 0;
      
      const staffTotalCostForRepair = staffPartsCost + outsourcedCost + laborCost;
      const wholesaleTotalCostForRepair = wholesalePartsCost + outsourcedCost + laborCost;
      
      // Revenue charged to customer
      const revenue = repair.totalAgreedAmount || repair.totalCost || 0;
      
      const staffProfit = revenue - staffTotalCostForRepair;
      const wholesaleProfit = revenue - wholesaleTotalCostForRepair;

      totalRevenue += revenue;
      totalStaffCost += staffTotalCostForRepair;
      totalWholesaleCost += wholesaleTotalCostForRepair;
      totalLaborCost += laborCost;
      totalOutsourcedCost += outsourcedCost;
      totalStaffPartsCost += staffPartsCost;
      totalWholesalePartsCost += wholesalePartsCost;
      repairCount++;

      return {
        id: repair.id,
        date: repair.date,
        customerName: repair.customerName,
        phoneModel: repair.phoneModel,
        shopId: repair.shopId,
        shopName: shops.find(s => s.id === repair.shopId)?.name || 'Unassigned',
        revenue,
        staffPartsCost,
        wholesalePartsCost,
        outsourcedCost,
        laborCost,
        staffTotalCost: staffTotalCostForRepair,
        wholesaleTotalCost: wholesaleTotalCostForRepair,
        staffProfit,
        wholesaleProfit,
        partsUsed: repair.partsUsed,
        status: repair.status,
      };
    });

    return {
      repairDetails,
      summary: {
        repairCount,
        totalRevenue,
        totalStaffPartsCost,
        totalWholesalePartsCost,
        totalOutsourcedCost,
        totalLaborCost,
        totalStaffCost,
        totalWholesaleCost,
        totalStaffProfit: totalRevenue - totalStaffCost,
        totalWholesaleProfit: totalRevenue - totalWholesaleCost,
      },
    };
  }, [filteredRepairs, items, shops]);

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
        <h2 className="text-2xl font-bold">Repair Sale Profit Report</h2>
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
          <h3 className="text-sm text-gray-600 mb-1">Total Repairs</h3>
          <p className="text-2xl font-bold text-blue-600">{profitBreakdown.summary.repairCount}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm text-gray-600 mb-1">Total Revenue</h3>
          <p className="text-2xl font-bold text-green-600">KES {profitBreakdown.summary.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm text-gray-600 mb-1">{isAdmin ? 'Total Cost (Wholesale)' : 'Total Cost (Staff Base)'}</h3>
          <p className="text-2xl font-bold text-red-600">
            KES {(isAdmin ? profitBreakdown.summary.totalWholesaleCost : profitBreakdown.summary.totalStaffCost).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm text-gray-600 mb-1">{isAdmin ? 'Total Profit (Wholesale)' : 'Total Profit (Staff)'}</h3>
          <p className={`text-2xl font-bold ${(isAdmin ? profitBreakdown.summary.totalWholesaleProfit : profitBreakdown.summary.totalStaffProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            KES {(isAdmin ? profitBreakdown.summary.totalWholesaleProfit : profitBreakdown.summary.totalStaffProfit).toLocaleString()}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-sm text-gray-600 mb-1">Staff Profit View (Retail/Base)</h3>
            <p className={`text-2xl font-bold ${profitBreakdown.summary.totalStaffProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              KES {profitBreakdown.summary.totalStaffProfit.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Uses staff/base part prices.
            </p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500">
            <h3 className="text-sm text-gray-600 mb-1">Admin Profit View (Wholesale/Actual)</h3>
            <p className={`text-2xl font-bold ${profitBreakdown.summary.totalWholesaleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              KES {profitBreakdown.summary.totalWholesaleProfit.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Uses actual/wholesale part costs.
            </p>
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded p-4">
            <h4 className="text-sm text-gray-600 mb-1">{isAdmin ? 'Parts Cost (Wholesale)' : 'Parts Cost (Staff Base)'}</h4>
            <p className="text-xl font-semibold">
              KES {(isAdmin ? profitBreakdown.summary.totalWholesalePartsCost : profitBreakdown.summary.totalStaffPartsCost).toLocaleString()}
            </p>
          </div>
          <div className="border rounded p-4">
            <h4 className="text-sm text-gray-600 mb-1">Outsourced Cost</h4>
            <p className="text-xl font-semibold">KES {profitBreakdown.summary.totalOutsourcedCost.toLocaleString()}</p>
          </div>
          <div className="border rounded p-4">
            <h4 className="text-sm text-gray-600 mb-1">Labor Cost</h4>
            <p className="text-xl font-semibold">KES {profitBreakdown.summary.totalLaborCost.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Detailed Repair List */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <h3 className="text-lg font-semibold p-4 border-b">Detailed Repair Sales</h3>
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              {isAdmin && <th className="p-3 text-left text-sm">Shop</th>}
              <th className="p-3 text-left text-sm">Date</th>
              <th className="p-3 text-left text-sm">Customer</th>
              <th className="p-3 text-left text-sm">Phone Model</th>
              <th className="p-3 text-right text-sm">Revenue</th>
              <th className="p-3 text-right text-sm">Parts Cost (Staff)</th>
              {isAdmin && <th className="p-3 text-right text-sm">Parts Cost (Wholesale)</th>}
              <th className="p-3 text-right text-sm">Outsourced</th>
              <th className="p-3 text-right text-sm">Labor</th>
              <th className="p-3 text-right text-sm">Total Cost</th>
              <th className="p-3 text-right text-sm font-semibold">{isAdmin ? 'Profit (Wholesale)' : 'Profit (Staff)'}</th>
              {isAdmin && <th className="p-3 text-right text-sm font-semibold">Profit (Staff)</th>}
            </tr>
          </thead>
          <tbody>
            {profitBreakdown.repairDetails.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 12 : 9} className="p-4 text-center text-gray-500">
                  No repairs found for {periodLabel(period)}
                </td>
              </tr>
            ) : (
              profitBreakdown.repairDetails.map((repair) => (
                <tr key={repair.id} className="border-t hover:bg-gray-50">
                  {isAdmin && (
                    <td className="p-3 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {repair.shopName}
                      </span>
                    </td>
                  )}
                  <td className="p-3 text-sm text-gray-600">
                    {new Date(repair.date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-sm">{repair.customerName}</td>
                  <td className="p-3 text-sm">{repair.phoneModel}</td>
                  <td className="p-3 text-right text-sm font-medium text-green-600">
                    KES {repair.revenue.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-sm">KES {repair.staffPartsCost.toLocaleString()}</td>
                  {isAdmin && (
                    <td className="p-3 text-right text-sm">KES {repair.wholesalePartsCost.toLocaleString()}</td>
                  )}
                  <td className="p-3 text-right text-sm">KES {repair.outsourcedCost.toLocaleString()}</td>
                  <td className="p-3 text-right text-sm">KES {repair.laborCost.toLocaleString()}</td>
                  <td className="p-3 text-right text-sm font-medium text-red-600">
                    KES {(isAdmin ? repair.wholesaleTotalCost : repair.staffTotalCost).toLocaleString()}
                  </td>
                  <td className={`p-3 text-right text-sm font-bold ${
                    (isAdmin ? repair.wholesaleProfit : repair.staffProfit) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    KES {(isAdmin ? repair.wholesaleProfit : repair.staffProfit).toLocaleString()}
                  </td>
                  {isAdmin && (
                    <td className={`p-3 text-right text-sm font-bold ${repair.staffProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      KES {repair.staffProfit.toLocaleString()}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
