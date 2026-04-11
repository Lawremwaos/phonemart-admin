import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useShop } from "./ShopContext";

export type SaleItemInput = {
  name: string;
  qty: number;
  price: number;
  itemId?: number;
  adminBasePrice?: number;
  actualCost?: number;
};

export type SaleItem = {
  name: string;
  qty: number;
  price: number;
  itemId?: number;
  adminBasePrice?: number;
  actualCost?: number; // only present for admin; never returned to staff
};

export type Sale = {
  id: string;
  date: Date;
  shopId?: string;
  saleType: 'in-shop' | 'wholesale' | 'retail' | 'repair';
  repairId?: string; // set when sale is from repair invoice (accessories sold in repair)
  items: SaleItem[];
  total: number;
  paymentType?: 'cash' | 'mpesa' | 'bank_deposit';
  paymentStatus?: 'pending' | 'partial' | 'fully_paid';
  amountPaid?: number;
  balance?: number;
  bank?: string;
  depositReference?: string;
  status?: 'open' | 'closed';
  closedAt?: Date;
  soldBy?: string;
  /** Walk-in customer for retail/wholesale (requires DB columns — see supabase/add_sales_customer_columns.sql) */
  customerName?: string;
  customerPhone?: string;
  saleNotes?: string;
};

type SalesContextType = {
  sales: Sale[];
  openWholesaleSale: Sale | null;
  addSale: (
    items: SaleItemInput[],
    total: number,
    shopId?: string,
    saleType?: 'in-shop' | 'wholesale' | 'retail',
    repairId?: string,
    options?: { customerName?: string; customerPhone?: string; saleNotes?: string }
  ) => Promise<string | null>;
  addItemToWholesaleSale: (item: SaleItemInput, shopId?: string) => void;
  addRepairAccessorySale: (repairId: string, shopId: string | undefined, items: Array<{ itemId?: number; name: string; qty: number; sellingPrice: number; adminBasePrice?: number; actualCost?: number }>, soldBy?: string) => Promise<void>;
  closeWholesaleSale: (
    paymentType: 'cash' | 'mpesa' | 'bank_deposit',
    depositReference?: string,
    bank?: string,
    customer?: { customerName?: string; customerPhone?: string; saleNotes?: string }
  ) => Promise<boolean>;
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
  const { currentUser } = useShop();
  const [sales, setSales] = useState<Sale[]>([]);
  const [openWholesaleSale, setOpenWholesaleSale] = useState<Sale | null>(null);
  const lastLocalUpdateRef = useRef<number>(0);
  const DEBOUNCE_MS = 3000;

  // Staff must never receive actual_cost. Select columns accordingly.
  const loadSaleWithItems = useCallback(async (saleData: any): Promise<Sale> => {
    const isAdmin = currentUser?.roles?.includes('admin');
    const itemCols = isAdmin ? 'id,sale_id,name,qty,price,item_id,admin_base_price,actual_cost' : 'id,sale_id,name,qty,price,item_id,admin_base_price';
    const { data: itemsData } = await supabase
      .from("sale_items")
      .select(itemCols)
      .eq("sale_id", saleData.id);

    const items: SaleItem[] = (itemsData || []).map((i: any) => {
      const out: SaleItem = {
        name: i.name,
        qty: i.qty,
        price: Number(i.price) || 0,
      };
      if (i.item_id != null) out.itemId = i.item_id;
      if (i.admin_base_price != null) out.adminBasePrice = Number(i.admin_base_price);
      if (isAdmin && i.actual_cost != null) out.actualCost = Number(i.actual_cost);
      return out;
    });

    return {
      id: saleData.id,
      date: new Date(saleData.date),
      shopId: saleData.shop_id || undefined,
      saleType: (saleData.sale_type || 'in-shop') as Sale['saleType'],
      repairId: saleData.repair_id || undefined,
      items,
      total: Number(saleData.total) || 0,
      status: saleData.status as 'open' | 'closed',
      closedAt: saleData.closed_at ? new Date(saleData.closed_at) : undefined,
      soldBy: saleData.sold_by || undefined,
      customerName: saleData.customer_name || undefined,
      customerPhone: saleData.customer_phone || undefined,
      saleNotes: saleData.sale_notes || undefined,
    };
  }, [currentUser]);

  const loadAllSales = useCallback(async () => {
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .order("date", { ascending: false });
    if (salesError) throw salesError;
    return Promise.all((salesData || []).map((s: any) => loadSaleWithItems(s)));
  }, [loadSaleWithItems]);

  const processSalesData = useCallback((salesWithItems: Sale[]) => {
    setSales(salesWithItems.filter((s) => s.status === 'closed'));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const openSale = salesWithItems.find((s) => {
      if (s.status !== 'open' || s.saleType !== 'wholesale') return false;
      const saleDate = new Date(s.date);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    });
    setOpenWholesaleSale(openSale || null);
  }, []);

  // Load sales from Supabase on mount and set up real-time subscription + polling
  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        const loaded = await loadAllSales();
        if (!cancelled) processSalesData(loaded);
      } catch (e) {
        console.error("Error loading sales from Supabase:", e);
        if (!cancelled) { setSales([]); setOpenWholesaleSale(null); }
      }
    })();

    const channel = supabase
      .channel('sales-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        async () => {
          if (cancelled) return;
          const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
          if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
          
          try {
            const loaded = await loadAllSales();
            if (!cancelled) processSalesData(loaded);
          } catch (e) {
            console.error("Error reloading sales:", e);
          }
        }
      )
      .subscribe((status) => {
        console.log("Sales real-time subscription status:", status);
      });

    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
      
      try {
        const loaded = await loadAllSales();
        if (!cancelled) processSalesData(loaded);
      } catch (e) {
        console.error("Error polling sales:", e);
      }
    }, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadAllSales, processSalesData]);

  const addSale = useCallback(async (
    items: SaleItemInput[],
    total: number,
    shopId?: string,
    saleType: 'in-shop' | 'wholesale' | 'retail' = 'in-shop',
    repairId?: string,
    options?: { customerName?: string; customerPhone?: string; saleNotes?: string }
  ): Promise<string | null> => {
    const status = saleType === 'wholesale' ? 'open' : 'closed';
    const soldBy = currentUser?.name || undefined;
    const insertPayload: Record<string, unknown> = {
      shop_id: shopId || null,
      sale_type: saleType,
      total: total,
      status: status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
      sold_by: soldBy || null,
      repair_id: repairId || null,
    };
    if (options?.customerName?.trim()) insertPayload.customer_name = options.customerName.trim();
    if (options?.customerPhone?.trim()) insertPayload.customer_phone = options.customerPhone.trim();
    if (options?.saleNotes?.trim()) insertPayload.sale_notes = options.saleNotes.trim();

    const { data: saleRecord, error: saleError } = await supabase
      .from("sales")
      .insert(insertPayload)
      .select("*")
      .single();
    if (saleError) {
      console.error("Error adding sale:", saleError);
      return null;
    }

    const itemsPayload = items.map((item) => ({
      sale_id: saleRecord.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      item_id: item.itemId ?? null,
      admin_base_price: item.adminBasePrice ?? null,
      actual_cost: item.actualCost ?? null,
    }));
    const { error: itemsError } = await supabase
      .from("sale_items")
      .insert(itemsPayload);
    if (itemsError) {
      console.error("Error adding sale items:", itemsError);
      return null;
    }

    const rec = saleRecord as Record<string, unknown>;
    const newSale: Sale = {
      id: saleRecord.id,
      date: new Date(saleRecord.date),
      shopId: saleRecord.shop_id || undefined,
      saleType: (saleRecord.sale_type || saleType) as Sale['saleType'],
      repairId: saleRecord.repair_id || undefined,
      items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, itemId: i.itemId, adminBasePrice: i.adminBasePrice, actualCost: i.actualCost })),
      total: Number(saleRecord.total) || 0,
      status: saleRecord.status as 'open' | 'closed',
      closedAt: saleRecord.closed_at ? new Date(saleRecord.closed_at) : undefined,
      soldBy: saleRecord.sold_by || undefined,
      customerName: typeof rec.customer_name === 'string' ? rec.customer_name : undefined,
      customerPhone: typeof rec.customer_phone === 'string' ? rec.customer_phone : undefined,
      saleNotes: typeof rec.sale_notes === 'string' ? rec.sale_notes : undefined,
    };
    lastLocalUpdateRef.current = Date.now();
    if (saleType === 'wholesale') {
      setOpenWholesaleSale(newSale);
    } else {
      setSales((prev) => [newSale, ...prev]);
    }
    return saleRecord.id as string;
  }, [currentUser]);

  const addRepairAccessorySale = useCallback(async (repairId: string, shopId: string | undefined, items: Array<{ itemId?: number; name: string; qty: number; sellingPrice: number; adminBasePrice?: number; actualCost?: number }>, soldBy?: string): Promise<void> => {
    if (items.length === 0) return;
    const { data: existingSale, error: existingSaleError } = await supabase
      .from("sales")
      .select("id")
      .eq("sale_type", "repair")
      .eq("repair_id", repairId)
      .limit(1)
      .maybeSingle();
    if (existingSaleError) {
      console.error("Error checking existing repair accessory sale:", existingSaleError);
      throw new Error("Failed to verify existing repair sale");
    }
    if (existingSale?.id) {
      // Idempotency guard: this repair sale was already recorded.
      return;
    }
    const total = items.reduce((sum, i) => sum + i.qty * i.sellingPrice, 0);
    const { data: saleRecord, error: saleError } = await supabase
      .from("sales")
      .insert({
        shop_id: shopId || null,
        sale_type: 'repair',
        repair_id: repairId,
        total,
        status: 'closed',
        closed_at: new Date().toISOString(),
        sold_by: soldBy || null,
      })
      .select("*")
      .single();
    if (saleError) {
      console.error("Error adding repair accessory sale:", saleError);
      throw new Error("Failed to record accessory sale");
    }
    const itemsPayload = items.map((i) => ({
      sale_id: saleRecord.id,
      name: i.name,
      qty: i.qty,
      price: i.sellingPrice,
      item_id: i.itemId ?? null,
      admin_base_price: i.adminBasePrice ?? null,
      actual_cost: i.actualCost ?? null,
    }));
    const { error: itemsError } = await supabase.from("sale_items").insert(itemsPayload);
    if (itemsError) {
      console.error("Error adding repair accessory sale items:", itemsError);
      throw new Error("Failed to record accessory sale items");
    }
    const newSale: Sale = {
      id: saleRecord.id,
      date: new Date(saleRecord.date),
      shopId: saleRecord.shop_id || undefined,
      saleType: 'repair',
      repairId: repairId,
      items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.sellingPrice, itemId: i.itemId, adminBasePrice: i.adminBasePrice, actualCost: i.actualCost })),
      total: Number(saleRecord.total) || 0,
      status: 'closed',
      closedAt: new Date(saleRecord.closed_at),
      soldBy: saleRecord.sold_by || undefined,
    };
    lastLocalUpdateRef.current = Date.now();
    setSales((prev) => [newSale, ...prev]);
  }, []);

  const addItemToWholesaleSale = useCallback((item: SaleItemInput, shopId?: string) => {
    (async () => {
      const saleItem = { name: item.name, qty: item.qty, price: item.price, itemId: item.itemId, adminBasePrice: item.adminBasePrice, actualCost: item.actualCost };
      if (!openWholesaleSale) {
        await addSale([saleItem], item.qty * item.price, shopId, 'wholesale');
      } else {
        const updatedItems = [...openWholesaleSale.items, saleItem];
        const updatedTotal = updatedItems.reduce((sum, i) => sum + (i.qty * i.price), 0);

        const { error: updateError } = await supabase
          .from("sales")
          .update({ total: updatedTotal })
          .eq("id", openWholesaleSale.id);
        if (updateError) {
          console.error("Error updating wholesale sale:", updateError);
          return;
        }

        const { error: itemError } = await supabase
          .from("sale_items")
          .insert({
            sale_id: openWholesaleSale.id,
            name: item.name,
            qty: item.qty,
            price: item.price,
            item_id: item.itemId ?? null,
            admin_base_price: item.adminBasePrice ?? null,
            actual_cost: item.actualCost ?? null,
          });
        if (itemError) {
          console.error("Error adding item to wholesale sale:", itemError);
          return;
        }

        lastLocalUpdateRef.current = Date.now();
        setOpenWholesaleSale({
          ...openWholesaleSale,
          items: updatedItems,
          total: updatedTotal,
        });
      }
    })();
  }, [openWholesaleSale, addSale]);

  const closeWholesaleSale = useCallback(async (
    paymentType: 'cash' | 'mpesa' | 'bank_deposit',
    depositReference?: string,
    bank?: string,
    customer?: { customerName?: string; customerPhone?: string; saleNotes?: string }
  ): Promise<boolean> => {
      if (!openWholesaleSale) return false;

      const updatePayload: Record<string, unknown> = {
        status: 'closed',
        closed_at: new Date().toISOString(),
      };
      if (customer?.customerName?.trim()) updatePayload.customer_name = customer.customerName.trim();
      if (customer?.customerPhone?.trim()) updatePayload.customer_phone = customer.customerPhone.trim();
      if (customer?.saleNotes?.trim()) updatePayload.sale_notes = customer.saleNotes.trim();

      const { error } = await supabase
        .from("sales")
        .update(updatePayload)
        .eq("id", openWholesaleSale.id);
      if (error) {
        console.error("Error closing wholesale sale:", error);
        return false;
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
        customerName: customer?.customerName?.trim() || openWholesaleSale.customerName,
        customerPhone: customer?.customerPhone?.trim() || openWholesaleSale.customerPhone,
        saleNotes: customer?.saleNotes?.trim() || openWholesaleSale.saleNotes,
      };
      
      lastLocalUpdateRef.current = Date.now();
      setSales((prev) => [closedSale, ...prev]);
      setOpenWholesaleSale(null);
      return true;
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
      
      lastLocalUpdateRef.current = Date.now();
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
        addRepairAccessorySale,
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
