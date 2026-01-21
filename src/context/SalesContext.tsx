import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export type Sale = {
  id: string;
  date: Date;
  shopId?: string;
  saleType: 'in-shop' | 'wholesale' | 'retail';
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  total: number;
  paymentType?: 'cash' | 'mpesa' | 'bank_deposit';
  paymentStatus?: 'pending' | 'partial' | 'fully_paid';
  amountPaid?: number;
  balance?: number;
  bank?: string;
  depositReference?: string;
  status?: 'open' | 'closed'; // For wholesale sales that stay open during the day
  closedAt?: Date; // When wholesale sale was closed
};

type SalesContextType = {
  sales: Sale[];
  openWholesaleSale: Sale | null; // Current open wholesale sale
  addSale: (items: Array<{ name: string; qty: number; price: number }>, total: number, shopId?: string, saleType?: 'in-shop' | 'wholesale' | 'retail') => void;
  addItemToWholesaleSale: (item: { name: string; qty: number; price: number }, shopId?: string) => void;
  closeWholesaleSale: (paymentType: 'cash' | 'mpesa' | 'bank_deposit', depositReference?: string, bank?: string) => void;
  deleteSale: (saleId: string) => void;
  getDailyRevenue: () => number;
  getWeeklyRevenue: () => number;
  getMonthlyRevenue: () => number;
  getDailySales: () => Sale[];
  getWeeklySales: () => Sale[];
  getMonthlySales: () => Sale[];
  getTotalItemsSoldToday: () => number;
  getRevenueByPeriod: (period: 'daily' | 'weekly' | 'monthly') => Array<{ period: string; revenue: number }>;
  getItemsSoldByProduct: () => Array<{ name: string; qty: number; category: string }>;
  getTodaysSalesReport: () => {
    totalSales: number;
    retailSales: number;
    wholesaleSales: number;
    totalAmount: number;
    totalDeposited: number;
    transactionReferences: Array<{ method: string; reference: string; amount: number; bank?: string }>;
  };
};

const SalesContext = createContext<SalesContextType | null>(null);

export const SalesProvider = ({ children }: { children: React.ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [openWholesaleSale, setOpenWholesaleSale] = useState<Sale | null>(null);

  // Helper function to load sale with items
  const loadSaleWithItems = useCallback(async (saleData: any): Promise<Sale> => {
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleData.id);

    return {
      id: saleData.id,
      date: new Date(saleData.date),
      shopId: saleData.shop_id || undefined,
      saleType: saleData.sale_type as 'in-shop' | 'wholesale' | 'retail',
      items: (itemsData || []).map((i: any) => ({
        name: i.name,
        qty: i.qty,
        price: Number(i.price) || 0,
      })),
      total: Number(saleData.total) || 0,
      status: saleData.status as 'open' | 'closed',
      closedAt: saleData.closed_at ? new Date(saleData.closed_at) : undefined,
    };
  }, []);

  // Load sales from Supabase on mount and set up real-time subscription
  useEffect(() => {
    let cancelled = false;
    
    // Initial load
    (async () => {
      try {
        const { data: salesData, error: salesError } = await supabase
          .from("sales")
          .select("*")
          .order("date", { ascending: false });
        if (salesError) throw salesError;
        if (cancelled) return;

        const salesWithItems: Sale[] = await Promise.all(
          (salesData || []).map(s => loadSaleWithItems(s))
        );
        setSales(salesWithItems.filter((s) => s.status === 'closed'));

        // Find open wholesale sale from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const openSale = salesWithItems.find((s) => {
          if (s.status !== 'open' || s.saleType !== 'wholesale') return false;
          const saleDate = new Date(s.date);
          saleDate.setHours(0, 0, 0, 0);
          return saleDate.getTime() === today.getTime();
        });
        setOpenWholesaleSale(openSale || null);
      } catch (e) {
        console.error("Error loading sales from Supabase:", e);
        setSales([]);
        setOpenWholesaleSale(null);
      }
    })();

    // Set up real-time subscription
    const channel = supabase
      .channel('sales-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        async () => {
          if (cancelled) return;
          
          try {
            const { data: salesData } = await supabase
              .from("sales")
              .select("*")
              .order("date", { ascending: false });
            
            if (salesData) {
              const salesWithItems: Sale[] = await Promise.all(
                salesData.map(s => loadSaleWithItems(s))
              );
              setSales(salesWithItems.filter((s) => s.status === 'closed'));

              // Update open wholesale sale
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const openSale = salesWithItems.find((s) => {
                if (s.status !== 'open' || s.saleType !== 'wholesale') return false;
                const saleDate = new Date(s.date);
                saleDate.setHours(0, 0, 0, 0);
                return saleDate.getTime() === today.getTime();
              });
              setOpenWholesaleSale(openSale || null);
            }
          } catch (e) {
            console.error("Error reloading sales:", e);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [loadSaleWithItems]);

  const addSale = useCallback((items: Array<{ name: string; qty: number; price: number }>, total: number, shopId?: string, saleType: 'in-shop' | 'wholesale' | 'retail' = 'in-shop') => {
    (async () => {
      const status = saleType === 'wholesale' ? 'open' : 'closed';
      
      // Insert sale
      const { data: saleRecord, error: saleError } = await supabase
        .from("sales")
        .insert({
          shop_id: shopId || null,
          sale_type: saleType,
          total: total,
          status: status,
          closed_at: status === 'closed' ? new Date().toISOString() : null,
        })
        .select("*")
        .single();
      if (saleError) {
        console.error("Error adding sale:", saleError);
        return;
      }

      // Insert sale items
      const itemsPayload = items.map((item) => ({
        sale_id: saleRecord.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
      }));
      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsPayload);
      if (itemsError) {
        console.error("Error adding sale items:", itemsError);
        return;
      }

      const newSale: Sale = {
        id: saleRecord.id,
        date: new Date(saleRecord.date),
        shopId: saleRecord.shop_id || undefined,
        saleType: saleRecord.sale_type as 'in-shop' | 'wholesale' | 'retail',
        items: items,
        total: Number(saleRecord.total) || 0,
        status: saleRecord.status as 'open' | 'closed',
        closedAt: saleRecord.closed_at ? new Date(saleRecord.closed_at) : undefined,
      };
      
      if (saleType === 'wholesale') {
        setOpenWholesaleSale(newSale);
      } else {
        setSales((prev) => [newSale, ...prev]);
      }
    })();
  }, []);

  const addItemToWholesaleSale = useCallback((item: { name: string; qty: number; price: number }, shopId?: string) => {
    (async () => {
      if (!openWholesaleSale) {
        // Create new wholesale sale if none exists
        await addSale([item], item.qty * item.price, shopId, 'wholesale');
      } else {
        // Add item to existing sale
        const updatedItems = [...openWholesaleSale.items, item];
        const updatedTotal = updatedItems.reduce((sum, i) => sum + (i.qty * i.price), 0);
        
        // Update sale total
        const { error: updateError } = await supabase
          .from("sales")
          .update({ total: updatedTotal })
          .eq("id", openWholesaleSale.id);
        if (updateError) {
          console.error("Error updating wholesale sale:", updateError);
          return;
        }

        // Add new item
        const { error: itemError } = await supabase
          .from("sale_items")
          .insert({
            sale_id: openWholesaleSale.id,
            name: item.name,
            qty: item.qty,
            price: item.price,
          });
        if (itemError) {
          console.error("Error adding item to wholesale sale:", itemError);
          return;
        }

        setOpenWholesaleSale({
          ...openWholesaleSale,
          items: updatedItems,
          total: updatedTotal,
        });
      }
    })();
  }, [openWholesaleSale, addSale]);

  const closeWholesaleSale = useCallback((paymentType: 'cash' | 'mpesa' | 'bank_deposit', depositReference?: string, bank?: string) => {
    (async () => {
      if (!openWholesaleSale) return;
      
      const { error } = await supabase
        .from("sales")
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq("id", openWholesaleSale.id);
      if (error) {
        console.error("Error closing wholesale sale:", error);
        return;
      }
      
      const closedSale: Sale = {
        ...openWholesaleSale,
        status: 'closed',
        closedAt: new Date(),
        paymentType,
        paymentStatus: 'fully_paid',
        amountPaid: openWholesaleSale.total,
        balance: 0,
        depositReference,
        bank,
      };
      
      setSales((prev) => [closedSale, ...prev]);
      setOpenWholesaleSale(null);
    })();
  }, [openWholesaleSale]);

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

  const getTodaysSalesReport = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    });

    const retailSales = todaysSales.filter(s => s.saleType === 'retail' || s.saleType === 'in-shop').length;
    const wholesaleSales = todaysSales.filter(s => s.saleType === 'wholesale').length;
    const totalAmount = todaysSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalDeposited = todaysSales
      .filter(s => s.paymentStatus === 'fully_paid' && s.amountPaid)
      .reduce((sum, sale) => sum + (sale.amountPaid || 0), 0);
    
    const transactionReferences = todaysSales
      .filter(s => s.depositReference || s.paymentType)
      .map(sale => ({
        method: sale.paymentType || 'unknown',
        reference: sale.depositReference || 'N/A',
        amount: sale.total,
        bank: sale.bank,
      }));

    return {
      totalSales: todaysSales.length,
      retailSales,
      wholesaleSales,
      totalAmount,
      totalDeposited,
      transactionReferences,
    };
  }, [sales]);

  const deleteSale = useCallback((saleId: string) => {
    (async () => {
      // Delete related sale items first
      await supabase.from("sale_items").delete().eq("sale_id", saleId);
      
      // Delete the sale
      const { error } = await supabase.from("sales").delete().eq("id", saleId);
      if (error) {
        console.error("Error deleting sale:", error);
        return;
      }
      
      setSales((prev) => prev.filter((sale) => sale.id !== saleId));
    })();
  }, []);

  return (
    <SalesContext.Provider
      value={{
        sales,
        openWholesaleSale,
        addSale,
        addItemToWholesaleSale,
        closeWholesaleSale,
        deleteSale,
        getDailyRevenue,
        getWeeklyRevenue,
        getMonthlyRevenue,
        getDailySales,
        getWeeklySales,
        getMonthlySales,
        getTotalItemsSoldToday,
        getRevenueByPeriod,
        getItemsSoldByProduct,
        getTodaysSalesReport,
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
