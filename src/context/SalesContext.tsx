import React, { createContext, useContext, useState, useCallback } from "react";

export type Sale = {
  id: string;
  date: Date;
  shopId?: string;
  saleType: 'in-shop' | 'wholesale';
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  total: number;
};

type SalesContextType = {
  sales: Sale[];
  addSale: (items: Array<{ name: string; qty: number; price: number }>, total: number, shopId?: string, saleType?: 'in-shop' | 'wholesale') => void;
  getDailyRevenue: () => number;
  getWeeklyRevenue: () => number;
  getMonthlyRevenue: () => number;
  getDailySales: () => Sale[];
  getWeeklySales: () => Sale[];
  getMonthlySales: () => Sale[];
  getTotalItemsSoldToday: () => number;
  getRevenueByPeriod: (period: 'daily' | 'weekly' | 'monthly') => Array<{ period: string; revenue: number }>;
  getItemsSoldByProduct: () => Array<{ name: string; qty: number; category: string }>;
};

const SalesContext = createContext<SalesContextType | null>(null);

export const SalesProvider = ({ children }: { children: React.ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);

  const addSale = useCallback((items: Array<{ name: string; qty: number; price: number }>, total: number, shopId?: string, saleType: 'in-shop' | 'wholesale' = 'in-shop') => {
    const newSale: Sale = {
      id: Date.now().toString(),
      date: new Date(),
      shopId,
      saleType,
      items,
      total,
    };
    setSales((prev) => [...prev, newSale]);
  }, []);

  const getDailyRevenue = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sales
      .filter((sale) => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      })
      .reduce((sum, sale) => sum + sale.total, 0);
  }, [sales]);

  const getWeeklyRevenue = useCallback(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sales
      .filter((sale) => new Date(sale.date) >= weekAgo)
      .reduce((sum, sale) => sum + sale.total, 0);
  }, [sales]);

  const getMonthlyRevenue = useCallback(() => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return sales
      .filter((sale) => new Date(sale.date) >= monthAgo)
      .reduce((sum, sale) => sum + sale.total, 0);
  }, [sales]);

  const getDailySales = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    });
  }, [sales]);

  const getWeeklySales = useCallback(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sales.filter((sale) => new Date(sale.date) >= weekAgo);
  }, [sales]);

  const getMonthlySales = useCallback(() => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return sales.filter((sale) => new Date(sale.date) >= monthAgo);
  }, [sales]);

  const getTotalItemsSoldToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sales
      .filter((sale) => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
      })
      .reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  }, [sales]);

  const getRevenueByPeriod = useCallback((period: 'daily' | 'weekly' | 'monthly') => {
    const now = new Date();
    const data: Array<{ period: string; revenue: number }> = [];

    if (period === 'daily') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayRevenue = sales
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
    } else if (period === 'weekly') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekRevenue = sales
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
    } else if (period === 'monthly') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now);
        month.setMonth(month.getMonth() - i);
        month.setDate(1);
        month.setHours(0, 0, 0, 0);

        const nextMonth = new Date(month);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const monthRevenue = sales
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
  }, [sales]);

  const getItemsSoldByProduct = useCallback(() => {
    const itemMap = new Map<string, { name: string; qty: number; category: string }>();
    
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = itemMap.get(item.name);
        if (existing) {
          existing.qty += item.qty;
        } else {
          // Try to get category from inventory context
          // For now, we'll use a default category
          itemMap.set(item.name, {
            name: item.name,
            qty: item.qty,
            category: 'Unknown', // Will be updated by Dashboard
          });
        }
      });
    });
    
    return Array.from(itemMap.values());
  }, [sales]);

  return (
    <SalesContext.Provider
      value={{
        sales,
        addSale,
        getDailyRevenue,
        getWeeklyRevenue,
        getMonthlyRevenue,
        getDailySales,
        getWeeklySales,
        getMonthlySales,
        getTotalItemsSoldToday,
        getRevenueByPeriod,
        getItemsSoldByProduct,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};

export const useSales = () => {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("SalesContext not found");
  return ctx;
};
