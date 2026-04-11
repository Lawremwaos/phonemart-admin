import { useState, useMemo } from "react";
import { useSales } from "../context/SalesContext";
import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { useRepair } from "../context/RepairContext";
import { usePayment } from "../context/PaymentContext";
import ShopSelector from "../components/ShopSelector";
import AutomatedDailyReport from "../components/AutomatedDailyReport";

type Period = 'today' | 'week' | 'month';

export default function Dashboard() {
  const { sales } = useSales();
  const { items, purchases } = useInventory();
  const { currentShop, currentUser } = useShop();
  const { repairs } = useRepair();
  const { getPendingCashDeposits } = usePayment();
  const [period, setPeriod] = useState<Period>('today');

  const isAdmin = currentUser?.roles.includes('admin');
  const [revenuePeriod, setRevenuePeriod] = useState<Period>('today');

  // --- HELPERS ---
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const inPeriod = (date: Date, p: Period) => {
    const d = new Date(date);
    if (p === 'today') { d.setHours(0, 0, 0, 0); return d.getTime() === todayStart.getTime(); }
    if (p === 'week') return d >= weekStart;
    return d >= monthStart;
  };

  // --- FILTERED DATA ---
  const shopSales = useMemo(() => {
    if (isAdmin) return sales;
    if (!currentShop) return sales;
    return sales.filter(s => s.shopId === currentShop.id);
  }, [sales, currentShop, isAdmin]);

  const shopRepairs = useMemo(() => {
    if (isAdmin) return repairs;
    if (!currentShop) return repairs;
    return repairs.filter(r => r.shopId === currentShop.id);
  }, [repairs, currentShop, isAdmin]);

  const shopItems = useMemo(() => {
    if (isAdmin) return items;
    if (!currentShop) return items;
    return items.filter(i => i.shopId === currentShop.id);
  }, [items, currentShop, isAdmin]);

  // --- 1. SALES OVERVIEW (Day / Week / Month) ---
  const salesData = useMemo(() => {
    const calc = (p: Period) => {
      const periodSales = shopSales.filter(s => inPeriod(s.date, p));
      const periodRepairs = shopRepairs.filter(r => inPeriod(r.date, p));

      const accessoryRevenue = periodSales.reduce((sum, s) => sum + s.total, 0);
      const accessoryCount = periodSales.length;
      const repairRevenue = periodRepairs.reduce((sum, r) => sum + (r.totalAgreedAmount || r.totalCost), 0);
      const repairCount = periodRepairs.length;
      const totalRevenue = accessoryRevenue + repairRevenue;
      const totalCount = accessoryCount + repairCount;

      return { accessoryRevenue, accessoryCount, repairRevenue, repairCount, totalRevenue, totalCount };
    };
    return { today: calc('today'), week: calc('week'), month: calc('month') };
  }, [shopSales, shopRepairs]);

  // --- 2. PHONE REPAIR vs ACCESSORIES breakdown ---
  const categoryData = useMemo(() => {
    const calc = (p: Period) => {
      const periodSales = shopSales.filter(s => inPeriod(s.date, p));
      const periodRepairs = shopRepairs.filter(r => inPeriod(r.date, p));
      return {
        repairSales: periodRepairs.length,
        repairRevenue: periodRepairs.reduce((sum, r) => sum + (r.totalAgreedAmount || r.totalCost), 0),
        accessorySales: periodSales.length,
        accessoryRevenue: periodSales.reduce((sum, s) => sum + s.total, 0),
      };
    };
    return { today: calc('today'), week: calc('week'), month: calc('month') };
  }, [shopSales, shopRepairs]);

  // --- 3. COST OF PARTS (Day / Week / Month) ---
  const costData = useMemo(() => {
    const calc = (p: Period) => {
      const periodRepairs = shopRepairs.filter(r => inPeriod(r.date, p));
      const partsCost = periodRepairs.reduce((sum, r) =>
        sum + r.partsUsed.reduce((s, part) => s + (part.cost * part.qty), 0), 0
      );
      const partsCount = periodRepairs.reduce((sum, r) =>
        sum + r.partsUsed.filter(p => p.cost > 0).length, 0
      );
      return { partsCost, partsCount };
    };
    return { today: calc('today'), week: calc('week'), month: calc('month') };
  }, [shopRepairs]);

  // --- 4. SUPPLIER PAYMENTS (Day / Week / Month) ---
  // Staff: Only local suppliers | Admin: Both local and wholesale separately
  const supplierData = useMemo(() => {
    const calc = (p: Period) => {
      // Filter purchases based on user role
      let periodPurchases = purchases.filter(pu => inPeriod(pu.date, p));
      
      // Staff only see local suppliers
      if (!isAdmin) {
        periodPurchases = periodPurchases.filter(pu => pu.supplierType === 'local' || !pu.supplierType);
      }

      const totalPaid = periodPurchases.reduce((sum, pu) => sum + pu.total, 0);
      const orderCount = periodPurchases.length;

      // Per-supplier breakdown
      const supplierMap: Record<string, { name: string; amount: number; orders: number; type?: 'local' | 'wholesale' }> = {};
      periodPurchases.forEach(pu => {
        if (!supplierMap[pu.supplier]) {
          supplierMap[pu.supplier] = { 
            name: pu.supplier, 
            amount: 0, 
            orders: 0,
            type: pu.supplierType || 'local'
          };
        }
        supplierMap[pu.supplier].amount += pu.total;
        supplierMap[pu.supplier].orders++;
      });
      const suppliers = Object.values(supplierMap).sort((a, b) => b.amount - a.amount);

      // For admin: separate local and wholesale
      if (isAdmin) {
        const allPeriodPurchases = purchases.filter(pu => inPeriod(pu.date, p));
        const localPurchases = allPeriodPurchases.filter(pu => pu.supplierType === 'local' || !pu.supplierType);
        const wholesalePurchases = allPeriodPurchases.filter(pu => pu.supplierType === 'wholesale');
        const localTotal = localPurchases.reduce((sum, pu) => sum + pu.total, 0);
        const wholesaleTotal = wholesalePurchases.reduce((sum, pu) => sum + pu.total, 0);
        
        return { 
          totalPaid, 
          orderCount, 
          suppliers,
          localTotal,
          wholesaleTotal,
          localOrders: localPurchases.length,
          wholesaleOrders: wholesalePurchases.length
        };
      }

      return { totalPaid, orderCount, suppliers };
    };
    return { today: calc('today'), week: calc('week'), month: calc('month') };
  }, [purchases, isAdmin]);

  // --- 5. REVENUE OVERVIEW (Day / Week / Month) ---
  const revenueOverview = useMemo(() => {
    const calc = (p: Period) => {
      const sd = salesData[p];
      const cd = costData[p];
      const sp = supplierData[p];
      const totalCosts = cd.partsCost + sp.totalPaid;
      const profit = sd.totalRevenue - cd.partsCost;
      return { ...sd, partsCost: cd.partsCost, supplierPaid: sp.totalPaid, totalCosts, profit };
    };
    return { today: calc('today'), week: calc('week'), month: calc('month') };
  }, [salesData, costData, supplierData]);

  // Current period data
  const currentSales = salesData[period];
  const currentCategory = categoryData[period];
  const currentCost = costData[period];
  const currentSupplier = supplierData[period];
  // --- EXISTING DATA (kept) ---
  const lowStockItems = shopItems.filter(item => item.stock <= item.reorderLevel);
  const lowStockCount = lowStockItems.length;
  const pendingDeposits = getPendingCashDeposits();
  const pendingDepositsAmount = pendingDeposits.reduce((sum, p) => sum + p.amount, 0);

  const pendingPhonesToCollect = useMemo(() => shopRepairs.filter(repair =>
    ((repair.status === 'FULLY_PAID' || repair.status === 'REPAIR_COMPLETED') && repair.customerStatus === 'coming_back') ||
    (repair.depositAmount && repair.depositAmount > 0 && (repair.paymentStatus === 'partial' || repair.paymentStatus === 'pending'))
  ), [shopRepairs]);

  const pendingPayments = useMemo(() => shopRepairs.filter(repair =>
    repair.paymentStatus === 'partial' || repair.paymentStatus === 'pending' ||
    (repair.paymentTiming === 'after' && repair.paymentStatus !== 'fully_paid')
  ), [shopRepairs]);
  const pendingPaymentsAmount = pendingPayments.reduce((sum, r) => sum + r.balance, 0);

  const shopItemsSoldData = useMemo(() => {
    const m = new Map<string, number>();
    shopSales.forEach(s => s.items.forEach(i => m.set(i.name, (m.get(i.name) || 0) + i.qty)));
    return Array.from(m.entries()).map(([name, qty]) => ({ name, qty }));
  }, [shopSales]);

  const inventoryMovement = shopItems.map(item => {
    const sold = shopItemsSoldData.find(s => s.name === item.name)?.qty || Math.max(0, item.initialStock - item.stock);
    return { name: item.name, available: item.stock, sold, category: item.category, reorderLevel: item.reorderLevel };
  });

  const mostSoldItems = [...inventoryMovement].filter(i => i.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 10);
  const topAccessories = [...inventoryMovement].filter(i => i.category === 'Accessory').sort((a, b) => b.sold - a.sold).slice(0, 5);
  const topSpares = [...inventoryMovement].filter(i => i.category === 'Spare').sort((a, b) => b.sold - a.sold).slice(0, 5);

  const topOutsourcedItems = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; cost: number }>();
    repairs.forEach(r => r.partsUsed.filter(p => p.cost > 0).forEach(part => {
      const e = m.get(part.itemName);
      m.set(part.itemName, e
        ? { name: part.itemName, qty: e.qty + part.qty, cost: e.cost + (part.cost * part.qty) }
        : { name: part.itemName, qty: part.qty, cost: part.cost * part.qty });
    }));
    return Array.from(m.values()).sort((a, b) => b.cost - a.cost).slice(0, 10);
  }, [repairs]);

  const periodLabel = (p: Period) => p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-[var(--pm-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pm-accent)]">Overview</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-[var(--pm-ink)]">Dashboard</h2>
          <p className="mt-1 text-sm text-[var(--pm-ink-soft)]">Sales, repairs, and stock at a glance.</p>
        </div>
        <div className="shrink-0 text-right">
          {isAdmin ? (
            <span className="inline-flex items-center rounded-full bg-[var(--pm-surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--pm-ink-soft)] ring-1 ring-[var(--pm-border)]">
              All shops · aggregated
            </span>
          ) : currentShop ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--pm-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--pm-ink-soft)] ring-1 ring-[var(--pm-border)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--pm-accent)]" />
              {currentShop.name}
            </span>
          ) : null}
        </div>
      </div>

      <ShopSelector />

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        {(['today', 'week', 'month'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${period === p ? 'bg-gradient-to-r from-[var(--pm-accent)] to-[var(--pm-accent-strong)] text-white shadow-md shadow-[rgba(79,122,101,0.25)]' : 'border border-[var(--pm-border)] bg-[var(--pm-surface)] text-[var(--pm-ink-soft)] shadow-sm hover:bg-[var(--pm-surface-soft)] hover:text-[var(--pm-ink)]'}`}>
            {periodLabel(p)}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {(pendingPhonesToCollect.length > 0 || pendingPayments.length > 0 || lowStockCount > 0 || pendingDepositsAmount > 0) && (
        <div className="rounded-2xl border border-[var(--pm-border)] bg-[var(--pm-surface)] p-5 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-[var(--pm-ink)]">Alerts</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pendingPhonesToCollect.length > 0 && (
              <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-3 text-center">
                <p className="text-xs text-[var(--pm-ink-soft)]">Phones to Collect</p>
                <p className="text-xl font-bold text-[var(--pm-accent-strong)]">{pendingPhonesToCollect.length}</p>
              </div>
            )}
            {pendingPayments.length > 0 && (
              <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-3 text-center">
                <p className="text-xs text-[var(--pm-ink-soft)]">Pending Payments</p>
                <p className="text-xl font-bold text-red-700">{pendingPayments.length}</p>
                <p className="text-xs text-[var(--pm-ink-soft)]">KES {pendingPaymentsAmount.toLocaleString()}</p>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-3 text-center">
                <p className="text-xs text-[var(--pm-ink-soft)]">Low Stock</p>
                <p className="text-xl font-bold text-amber-700">{lowStockCount}</p>
              </div>
            )}
            {pendingDepositsAmount > 0 && (
              <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-3 text-center">
                <p className="text-xs text-[var(--pm-ink-soft)]">Pending Deposits</p>
                <p className="text-xl font-bold text-[var(--pm-accent-strong)]">KES {pendingDepositsAmount.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. SALES OVERVIEW */}
      <div className="pm-card pm-pad-lg">
        <h3 className="mb-4 text-lg font-semibold text-[var(--pm-ink)]">Sales Overview — {periodLabel(period)}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-4">
            <p className="text-xs font-medium text-[var(--pm-ink-soft)]">Total Sales</p>
            <p className="text-2xl font-bold text-[var(--pm-accent-strong)]">{currentSales.totalCount}</p>
            <p className="text-sm font-semibold text-[var(--pm-accent-strong)]">KES {currentSales.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-4">
            <p className="text-xs font-medium text-[var(--pm-ink-soft)]">Accessory Sales</p>
            <p className="text-2xl font-bold text-[var(--pm-ink)]">{currentSales.accessoryCount}</p>
            <p className="text-sm font-semibold text-[var(--pm-ink)]">KES {currentSales.accessoryRevenue.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-soft)] p-4">
            <p className="text-xs font-medium text-[var(--pm-ink-soft)]">Repair Sales</p>
            <p className="text-2xl font-bold text-[var(--pm-ink)]">{currentSales.repairCount}</p>
            <p className="text-sm font-semibold text-[var(--pm-ink)]">KES {currentSales.repairRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* Day / Week / Month comparison */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--pm-surface-soft)]">
              <tr>
                <th className="p-2 text-left">Period</th>
                <th className="p-2 text-right">Total Sales</th>
                <th className="p-2 text-right">Accessories</th>
                <th className="p-2 text-right">Repairs</th>
                <th className="p-2 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(['today', 'week', 'month'] as Period[]).map(p => (
                <tr key={p} className={`border-t border-[var(--pm-border)] ${p === period ? 'bg-[var(--pm-accent-soft)] font-semibold' : ''}`}>
                  <td className="p-2">{periodLabel(p)}</td>
                  <td className="p-2 text-right">{salesData[p].totalCount}</td>
                  <td className="p-2 text-right">{salesData[p].accessoryCount} (KES {salesData[p].accessoryRevenue.toLocaleString()})</td>
                  <td className="p-2 text-right">{salesData[p].repairCount} (KES {salesData[p].repairRevenue.toLocaleString()})</td>
                  <td className="p-2 text-right font-bold text-[var(--pm-accent-strong)]">KES {salesData[p].totalRevenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. PHONE REPAIR vs ACCESSORIES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="pm-card pm-pad-lg">
          <h3 className="text-lg font-semibold mb-3">Phone Repairs - {periodLabel(period)}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
              <span className="text-sm text-gray-700">Repairs Completed</span>
              <span className="text-xl font-bold text-orange-700">{currentCategory.repairSales}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
              <span className="text-sm text-gray-700">Repair Revenue</span>
              <span className="text-lg font-bold text-orange-700">KES {currentCategory.repairRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
              <span className="text-sm text-gray-700">Parts Cost</span>
              <span className="text-lg font-bold text-red-600">KES {currentCost.partsCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded border-t-2 border-green-400">
              <span className="text-sm font-semibold text-gray-700">Repair Profit</span>
              <span className={`text-lg font-bold ${currentCategory.repairRevenue - currentCost.partsCost >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                KES {(currentCategory.repairRevenue - currentCost.partsCost).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="pm-card pm-pad-lg">
          <h3 className="text-lg font-semibold mb-3">Accessories - {periodLabel(period)}</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="text-sm text-gray-700">Sales Made</span>
              <span className="text-xl font-bold text-blue-700">{currentCategory.accessorySales}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="text-sm text-gray-700">Revenue</span>
              <span className="text-lg font-bold text-blue-700">KES {currentCategory.accessoryRevenue.toLocaleString()}</span>
            </div>
            {/* Comparison table */}
            <div className="mt-2 text-xs">
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="p-1 text-left">Period</th><th className="p-1 text-right">Sales</th><th className="p-1 text-right">Revenue</th></tr></thead>
                <tbody>
                  {(['today', 'week', 'month'] as Period[]).map(p => (
                    <tr key={p} className={`border-t ${p === period ? 'bg-blue-50 font-semibold' : ''}`}>
                      <td className="p-1">{periodLabel(p)}</td>
                      <td className="p-1 text-right">{categoryData[p].accessorySales}</td>
                      <td className="p-1 text-right">KES {categoryData[p].accessoryRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 3. COST OF PARTS */}
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-4">Cost of Parts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <div key={p} className={`rounded-lg p-4 border ${p === period ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-xs text-gray-600 font-medium">{periodLabel(p)}</p>
              <p className="text-2xl font-bold text-red-700">KES {costData[p].partsCost.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{costData[p].partsCount} parts costed</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. TOTAL PAID TO SUPPLIERS */}
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-4">
          {isAdmin ? 'Supplier Payments' : 'Local Supplier Payments'}
        </h3>
        {isAdmin ? (
          <>
            {/* Admin: Show Local and Wholesale separately */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Local Suppliers - {periodLabel(period)}:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {(['today', 'week', 'month'] as Period[]).map(p => (
                  <div key={p} className={`rounded-lg p-4 border ${p === period ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-xs text-gray-600 font-medium">{periodLabel(p)}</p>
                    <p className="text-2xl font-bold text-green-700">
                      KES {((supplierData[p] as any).localTotal || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((supplierData[p] as any).localOrders || 0)} orders
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Wholesale Suppliers - {periodLabel(period)}:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {(['today', 'week', 'month'] as Period[]).map(p => (
                  <div key={p} className={`rounded-lg p-4 border ${p === period ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-xs text-gray-600 font-medium">{periodLabel(p)}</p>
                    <p className="text-2xl font-bold text-blue-700">
                      KES {((supplierData[p] as any).wholesaleTotal || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((supplierData[p] as any).wholesaleOrders || 0)} orders
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Total Supplier Payments - {periodLabel(period)}:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['today', 'week', 'month'] as Period[]).map(p => (
                  <div key={p} className={`rounded-lg p-4 border ${p === period ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-xs text-gray-600 font-medium">{periodLabel(p)}</p>
                    <p className="text-2xl font-bold text-purple-700">KES {supplierData[p].totalPaid.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{supplierData[p].orderCount} purchase orders</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Staff: Only show local suppliers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {(['today', 'week', 'month'] as Period[]).map(p => (
                <div key={p} className={`rounded-lg p-4 border ${p === period ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-xs text-gray-600 font-medium">{periodLabel(p)}</p>
                  <p className="text-2xl font-bold text-green-700">KES {supplierData[p].totalPaid.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{supplierData[p].orderCount} purchase orders</p>
                </div>
              ))}
            </div>
          </>
        )}
        {currentSupplier.suppliers.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Breakdown - {periodLabel(period)}:</p>
            <div className="space-y-2">
              {currentSupplier.suppliers.map(s => (
                <div key={s.name} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                  <span className="font-medium">{s.name}</span>
                  <div className="text-right">
                    <span className="font-bold text-purple-700">KES {s.amount.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 ml-2">({s.orders} orders)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. REVENUE OVERVIEW */}
      <div className="pm-card pm-pad-lg">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-semibold">Revenue Overview</h3>
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setRevenuePeriod(p)}
                className={`px-3 py-1 text-sm rounded transition ${
                  revenuePeriod === p
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {periodLabel(p)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Metric</th>
                <th className="p-3 text-right">{periodLabel(revenuePeriod)}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3 font-medium">Total Revenue</td>
                <td className="p-3 text-right font-bold text-green-700">KES {revenueOverview[revenuePeriod].totalRevenue.toLocaleString()}</td>
              </tr>
              <tr className="border-t bg-blue-50/50">
                <td className="p-3 text-gray-600">Accessory Revenue</td>
                <td className="p-3 text-right">KES {revenueOverview[revenuePeriod].accessoryRevenue.toLocaleString()}</td>
              </tr>
              <tr className="border-t bg-orange-50/50">
                <td className="p-3 text-gray-600">Repair Revenue</td>
                <td className="p-3 text-right">KES {revenueOverview[revenuePeriod].repairRevenue.toLocaleString()}</td>
              </tr>
              <tr className="border-t bg-red-50/50">
                <td className="p-3 text-gray-600">Parts Cost</td>
                <td className="p-3 text-right text-red-600">KES {revenueOverview[revenuePeriod].partsCost.toLocaleString()}</td>
              </tr>
              {isAdmin && (
                <tr className="border-t bg-purple-50/50">
                  <td className="p-3 text-gray-600">Supplier Payments</td>
                  <td className="p-3 text-right text-purple-600">KES {revenueOverview[revenuePeriod].supplierPaid.toLocaleString()}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-300 bg-green-50">
                <td className="p-3 font-bold">Profit (Revenue - Parts Cost)</td>
                <td className={`p-3 text-right font-bold ${revenueOverview[revenuePeriod].profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  KES {revenueOverview[revenuePeriod].profit.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* LOW STOCK ITEMS */}
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-4">Low Stock Items</h3>
        {lowStockItems.length === 0 ? (
          <p className="text-gray-500 text-center py-4">All items are well stocked!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Item Name</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3 text-right">Reorder Level</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(item => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-gray-600">{item.category}</td>
                    <td className="p-3 text-right">{item.stock}</td>
                    <td className="p-3 text-right text-gray-600">{item.reorderLevel}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${item.stock === 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
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

      {/* MOST SOLD ITEMS */}
      <div className="pm-card pm-pad-lg">
        <h3 className="text-lg font-semibold mb-4">Most Sold Items</h3>
        {mostSoldItems.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No sales data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Rank</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-right">Qty Sold</th>
                  <th className="p-3 text-right">Stock Left</th>
                </tr>
              </thead>
              <tbody>
                {mostSoldItems.map((item, i) => (
                  <tr key={item.name} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-600">#{i + 1}</td>
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-gray-600">{item.category}</td>
                    <td className="p-3 text-right font-semibold text-blue-600">{item.sold}</td>
                    <td className="p-3 text-right">{item.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TOP SELLING ACCESSORIES & SPARES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="pm-card pm-pad-lg">
          <h3 className="text-lg font-semibold mb-4">Top-Selling Accessories</h3>
          {topAccessories.length === 0 ? <p className="text-gray-500 text-center py-4">No accessories sold yet.</p> : (
            <div className="space-y-3">
              {topAccessories.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{i + 1}</span>
                    <div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-gray-500">Stock: {item.available}</p></div>
                  </div>
                  <p className="font-semibold text-blue-600">{item.sold} sold</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pm-card pm-pad-lg">
          <h3 className="text-lg font-semibold mb-4">Top-Selling Spares</h3>
          {topSpares.length === 0 ? <p className="text-gray-500 text-center py-4">No spares sold yet.</p> : (
            <div className="space-y-3">
              {topSpares.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{i + 1}</span>
                    <div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-gray-500">Stock: {item.available}</p></div>
                  </div>
                  <p className="font-semibold text-blue-600">{item.sold} sold</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOP OUTSOURCED ITEMS */}
      {topOutsourcedItems.length > 0 && (
        <div className="pm-card pm-pad-lg">
          <h3 className="text-lg font-semibold mb-4">Top Outsourced Items (All Time)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {topOutsourcedItems.map((item, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-right">{item.qty}</td>
                    <td className="p-3 text-right font-semibold text-orange-600">KES {item.cost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AutomatedDailyReport />
    </div>
  );
}
