import { useState, useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { usePayment } from "../context/PaymentContext";
import { useRepair } from "../context/RepairContext";
import { shareViaWhatsApp, shareViaEmail } from "../utils/receiptUtils";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function DailyReport() {
  const { sales, getRevenueByPeriod } = useSales();
  const { items } = useInventory();
  const { currentShop, currentUser, shops } = useShop();
  const { getTotalCashCollected, getTotalMpesaCollected, getTotalBankDeposits, getPendingCashDeposits } = usePayment();
  const { repairs } = useRepair();

  // Admin only - redirect non-admins
  if (!currentUser || !currentUser.roles.includes('admin')) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p>Only administrators can access daily reports.</p>
        </div>
      </div>
    );
  }
  
  // Date selection for manual reports
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Filter sales by selected date and shop
  const filteredSales = useMemo(() => {
    const targetDate = new Date(selectedDate);
    targetDate.setHours(0, 0, 0, 0);
    
    let salesToFilter = sales;
    if (!currentUser?.roles.includes('admin') && currentShop) {
      salesToFilter = sales.filter(sale => sale.shopId === currentShop.id);
    }
    
    return salesToFilter.filter((sale) => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === targetDate.getTime();
    });
  }, [sales, selectedDate, currentShop, currentUser]);

  // Calculate metrics for selected date
  const dailySales = useMemo(() => filteredSales, [filteredSales]);
  const dailyRevenue = useMemo(() => {
    return dailySales.reduce((sum, sale) => sum + sale.total, 0);
  }, [dailySales]);
  const totalItemsSold = useMemo(() => {
    return dailySales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  }, [dailySales]);
  
  // Revenue data for last 7 days
  const revenueData = getRevenueByPeriod('daily');

  // Items sold by product for selected date
  const itemsSoldByProduct = useMemo(() => {
    const itemMap = new Map<string, number>();
    dailySales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = itemMap.get(item.name);
        if (existing) {
          itemMap.set(item.name, existing + item.qty);
        } else {
          itemMap.set(item.name, item.qty);
        }
      });
    });
    return Array.from(itemMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [dailySales]);

  // Filter inventory by shop
  const shopItems = useMemo(() => {
    if (currentUser?.roles.includes('admin')) {
      return items;
    }
    if (!currentShop) return items;
    return items.filter(item => item.shopId === currentShop.id);
  }, [items, currentShop, currentUser]);

  // Inventory status data
  const inventoryStatus = useMemo(() => {
    const lowStock = shopItems.filter(item => item.stock <= item.reorderLevel).length;
    const inStock = shopItems.filter(item => item.stock > item.reorderLevel && item.stock > 0).length;
    const outOfStock = shopItems.filter(item => item.stock === 0).length;
    
    return [
      { name: 'In Stock', value: inStock, color: '#10b981' },
      { name: 'Low Stock', value: lowStock, color: '#f59e0b' },
      { name: 'Out of Stock', value: outOfStock, color: '#ef4444' },
    ];
  }, [shopItems]);

  // Inventory by category
  const inventoryByCategory = useMemo(() => {
    const categoryMap = new Map<string, { total: number; lowStock: number }>();
    shopItems.forEach(item => {
      const existing = categoryMap.get(item.category);
      if (existing) {
        existing.total += 1;
        if (item.stock <= item.reorderLevel) {
          existing.lowStock += 1;
        }
      } else {
        categoryMap.set(item.category, {
          total: 1,
          lowStock: item.stock <= item.reorderLevel ? 1 : 0,
        });
      }
    });
    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      total: data.total,
      lowStock: data.lowStock,
      inStock: data.total - data.lowStock,
    }));
  }, [shopItems]);

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Calculate payment totals for selected date
  const cashCollected = getTotalCashCollected();
  const mpesaCollected = getTotalMpesaCollected();
  const bankDeposits = getTotalBankDeposits();
  const pendingDeposits = getPendingCashDeposits();
  const pendingDepositsAmount = pendingDeposits.reduce((sum, p) => sum + p.amount, 0);

  // Get repairs for selected date
  const selectedDateRepairs = useMemo(() => {
    const targetDate = new Date(selectedDate);
    targetDate.setHours(0, 0, 0, 0);
    let repairsToFilter = repairs;
    if (!currentUser?.roles.includes('admin') && currentShop) {
      repairsToFilter = repairs.filter(r => r.shopId === currentShop.id);
    }
    return repairsToFilter.filter(repair => {
      const repairDate = new Date(repair.date);
      repairDate.setHours(0, 0, 0, 0);
      return repairDate.getTime() === targetDate.getTime();
    });
  }, [repairs, selectedDate, currentShop, currentUser]);

  const repairsCompleted = selectedDateRepairs.filter(r => 
    r.status === 'REPAIR_COMPLETED' || r.status === 'FULLY_PAID' || r.status === 'COLLECTED'
  ).length;
  const repairRevenue = selectedDateRepairs.reduce((sum, r) => sum + r.amountPaid, 0);
  const outsourcedCosts = selectedDateRepairs.reduce((sum, r) => sum + r.outsourcedCost, 0);

  const generateReportText = () => {
    const reportDate = formatDate(selectedDate);
    let text = `*${currentShop?.name || 'PHONEMART'} - Daily Sales Report*\n`;
    text += `Date: ${reportDate}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    text += `*📊 SUMMARY*\n`;
    text += `Total Revenue: KES ${dailyRevenue.toLocaleString()}\n`;
    text += `Total Items Sold: ${totalItemsSold}\n`;
    text += `Number of Transactions: ${dailySales.length}\n\n`;
    
    text += `*💳 PAYMENT BREAKDOWN*\n`;
    text += `Cash Collected: KES ${cashCollected.toLocaleString()}\n`;
    text += `MPESA Collected: KES ${mpesaCollected.toLocaleString()}\n`;
    text += `Bank Deposits: KES ${bankDeposits.toLocaleString()}\n`;
    if (pendingDepositsAmount > 0) {
      text += `⚠️ Pending Cash Deposits: KES ${pendingDepositsAmount.toLocaleString()}\n`;
    }
    text += `\n`;
    
    text += `*🔧 REPAIRS*\n`;
    text += `Repairs Completed: ${repairsCompleted}\n`;
    text += `Repair Revenue: KES ${repairRevenue.toLocaleString()}\n`;
    text += `Outsourced Costs: KES ${outsourcedCosts.toLocaleString()}\n\n`;
    
    if (itemsSoldByProduct.length > 0) {
      text += `*📦 TOP ITEMS SOLD*\n`;
      itemsSoldByProduct.slice(0, 5).forEach((item, index) => {
        text += `${index + 1}. ${item.name}: ${item.qty} units\n`;
      });
      text += `\n`;
    }
    
    text += `*📋 INVENTORY STATUS*\n`;
    text += `Total Items: ${shopItems.length}\n`;
    text += `In Stock: ${inventoryStatus[0].value}\n`;
    text += `Low Stock: ${inventoryStatus[1].value}\n`;
    text += `Out of Stock: ${inventoryStatus[2].value}\n\n`;
    
    if (dailySales.length > 0) {
      text += `*💰 TOP TRANSACTIONS*\n`;
      dailySales
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .forEach((sale, index) => {
          text += `${index + 1}. Receipt #${sale.id.substring(0, 8)} - KES ${sale.total.toLocaleString()}\n`;
        });
    }
    
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `Thank you!`;
    return text;
  };

  const handleShareWhatsApp = () => {
    const text = generateReportText();
    // If shop has WhatsApp group, use that; otherwise use phone number
    if (currentShop?.whatsappGroup) {
      // Open WhatsApp group link
      window.open(currentShop.whatsappGroup, '_blank');
      // Also try to share text via WhatsApp Web
      setTimeout(() => {
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      }, 500);
    } else {
      shareViaWhatsApp(text, currentShop?.phone);
    }
  };

  const handleShareEmail = () => {
    const subject = `Daily Sales Report - ${formatDate(selectedDate)}`;
    const body = generateReportText();
    shareViaEmail(subject, body, currentShop?.email);
  };

  const handleGenerateToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Daily Sales Report</h2>
          <p className="text-gray-600 text-sm mt-1">
            {currentUser?.roles.includes('admin') ? 'All Shops' : currentShop?.name || 'Select Shop'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              max={new Date().toISOString().split('T')[0]}
            />
            <button
              onClick={handleGenerateToday}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm"
            >
              Today
            </button>
          </div>
          <button
            onClick={handleShareWhatsApp}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.982 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Share via WhatsApp
          </button>
          <button
            onClick={handleShareEmail}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Share via Email
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">KES {dailyRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Items Sold</p>
          <p className="text-2xl font-bold text-blue-600">{totalItemsSold}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Transactions</p>
          <p className="text-2xl font-bold text-purple-600">{dailySales.length}</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Revenue Trend (Last 7 Days)</h3>
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

      {/* Items Sold Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Items Sold - {formatDate(selectedDate)}</h3>
        {itemsSoldByProduct.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No items sold on this date.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300} className="min-h-[300px]">
            <BarChart data={itemsSoldByProduct}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="qty" fill="#10b981" name="Quantity Sold" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Inventory Status Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inventory Status Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Inventory Status Overview</h3>
          <ResponsiveContainer width="100%" height={250} className="min-h-[250px]">
            <PieChart>
              <Pie
                data={inventoryStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {inventoryStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory by Category */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Inventory by Category</h3>
          <ResponsiveContainer width="100%" height={250} className="min-h-[250px]">
            <BarChart data={inventoryByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="inStock" fill="#10b981" name="In Stock" stackId="a" />
              <Bar dataKey="lowStock" fill="#f59e0b" name="Low Stock" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Transactions - {formatDate(selectedDate)}</h3>
        {dailySales.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No sales recorded on this date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Receipt #</th>
                  <th className="p-3 text-left">Time</th>
                  <th className="p-3 text-right">Items</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {dailySales.map((sale) => (
                  <tr key={sale.id} className="border-t">
                    <td className="p-3">{sale.id.substring(0, 8)}</td>
                    <td className="p-3">
                      {new Date(sale.date).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3 text-right">{sale.items.length}</td>
                    <td className="p-3 text-right font-semibold">
                      KES {sale.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Only: Repair Tickets Report */}
      {currentUser?.roles.includes('admin') && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Repair Tickets Report - {formatDate(selectedDate)}</h3>
          {(() => {
            // Filter repairs with tickets (exclude deposits)
            const ticketsWithRepairs = selectedDateRepairs.filter(r => r.ticketNumber);
            
            // Group by shop
            const ticketsByShop = new Map<string, typeof ticketsWithRepairs>();
            ticketsWithRepairs.forEach(repair => {
              const shopId = repair.shopId || 'unassigned';
              if (!ticketsByShop.has(shopId)) {
                ticketsByShop.set(shopId, []);
              }
              ticketsByShop.get(shopId)!.push(repair);
            });

            // Calculate totals per shop
            const shopTotals = Array.from(ticketsByShop.entries()).map(([shopId, repairs]) => {
              const revenue = repairs.reduce((sum, r) => sum + (r.totalAgreedAmount || r.totalCost), 0);
              const outsourcedCost = repairs.reduce((sum, r) => sum + r.outsourcedCost, 0);
              const partsCost = repairs.reduce((sum, r) => 
                sum + r.partsUsed.reduce((pSum, p) => pSum + (p.cost * p.qty), 0), 0
              );
              const grossProfit = revenue - outsourcedCost - partsCost;
              const laborCost = repairs.reduce((sum, r) => sum + r.laborCost, 0);
              const netProfit = grossProfit - laborCost;
              
              return {
                shopId,
                shopName: shops.find(s => s.id === shopId)?.name || 'Unassigned',
                ticketCount: repairs.length,
                revenue,
                grossProfit,
                netProfit,
                repairs,
              };
            });

            // Calculate combined totals
            const combinedRevenue = shopTotals.reduce((sum, s) => sum + s.revenue, 0);
            const combinedGrossProfit = shopTotals.reduce((sum, s) => sum + s.grossProfit, 0);
            const combinedNetProfit = shopTotals.reduce((sum, s) => sum + s.netProfit, 0);
            const totalTickets = ticketsWithRepairs.length;

            if (ticketsWithRepairs.length === 0) {
              return <p className="text-gray-600 text-center py-8">No repair tickets for this date.</p>;
            }

            return (
              <div className="space-y-6">
                {/* Combined Summary */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-lg mb-3">All Shops Combined</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Tickets</p>
                      <p className="text-xl font-bold">{totalTickets}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Revenue</p>
                      <p className="text-xl font-bold text-green-600">KES {combinedRevenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Gross Profit</p>
                      <p className="text-xl font-bold text-blue-600">KES {combinedGrossProfit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Net Profit</p>
                      <p className="text-xl font-bold text-purple-600">KES {combinedNetProfit.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Per Shop Breakdown */}
                {shopTotals.map((shop) => (
                  <div key={shop.shopId} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-lg mb-3">{shop.shopName}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Tickets</p>
                        <p className="text-lg font-bold">{shop.ticketCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Revenue</p>
                        <p className="text-lg font-bold text-green-600">KES {shop.revenue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Gross Profit</p>
                        <p className="text-lg font-bold text-blue-600">KES {shop.grossProfit.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Net Profit</p>
                        <p className="text-lg font-bold text-purple-600">KES {shop.netProfit.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Tickets List */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 text-left">Ticket #</th>
                            <th className="p-2 text-left">Customer</th>
                            <th className="p-2 text-left">Phone</th>
                            <th className="p-2 text-right">Revenue</th>
                            <th className="p-2 text-right">Gross Profit</th>
                            <th className="p-2 text-right">Net Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shop.repairs.map((repair) => {
                            const revenue = repair.totalAgreedAmount || repair.totalCost;
                            const outsourcedCost = repair.outsourcedCost;
                            const partsCost = repair.partsUsed.reduce((sum, p) => sum + (p.cost * p.qty), 0);
                            const grossProfit = revenue - outsourcedCost - partsCost;
                            const netProfit = grossProfit - repair.laborCost;
                            
                            return (
                              <tr key={repair.id} className="border-t">
                                <td className="p-2 font-mono">{repair.ticketNumber}</td>
                                <td className="p-2">{repair.customerName}</td>
                                <td className="p-2">{repair.phoneModel}</td>
                                <td className="p-2 text-right font-semibold text-green-600">
                                  KES {revenue.toLocaleString()}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600">
                                  KES {grossProfit.toLocaleString()}
                                </td>
                                <td className="p-2 text-right font-semibold text-purple-600">
                                  KES {netProfit.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
