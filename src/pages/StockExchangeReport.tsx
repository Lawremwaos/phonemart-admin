import { useState, useMemo } from "react";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";

type DateRange = 'today' | 'week' | 'month' | 'all';

export default function StockExchangeReport() {
  const { exchanges } = useInventory();
  const { shops, currentUser } = useShop();
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Filter exchanges based on date range
  const filteredExchanges = useMemo(() => {
    let filtered = exchanges;

    // Filter by date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    filtered = filtered.filter(exchange => {
      const exchangeDate = new Date(exchange.date);
      
      switch (dateRange) {
        case 'today':
          return exchangeDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return exchangeDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return exchangeDate >= monthAgo;
        case 'all':
        default:
          return true;
      }
    });

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(exchange => exchange.status === statusFilter);
    }

    // Filter by shop if not admin
    if (!currentUser?.roles.includes('admin') && currentUser?.shopId) {
      filtered = filtered.filter(
        exchange => 
          exchange.fromShopId === currentUser.shopId || 
          exchange.toShopId === currentUser.shopId
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [exchanges, dateRange, statusFilter, currentUser]);

  const getShopName = (shopId: string) => {
    return shops.find(s => s.id === shopId)?.name || shopId;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalItemsExchanged = useMemo(() => {
    return filteredExchanges.reduce((total, exchange) => {
      return total + exchange.items.reduce((sum, item) => sum + item.qty, 0);
    }, 0);
  }, [filteredExchanges]);

  const pendingExchanges = useMemo(() => {
    return filteredExchanges.filter(e => e.status === 'pending').length;
  }, [filteredExchanges]);

  const completedExchanges = useMemo(() => {
    return filteredExchanges.filter(e => e.status === 'completed').length;
  }, [filteredExchanges]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Stock Exchange Report</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Exchanges</p>
          <p className="text-2xl font-bold">{filteredExchanges.length}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingExchanges}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedExchanges}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Items</p>
          <p className="text-2xl font-bold">{totalItemsExchanged}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'completed')}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Exchange Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        {filteredExchanges.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No stock exchanges found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExchanges.map((exchange) => (
                  <tr key={exchange.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(exchange.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getShopName(exchange.fromShopId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getShopName(exchange.toShopId)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="space-y-1">
                        {exchange.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.itemName}</span>
                            <span className="font-semibold ml-2">x{item.qty}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {exchange.items.reduce((sum, item) => sum + item.qty, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        exchange.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {exchange.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Options */}
      {filteredExchanges.length > 0 && (
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={() => {
              const csvContent = [
                ['Date', 'From Shop', 'To Shop', 'Items', 'Total Quantity', 'Status'],
                ...filteredExchanges.map(exchange => [
                  formatDate(exchange.date),
                  getShopName(exchange.fromShopId),
                  getShopName(exchange.toShopId),
                  exchange.items.map(i => `${i.itemName} (x${i.qty})`).join('; '),
                  exchange.items.reduce((sum, item) => sum + item.qty, 0).toString(),
                  exchange.status,
                ]),
              ]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');

              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `stock-exchanges-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Export to CSV
          </button>
        </div>
      )}
    </div>
  );
}
