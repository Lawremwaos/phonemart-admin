import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useShop } from "./ShopContext";

export type StockAllocation = {
  id: string;
  itemId: number;
  itemName: string;
  totalQty: number;
  allocations: Array<{
    shopId: string;
    shopName: string;
    qty: number;
    accepted?: boolean;
    acceptedBy?: string;
    acceptedAt?: Date;
  }>;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy?: string;
  requestedDate: Date;
  approvedBy?: string;
  approvedDate?: Date;
};

export type InventoryItem = {
  id: number;
  name: string;
  category: 'Phone' | 'Spare' | 'Accessory';
  itemType?: string;
  stock: number;
  price: number; // selling price (staff can see)
  reorderLevel: number;
  initialStock: number;
  shopId?: string;
  supplier?: string;
  costPrice?: number; // legacy / staff-facing cost (if any)
  adminCostPrice?: number; // admin purchase cost (hidden from staff)
  actualCost?: number; // real buying price - ADMIN ONLY, never expose to staff; used for profit calculation
  pendingAllocation?: boolean;
};

/** Input for addItem: initialStock is optional and defaults to stock. */
export type AddInventoryItemInput = Omit<InventoryItem, 'id' | 'initialStock'> & { initialStock?: number };

export type Purchase = {
  id: string;
  date: Date;
  supplier: string;
  supplierType?: 'local' | 'wholesale';
  items: Array<{
    itemId: number;
    itemName: string;
    qty: number;
    costPrice: number;
    actualCost?: number; // real buying price (admin only), for profit calculation
    staffSellingPrice?: number; // price staff will use when selling - used for profit calculation
    category?: 'Phone' | 'Spare' | 'Accessory'; // item category for new items
  }>;
  total: number;
  shopId?: string;
  confirmed?: boolean;
  confirmedBy?: string;
  confirmedDate?: Date;
};

export type Exchange = {
  id: string;
  date: Date;
  fromShopId: string;
  toShopId: string;
  items: Array<{
    itemId: number;
    itemName: string;
    qty: number;
  }>;
  status: 'pending' | 'confirmed' | 'completed';
  confirmedBy?: string; // Staff who confirmed receipt
  confirmedDate?: Date;
};

export type InventoryAuditLog = {
  id: string;
  action: 'edit' | 'delete' | 'allocation_requested' | 'allocation_approved' | 'allocation_rejected';
  itemId?: number;
  itemName?: string;
  qty?: number;
  sourceShopId?: string;
  sourceShopName?: string;
  targetShopId?: string;
  targetShopName?: string;
  actor?: string;
  details?: string;
  createdAt: Date;
};

export type InventoryManagerApproval = {
  id: string;
  action: 'inventory_update' | 'inventory_delete' | 'stock_allocation_create';
  status: 'pending' | 'approved' | 'rejected';
  requestedBy?: string;
  approvedBy?: string;
  requestedAt: Date;
  approvedAt?: Date;
  payload: Record<string, unknown>;
  notes?: string;
};

export type StockMovement = {
  id: string;
  itemId: number;
  itemName: string;
  shopId?: string;
  delta: number;
  reason: 'initial_stock' | 'manual_edit' | 'manual_delete' | 'sale' | 'allocation_out' | 'allocation_in' | 'purchase_in' | 'adjustment';
  actor?: string;
  referenceId?: string;
  createdAt: Date;
};

type InventoryContextType = {
  items: InventoryItem[];
  purchases: Purchase[];
  exchanges: Exchange[];
  stockAllocations: StockAllocation[];
  auditLogs: InventoryAuditLog[];
  managerApprovals: InventoryManagerApproval[];
  stockMovements: StockMovement[];
  addItem: (item: AddInventoryItemInput) => void;
  updateItem: (id: number, updates: Partial<InventoryItem>) => void;
  removeItem: (id: number) => void;
  addStock: (itemId: number, qty: number) => void;
  deductStock: (name: string, qty: number, shopId?: string) => void;
  /** Deduct stock by inventory row id (preferred for sales — avoids name/shop mismatches). */
  deductStockById: (itemId: number, qty: number) => void;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'date'>) => Promise<void>;
  confirmPurchase: (purchaseId: string) => void;
  deletePurchase: (purchaseId: string) => void;
  addExchange: (exchange: Omit<Exchange, 'id' | 'date'>) => void;
  confirmExchangeReceipt: (exchangeId: string) => void;
  completeExchange: (exchangeId: string) => void;
  requestStockAllocation: (allocation: Omit<StockAllocation, 'id' | 'requestedDate' | 'status'>) => void;
  approveStockAllocation: (allocationId: string, shopId?: string) => void;
  rejectStockAllocation: (allocationId: string) => void;
  refreshStockAllocations: () => Promise<void>;
  addAuditLog: (entry: Omit<InventoryAuditLog, 'id' | 'createdAt'>) => Promise<void>;
  requestManagerApproval: (request: Omit<InventoryManagerApproval, 'id' | 'status' | 'requestedAt'>) => Promise<void>;
  approveManagerApproval: (requestId: string) => Promise<void>;
  rejectManagerApproval: (requestId: string, notes?: string) => Promise<void>;
  getStockMath: (itemId: number) => { inQty: number; outQty: number; netDelta: number; expectedStock: number; matches: boolean };
};

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [stockAllocations, setStockAllocations] = useState<StockAllocation[]>([]);
  const [auditLogs, setAuditLogs] = useState<InventoryAuditLog[]>([]);
  const [managerApprovals, setManagerApprovals] = useState<InventoryManagerApproval[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const { currentUser } = useShop();
  const lastLocalUpdateRef = useRef<number>(0);
  const DEBOUNCE_MS = 3000;

  const mapInventoryItems = useCallback((data: any[]): InventoryItem[] => {
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category as 'Phone' | 'Spare' | 'Accessory',
      itemType: item.item_type || undefined,
      stock: item.stock || 0,
      price: Number(item.price) || 0,
      reorderLevel: item.reorder_level || 0,
      initialStock: item.initial_stock || item.stock || 0,
      shopId: item.shop_id || undefined,
      supplier: item.supplier || undefined,
      costPrice: item.cost_price ? Number(item.cost_price) : undefined,
      adminCostPrice: item.admin_cost_price ? Number(item.admin_cost_price) : undefined,
      actualCost: item.actual_cost != null ? Number(item.actual_cost) : undefined,
      pendingAllocation: item.pending_allocation || false,
    }));
  }, []);

  const loadAuditLogs = useCallback(async (): Promise<InventoryAuditLog[]> => {
    const { data, error } = await supabase
      .from("inventory_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      action: row.action as InventoryAuditLog['action'],
      itemId: row.item_id ?? undefined,
      itemName: row.item_name ?? undefined,
      qty: row.qty ?? undefined,
      sourceShopId: row.source_shop_id ?? undefined,
      sourceShopName: row.source_shop_name ?? undefined,
      targetShopId: row.target_shop_id ?? undefined,
      targetShopName: row.target_shop_name ?? undefined,
      actor: row.actor ?? undefined,
      details: row.details ?? undefined,
      createdAt: new Date(row.created_at),
    }));
  }, []);

  const addAuditLog = useCallback(async (entry: Omit<InventoryAuditLog, 'id' | 'createdAt'>): Promise<void> => {
    const localEntry: InventoryAuditLog = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
    };

    setAuditLogs((prev) => [localEntry, ...prev].slice(0, 200));

    const { data, error } = await supabase
      .from("inventory_audit_logs")
      .insert({
        action: entry.action,
        item_id: entry.itemId ?? null,
        item_name: entry.itemName ?? null,
        qty: entry.qty ?? null,
        source_shop_id: entry.sourceShopId ?? null,
        source_shop_name: entry.sourceShopName ?? null,
        target_shop_id: entry.targetShopId ?? null,
        target_shop_name: entry.targetShopName ?? null,
        actor: entry.actor ?? currentUser?.name ?? null,
        details: entry.details ?? null,
      })
      .select("*")
      .single();

    // If table doesn't exist yet, keep local log only.
    if (error) {
      console.warn("inventory_audit_logs insert failed:", error.message);
      return;
    }

    if (data) {
      setAuditLogs((prev) => [
        {
          id: data.id,
          action: data.action as InventoryAuditLog['action'],
          itemId: data.item_id ?? undefined,
          itemName: data.item_name ?? undefined,
          qty: data.qty ?? undefined,
          sourceShopId: data.source_shop_id ?? undefined,
          sourceShopName: data.source_shop_name ?? undefined,
          targetShopId: data.target_shop_id ?? undefined,
          targetShopName: data.target_shop_name ?? undefined,
          actor: data.actor ?? undefined,
          details: data.details ?? undefined,
          createdAt: new Date(data.created_at),
        },
        ...prev.filter((p) => p.id !== localEntry.id),
      ].slice(0, 200));
    }
  }, [currentUser?.name]);

  const loadManagerApprovals = useCallback(async (): Promise<InventoryManagerApproval[]> => {
    const { data, error } = await supabase
      .from("inventory_manager_approvals")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      action: row.action as InventoryManagerApproval['action'],
      status: row.status as InventoryManagerApproval['status'],
      requestedBy: row.requested_by || undefined,
      approvedBy: row.approved_by || undefined,
      requestedAt: new Date(row.requested_at),
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      payload: (row.payload || {}) as Record<string, unknown>,
      notes: row.notes || undefined,
    }));
  }, []);

  const loadStockMovements = useCallback(async (): Promise<StockMovement[]> => {
    const { data, error } = await supabase
      .from("inventory_stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.item_name,
      shopId: row.shop_id || undefined,
      delta: Number(row.delta) || 0,
      reason: row.reason as StockMovement['reason'],
      actor: row.actor || undefined,
      referenceId: row.reference_id || undefined,
      createdAt: new Date(row.created_at),
    }));
  }, []);

  const recordStockMovement = useCallback(async (movement: Omit<StockMovement, 'id' | 'createdAt'>): Promise<void> => {
    const local: StockMovement = {
      ...movement,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
    };
    setStockMovements((prev) => [local, ...prev].slice(0, 2000));

    const { data, error } = await supabase
      .from("inventory_stock_movements")
      .insert({
        item_id: movement.itemId,
        item_name: movement.itemName,
        shop_id: movement.shopId || null,
        delta: movement.delta,
        reason: movement.reason,
        actor: movement.actor || currentUser?.name || null,
        reference_id: movement.referenceId || null,
      })
      .select("*")
      .single();

    if (error) {
      console.warn("inventory_stock_movements insert failed:", error.message);
      return;
    }

    if (data) {
      setStockMovements((prev) => [
        {
          id: data.id,
          itemId: data.item_id,
          itemName: data.item_name,
          shopId: data.shop_id || undefined,
          delta: Number(data.delta) || 0,
          reason: data.reason as StockMovement['reason'],
          actor: data.actor || undefined,
          referenceId: data.reference_id || undefined,
          createdAt: new Date(data.created_at),
        },
        ...prev.filter((m) => m.id !== local.id),
      ].slice(0, 2000));
    }
  }, [currentUser?.name]);

  const loadAllItems = useCallback(async (): Promise<InventoryItem[]> => {
    const isAdmin = currentUser?.roles?.includes('admin');
    const cols = isAdmin
      ? '*'
      : 'id,name,category,item_type,stock,price,reorder_level,initial_stock,shop_id,supplier,cost_price,admin_cost_price,pending_allocation';
    const { data, error } = await supabase
      .from("inventory_items")
      .select(cols)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return mapInventoryItems(data || []);
  }, [mapInventoryItems, currentUser]);

  // Load items from Supabase on mount and set up real-time subscription + polling
  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        const loaded = await loadAllItems();
        if (!cancelled) setItems(loaded);
      } catch (e) {
        console.error("Error loading inventory from Supabase:", e);
        if (!cancelled) setItems([]);
      }
    })();

    const channel = supabase
      .channel('inventory-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items' },
        async () => {
          if (cancelled) return;
          const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
          if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
          try {
            const loaded = await loadAllItems();
            if (!cancelled) setItems(loaded);
          } catch (e) {
            console.error("Error reloading inventory:", e);
          }
        }
      )
      .subscribe((status) => {
        console.log("Inventory real-time subscription status:", status);
      });

    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
      try {
        const loaded = await loadAllItems();
        if (!cancelled) setItems(loaded);
      } catch (e) {
        console.error("Error polling inventory:", e);
      }
    }, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadAllItems]);

  // Helper to load purchase with items
  const loadPurchaseWithItems = useCallback(async (purchaseData: any): Promise<Purchase> => {
    const { data: itemsData } = await supabase
      .from("purchase_items")
      .select("*")
      .eq("purchase_id", purchaseData.id);
    
    return {
      id: purchaseData.id,
      date: new Date(purchaseData.date),
      supplier: purchaseData.supplier,
      supplierType: purchaseData.supplier_type === 'wholesale' ? 'wholesale' : 'local',
      total: Number(purchaseData.total) || 0,
      shopId: purchaseData.shop_id || undefined,
      confirmed: purchaseData.confirmed || false,
      confirmedBy: purchaseData.confirmed_by || undefined,
      confirmedDate: purchaseData.confirmed_date ? new Date(purchaseData.confirmed_date) : undefined,
      items: (itemsData || []).map((pi: any) => ({
        itemId: pi.item_id,
        itemName: pi.item_name,
        qty: pi.qty,
        costPrice: Number(pi.cost_price) || 0,
        actualCost: pi.actual_cost != null ? Number(pi.actual_cost) : undefined,
      })),
    };
  }, []);

  const loadAllPurchases = useCallback(async (): Promise<Purchase[]> => {
    const { data: purchasesData, error: purchasesError } = await supabase
      .from("purchases")
      .select("*")
      .order("date", { ascending: false });
    if (purchasesError) throw purchasesError;
    return Promise.all((purchasesData || []).map(p => loadPurchaseWithItems(p)));
  }, [loadPurchaseWithItems]);

  // Load purchases from Supabase and set up real-time subscription + polling
  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        const loaded = await loadAllPurchases();
        if (!cancelled) setPurchases(loaded);
      } catch (e) {
        console.error("Error loading purchases from Supabase:", e);
        if (!cancelled) setPurchases([]);
      }
    })();

    const channel = supabase
      .channel('purchases-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'purchases' },
        async () => {
          if (cancelled) return;
          const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
          if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
          try {
            const loaded = await loadAllPurchases();
            if (!cancelled) setPurchases(loaded);
          } catch (e) {
            console.error("Error reloading purchases:", e);
          }
        }
      )
      .subscribe((status) => {
        console.log("Purchases real-time subscription status:", status);
      });

    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
      try {
        const loaded = await loadAllPurchases();
        if (!cancelled) setPurchases(loaded);
      } catch (e) {
        console.error("Error polling purchases:", e);
      }
    }, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadAllPurchases]);

  // Helper to load allocation with lines
  const loadAllocationWithLines = useCallback(async (allocationData: any): Promise<StockAllocation> => {
    const { data: linesData } = await supabase
      .from("stock_allocation_lines")
      .select("*")
      .eq("allocation_id", allocationData.id);
    const { data: acceptsData, error: acceptsError } = await supabase
      .from("stock_allocation_acceptances")
      .select("*")
      .eq("allocation_id", allocationData.id);
    if (acceptsError) {
      console.warn("stock_allocation_acceptances read failed:", acceptsError.message);
    }
    const acceptanceByShop = new Map<string, any>();
    (acceptsData || []).forEach((a: any) => acceptanceByShop.set(a.shop_id, a));
    
    return {
      id: allocationData.id,
      itemId: allocationData.item_id,
      itemName: allocationData.item_name,
      totalQty: allocationData.total_qty,
      status: allocationData.status as 'pending' | 'approved' | 'rejected',
      requestedBy: allocationData.requested_by || undefined,
      requestedDate: new Date(allocationData.requested_date),
      approvedBy: allocationData.approved_by || undefined,
      approvedDate: allocationData.approved_date ? new Date(allocationData.approved_date) : undefined,
      allocations: (linesData || []).map((l: any) => {
        const accepted = acceptanceByShop.get(l.shop_id);
        return {
          shopId: l.shop_id,
          shopName: l.shop_name,
          qty: l.qty,
          accepted: Boolean(accepted),
          acceptedBy: accepted?.accepted_by || undefined,
          acceptedAt: accepted?.accepted_at ? new Date(accepted.accepted_at) : undefined,
        };
      }),
    };
  }, []);

  // Refresh stock allocations function (can be called manually)
  const refreshStockAllocations = useCallback(async () => {
    try {
      const { data: allocsData, error: allocsError } = await supabase
        .from("stock_allocations")
        .select("*")
        .order("requested_date", { ascending: false });
      if (allocsError) throw allocsError;

      const allocationsWithLines: StockAllocation[] = await Promise.all(
        (allocsData || []).map(a => loadAllocationWithLines(a))
      );
      setStockAllocations(allocationsWithLines);
    } catch (e) {
      console.error("Error refreshing stock allocations:", e);
    }
  }, [loadAllocationWithLines]);

  // Load stock allocations from Supabase and set up real-time subscription
  useEffect(() => {
    let cancelled = false;
    
    // Initial load
    refreshStockAllocations();

    // Set up real-time subscription for both stock_allocations and stock_allocation_lines
    const channel = supabase
      .channel('stock-allocations-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stock_allocations' },
        async () => {
          if (cancelled) return;
          await refreshStockAllocations();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stock_allocation_lines' },
        async () => {
          if (cancelled) return;
          await refreshStockAllocations();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stock_allocation_acceptances' },
        async () => {
          if (cancelled) return;
          await refreshStockAllocations();
        }
      )
      .subscribe();

    // Also refresh on window focus (helps catch missed updates)
    const handleFocus = () => {
      if (!cancelled) {
        refreshStockAllocations();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [refreshStockAllocations]);

  // Load audit logs (non-blocking; table may not exist on older DBs)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const logs = await loadAuditLogs();
        if (!cancelled) setAuditLogs(logs);
      } catch {
        if (!cancelled) setAuditLogs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAuditLogs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const approvals = await loadManagerApprovals();
        if (!cancelled) setManagerApprovals(approvals);
      } catch {
        if (!cancelled) setManagerApprovals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadManagerApprovals]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const movements = await loadStockMovements();
        if (!cancelled) setStockMovements(movements);
      } catch {
        if (!cancelled) setStockMovements([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStockMovements]);

  const addItem = useCallback((itemData: AddInventoryItemInput) => {
    (async () => {
      const payload = {
        name: itemData.name,
        category: itemData.category,
        item_type: itemData.itemType || null,
        stock: itemData.stock || 0,
        price: itemData.price || 0,
        reorder_level: itemData.reorderLevel || 0,
        initial_stock: itemData.initialStock ?? itemData.stock ?? 0,
        shop_id: itemData.shopId || null,
        supplier: itemData.supplier || null,
        cost_price: itemData.costPrice || null,
        admin_cost_price: itemData.adminCostPrice || null,
        actual_cost: itemData.actualCost ?? null,
        pending_allocation: itemData.pendingAllocation || false,
      };
      const { data, error } = await supabase.from("inventory_items").insert(payload).select("*").single();
      if (error) {
        console.error("Error adding inventory item:", error);
        return;
      }
      const newItem: InventoryItem = {
        id: data.id,
        name: data.name,
        category: data.category as 'Phone' | 'Spare' | 'Accessory',
        itemType: data.item_type || undefined,
        stock: data.stock || 0,
        price: Number(data.price) || 0,
        reorderLevel: data.reorder_level || 0,
        initialStock: data.initial_stock || data.stock || 0,
        shopId: data.shop_id || undefined,
        supplier: data.supplier || undefined,
        costPrice: data.cost_price ? Number(data.cost_price) : undefined,
        adminCostPrice: data.admin_cost_price ? Number(data.admin_cost_price) : undefined,
        actualCost: data.actual_cost != null ? Number(data.actual_cost) : undefined,
        pendingAllocation: data.pending_allocation || false,
      };
      lastLocalUpdateRef.current = Date.now();
      setItems((prev) => [newItem, ...prev]);
      if (newItem.stock > 0) {
        await recordStockMovement({
          itemId: newItem.id,
          itemName: newItem.name,
          shopId: newItem.shopId,
          delta: newItem.stock,
          reason: 'initial_stock',
          actor: currentUser?.name,
        });
      }
    })();
  }, [currentUser?.name, recordStockMovement]);

  const updateItem = useCallback((id: number, updates: Partial<InventoryItem>) => {
    (async () => {
      const currentItem = items.find((item) => item.id === id);
      if (!currentItem) return;
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.itemType !== undefined) payload.item_type = updates.itemType;
      if (updates.stock !== undefined) payload.stock = updates.stock;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.reorderLevel !== undefined) payload.reorder_level = updates.reorderLevel;
      if (updates.initialStock !== undefined) payload.initial_stock = updates.initialStock;
      if (updates.shopId !== undefined) payload.shop_id = updates.shopId || null;
      if (updates.supplier !== undefined) payload.supplier = updates.supplier || null;
      if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice || null;
      if (updates.adminCostPrice !== undefined) payload.admin_cost_price = updates.adminCostPrice || null;
      if (updates.actualCost !== undefined) payload.actual_cost = updates.actualCost ?? null;
      if (updates.pendingAllocation !== undefined) payload.pending_allocation = updates.pendingAllocation;

      const { error } = await supabase.from("inventory_items").update(payload).eq("id", id);
      if (error) {
        console.error("Error updating inventory item:", error);
        return;
      }
      lastLocalUpdateRef.current = Date.now();
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
      if (updates.stock !== undefined) {
        const delta = updates.stock - currentItem.stock;
        if (delta !== 0) {
          await recordStockMovement({
            itemId: currentItem.id,
            itemName: updates.name || currentItem.name,
            shopId: updates.shopId !== undefined ? updates.shopId : currentItem.shopId,
            delta,
            reason: 'manual_edit',
            actor: currentUser?.name,
          });
        }
      }
    })();
  }, [currentUser?.name, items, recordStockMovement]);

  const removeItem = useCallback((id: number) => {
    (async () => {
      const itemToDelete = items.find((item) => item.id === id);
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) {
        console.error("Error deleting inventory item:", error);
        return;
      }
      lastLocalUpdateRef.current = Date.now();
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (itemToDelete && itemToDelete.stock !== 0) {
        await recordStockMovement({
          itemId: itemToDelete.id,
          itemName: itemToDelete.name,
          shopId: itemToDelete.shopId,
          delta: -itemToDelete.stock,
          reason: 'manual_delete',
          actor: currentUser?.name,
        });
      }
    })();
  }, [currentUser?.name, items, recordStockMovement]);

  const addStock = useCallback((itemId: number, qty: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || qty <= 0) return;
    updateItem(itemId, { stock: item.stock + qty });
  }, [items, updateItem]);

  const deductStock = useCallback((name: string, qty: number, shopId?: string) => {
    const item = shopId
      ? items.find((i) => i.name === name && i.shopId === shopId)
      : items.find((i) => i.name === name);
    if (!item || qty <= 0) return;
    updateItem(item.id, { stock: Math.max(0, item.stock - qty) });
  }, [items, updateItem]);

  const deductStockById = useCallback(
    (itemId: number, qty: number) => {
      const item = items.find((i) => i.id === itemId);
      if (!item || qty <= 0) return;
      updateItem(itemId, { stock: Math.max(0, item.stock - qty) });
    },
    [items, updateItem]
  );

  const addPurchase = useCallback(async (purchaseData: Omit<Purchase, 'id' | 'date'>): Promise<void> => {
    // Resolve new items (negative itemId) to real inventory IDs by creating them first
    const resolvedItems: Array<{ itemId: number; itemName: string; qty: number; costPrice: number; actualCost?: number; staffSellingPrice?: number }> = [];
    for (const item of purchaseData.items) {
      const existingItem = items.find((i) => i.id === item.itemId);
      if (existingItem && item.itemId > 0) {
        resolvedItems.push({
          itemId: item.itemId,
          itemName: item.itemName,
          qty: item.qty,
          costPrice: item.costPrice,
          actualCost: item.actualCost,
          staffSellingPrice: item.staffSellingPrice,
        });
      } else {
        const actualCost = item.actualCost ?? item.costPrice;
        // staffSellingPrice is the price staff will use when selling - set as price and costPrice for profit calculation
        const staffPrice = item.staffSellingPrice ?? 0;
        // Determine category: use provided category, or try to find from existing items, or default to 'Spare'
        let itemCategory: 'Phone' | 'Spare' | 'Accessory' = item.category || 'Spare';
        const existingItemByName = items.find(i => i.name.toLowerCase() === item.itemName.toLowerCase());
        if (existingItemByName && !item.category) {
          itemCategory = existingItemByName.category;
        }
        const payload = {
          name: item.itemName,
          category: itemCategory,
          stock: item.qty,
          price: staffPrice, // Staff selling price - this is what staff sees and uses
          reorder_level: 0,
          initial_stock: item.qty,
          shop_id: null,
          supplier: purchaseData.supplier,
          cost_price: staffPrice, // Also set as costPrice so profit = selling_price - costPrice
          admin_cost_price: item.costPrice,
          actual_cost: actualCost,
          pending_allocation: true,
        };
        const { data: newRow, error: insertErr } = await supabase
          .from('inventory_items')
          .insert(payload)
          .select('id')
          .single();
        if (insertErr) {
          console.error('Error creating inventory item:', insertErr);
          throw insertErr;
        }
        const newId = newRow.id;
        setItems((prev) => [
          {
            id: newId,
            name: item.itemName,
            category: itemCategory,
            stock: item.qty,
            price: staffPrice,
            reorderLevel: 0,
            initialStock: item.qty,
            pendingAllocation: true,
            costPrice: staffPrice,
            adminCostPrice: item.costPrice,
            actualCost: actualCost,
            supplier: purchaseData.supplier,
          } as InventoryItem,
          ...prev,
        ]);
        resolvedItems.push({
          itemId: newId,
          itemName: item.itemName,
          qty: item.qty,
          costPrice: item.costPrice,
          actualCost: item.actualCost,
          staffSellingPrice: item.staffSellingPrice,
        });
      }
    }

    const purchasePayload: Record<string, unknown> = {
      supplier: purchaseData.supplier,
      total: purchaseData.total,
      shop_id: purchaseData.shopId || null,
    };
    if (purchaseData.supplierType) purchasePayload.supplier_type = purchaseData.supplierType;

    const { data: purchaseRecord, error: purchaseError } = await supabase
      .from('purchases')
      .insert(purchasePayload)
      .select('*')
      .single();
    if (purchaseError) {
      console.error('Error adding purchase:', purchaseError);
      throw purchaseError;
    }

    const purchaseItemsPayload = resolvedItems.map((item) => ({
      purchase_id: purchaseRecord.id,
      item_id: item.itemId,
      item_name: item.itemName,
      qty: item.qty,
      cost_price: item.costPrice,
      ...(item.actualCost != null && { actual_cost: item.actualCost }),
    }));
    const { error: itemsError } = await supabase
      .from('purchase_items')
      .insert(purchaseItemsPayload);
    if (itemsError) {
      console.error('Error adding purchase items:', itemsError);
      throw itemsError;
    }

    for (const item of purchaseData.items) {
      const existingItem = items.find((i) => i.id === item.itemId);
      if (existingItem && item.itemId > 0) {
        const actualCost = item.actualCost ?? item.costPrice;
        const staffPrice = item.staffSellingPrice ?? existingItem.price;
        updateItem(existingItem.id, {
          stock: existingItem.stock + item.qty,
          pendingAllocation: true,
          price: staffPrice, // Update price to staff selling price
          costPrice: staffPrice, // Update costPrice for profit calculation
          adminCostPrice: item.costPrice,
          actualCost: actualCost,
          supplier: purchaseData.supplier,
        });
      }
    }

    const { data: newPurchaseData, error: fetchError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchaseRecord.id)
      .single();
    if (fetchError) {
      console.error('Error fetching new purchase:', fetchError);
      return;
    }

    const { data: itemsData } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', purchaseRecord.id);

    const newPurchase: Purchase = {
      id: newPurchaseData.id,
      date: new Date(newPurchaseData.date),
      supplier: newPurchaseData.supplier,
      supplierType: (newPurchaseData.supplier_type === 'wholesale' ? 'wholesale' : 'local') as 'local' | 'wholesale',
      total: Number(newPurchaseData.total) || 0,
      shopId: newPurchaseData.shop_id || undefined,
      confirmed: newPurchaseData.confirmed || false,
      confirmedBy: newPurchaseData.confirmed_by || undefined,
      confirmedDate: newPurchaseData.confirmed_date ? new Date(newPurchaseData.confirmed_date) : undefined,
      items: (itemsData || []).map((pi: any) => ({
        itemId: pi.item_id,
        itemName: pi.item_name,
        qty: pi.qty,
        costPrice: Number(pi.cost_price) || 0,
        actualCost: pi.actual_cost != null ? Number(pi.actual_cost) : undefined,
      })),
    };
    lastLocalUpdateRef.current = Date.now();
    setPurchases((prev) => [newPurchase, ...prev]);
  }, [items, updateItem]);

  const confirmPurchase = useCallback((purchaseId: string) => {
    (async () => {
      const purchase = purchases.find(p => p.id === purchaseId);
      if (!purchase || purchase.confirmed) return;

      const { error } = await supabase
        .from("purchases")
        .update({
          confirmed: true,
          confirmed_by: currentUser?.name || 'admin',
          confirmed_date: new Date().toISOString(),
        })
        .eq("id", purchaseId);
      
      if (error) {
        console.error("Error confirming purchase:", error);
        return;
      }

      lastLocalUpdateRef.current = Date.now();
      setPurchases((prev) =>
        prev.map((p) =>
          p.id === purchaseId
            ? {
                ...p,
                confirmed: true,
                confirmedBy: currentUser?.name || 'admin',
                confirmedDate: new Date(),
              }
            : p
        )
      );
    })();
  }, [purchases, currentUser]);

  const deletePurchase = useCallback((purchaseId: string) => {
    (async () => {
      await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId);
      
      const { error } = await supabase.from("purchases").delete().eq("id", purchaseId);
      if (error) {
        console.error("Error deleting purchase:", error);
        return;
      }
      
      lastLocalUpdateRef.current = Date.now();
      setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
    })();
  }, []);

  const addExchange = useCallback((exchangeData: Omit<Exchange, 'id' | 'date'>) => {
    const newExchange: Exchange = {
      ...exchangeData,
      id: Date.now().toString(),
      date: new Date(),
      status: 'pending',
    };
    setExchanges(prev => {
      const updated = [...prev, newExchange];
      // Save to localStorage
      try {
        localStorage.setItem('phonemart_exchanges', JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving exchange to storage:', error);
      }
      return updated;
    });
  }, []);

  const confirmExchangeReceipt = useCallback((exchangeId: string) => {
    setExchanges(prev => {
      const updated = prev.map(e => {
        if (e.id === exchangeId && e.status === 'pending') {
          return {
            ...e,
            status: 'confirmed' as const,
            confirmedBy: currentUser?.name || 'Unknown',
            confirmedDate: new Date(),
          };
        }
        return e;
      });
      // Update localStorage
      try {
        localStorage.setItem('phonemart_exchanges', JSON.stringify(updated));
      } catch (error) {
        console.error('Error updating exchange in storage:', error);
      }
      return updated;
    });
  }, [currentUser]);

  const requestStockAllocation = useCallback((allocationData: Omit<StockAllocation, 'id' | 'requestedDate' | 'status'>) => {
    (async () => {
      // Insert stock allocation
      const { data: allocRecord, error: allocError } = await supabase
        .from("stock_allocations")
        .insert({
          item_id: allocationData.itemId,
          item_name: allocationData.itemName,
          total_qty: allocationData.totalQty,
          status: 'pending',
          requested_by: allocationData.requestedBy || null,
        })
        .select("*")
        .single();
      if (allocError) {
        console.error("Error creating stock allocation:", allocError);
        return;
      }

      // Insert allocation lines
      const linesPayload = allocationData.allocations.map((alloc) => ({
        allocation_id: allocRecord.id,
        shop_id: alloc.shopId,
        shop_name: alloc.shopName,
        qty: alloc.qty,
      }));
      const { error: linesError } = await supabase
        .from("stock_allocation_lines")
        .insert(linesPayload);
      if (linesError) {
        console.error("Error creating stock allocation lines:", linesError);
        return;
      }

      const newAllocation: StockAllocation = {
        id: allocRecord.id,
        itemId: allocRecord.item_id,
        itemName: allocRecord.item_name,
        totalQty: allocRecord.total_qty,
        status: 'pending',
        requestedBy: allocRecord.requested_by || undefined,
        requestedDate: new Date(allocRecord.requested_date),
        allocations: allocationData.allocations,
      };
      setStockAllocations((prev) => [newAllocation, ...prev]);

      await addAuditLog({
        action: 'allocation_requested',
        itemId: newAllocation.itemId,
        itemName: newAllocation.itemName,
        qty: newAllocation.totalQty,
        sourceShopId: items.find((i) => i.id === newAllocation.itemId)?.shopId,
        targetShopId: newAllocation.allocations[0]?.shopId,
        targetShopName: newAllocation.allocations[0]?.shopName,
        actor: allocationData.requestedBy,
        details: `Allocation request to ${newAllocation.allocations.length} destination(s).`,
      });
    })();
  }, [addAuditLog, items]);

  const approveStockAllocation = useCallback((allocationId: string, shopId?: string) => {
    (async () => {
      const allocation = stockAllocations.find((a) => a.id === allocationId);
      if (!allocation || allocation.status !== 'pending') return;
      const sourceItem = items.find((i) => i.id === allocation.itemId);
      if (!sourceItem) return;

      const linesToProcess = shopId
        ? allocation.allocations.filter((a) => a.shopId === shopId)
        : allocation.allocations;
      if (linesToProcess.length === 0) return;
      let remainingSourceStock = sourceItem.stock;

      // Process each destination line once (idempotent per allocation/shop line)
      for (const alloc of linesToProcess) {
        let acceptanceTracked = true;
        const { data: acceptedRow, error: acceptedCheckError } = await supabase
          .from("stock_allocation_acceptances")
          .select("id")
          .eq("allocation_id", allocationId)
          .eq("shop_id", alloc.shopId)
          .maybeSingle();
        if (acceptedCheckError) {
          if ((acceptedCheckError as any).code === "42P01") {
            // Backward compatibility when migration has not been applied yet.
            acceptanceTracked = false;
          } else {
            console.error("Error checking allocation acceptance:", acceptedCheckError);
            continue;
          }
        }
        if (acceptanceTracked && acceptedRow) continue;

        if (acceptanceTracked) {
          const { error: acceptErr } = await supabase
            .from("stock_allocation_acceptances")
            .insert({
              allocation_id: allocationId,
              shop_id: alloc.shopId,
              accepted_by: currentUser?.name || "staff",
              accepted_at: new Date().toISOString(),
            });
          if (acceptErr) {
            // Another client may have accepted first (unique violation): skip safely.
            if ((acceptErr as any).code === "23505") continue;
            console.error("Error recording allocation acceptance:", acceptErr);
            continue;
          }
        }

        const destItem = items.find((i) => i.name === sourceItem.name && i.shopId === alloc.shopId);
        if (destItem) {
          await updateItem(destItem.id, {
            stock: destItem.stock + alloc.qty,
            pendingAllocation: false,
          });
        } else {
          addItem({
            name: sourceItem.name,
            category: sourceItem.category,
            itemType: sourceItem.itemType,
            stock: alloc.qty,
            price: sourceItem.price,
            reorderLevel: sourceItem.reorderLevel,
            initialStock: alloc.qty,
            shopId: alloc.shopId,
            supplier: sourceItem.supplier,
            costPrice: sourceItem.costPrice,
            adminCostPrice: sourceItem.adminCostPrice,
            pendingAllocation: false,
          });
        }

        remainingSourceStock = Math.max(0, remainingSourceStock - alloc.qty);
        await updateItem(sourceItem.id, {
          stock: remainingSourceStock,
          pendingAllocation: sourceItem.pendingAllocation,
        });

        await addAuditLog({
          action: 'allocation_approved',
          itemId: allocation.itemId,
          itemName: sourceItem.name,
          qty: alloc.qty,
          sourceShopId: sourceItem.shopId,
          sourceShopName: sourceItem.shopId ?? 'Unassigned',
          targetShopId: alloc.shopId,
          targetShopName: alloc.shopName,
          actor: currentUser?.name || 'admin',
          details: `Accepted transfer to ${alloc.shopName}.`,
        });
      }

      const { data: acceptedRows, error: acceptedRowsError } = await supabase
        .from("stock_allocation_acceptances")
        .select("shop_id")
        .eq("allocation_id", allocationId);
      if (acceptedRowsError) {
        if ((acceptedRowsError as any).code === "42P01") {
          await refreshStockAllocations();
          return;
        }
        console.error("Error checking allocation acceptances:", acceptedRowsError);
        return;
      }
      const acceptedShopIds = new Set((acceptedRows || []).map((r: any) => r.shop_id));
      const allAccepted = allocation.allocations.every((a) => acceptedShopIds.has(a.shopId));

      if (allAccepted) {
        const { error } = await supabase
          .from("stock_allocations")
          .update({
            status: 'approved',
            approved_by: currentUser?.name || 'admin',
            approved_date: new Date().toISOString(),
          })
          .eq("id", allocationId);
        if (error) {
          console.error("Error finalizing stock allocation:", error);
          return;
        }
      }

      await refreshStockAllocations();
    })();
  }, [stockAllocations, items, addItem, updateItem, currentUser?.name, addAuditLog, refreshStockAllocations]);

  const rejectStockAllocation = useCallback((allocationId: string) => {
    (async () => {
      const { error } = await supabase
        .from("stock_allocations")
        .update({ status: 'rejected' })
        .eq("id", allocationId);
      if (error) {
        console.error("Error rejecting stock allocation:", error);
        return;
      }
      const allocation = stockAllocations.find((a) => a.id === allocationId);
      if (allocation) {
        await addAuditLog({
          action: 'allocation_rejected',
          itemId: allocation.itemId,
          itemName: allocation.itemName,
          qty: allocation.totalQty,
          sourceShopId: items.find((i) => i.id === allocation.itemId)?.shopId,
          targetShopId: allocation.allocations[0]?.shopId,
          targetShopName: allocation.allocations[0]?.shopName,
          actor: currentUser?.name || 'admin',
          details: 'Allocation request rejected.',
        });
      }
      setStockAllocations((prev) =>
        prev.map((a) => (a.id === allocationId ? { ...a, status: 'rejected' } : a))
      );
    })();
  }, [addAuditLog, currentUser?.name, items, stockAllocations]);

  const requestManagerApproval = useCallback(async (request: Omit<InventoryManagerApproval, 'id' | 'status' | 'requestedAt'>): Promise<void> => {
    const local: InventoryManagerApproval = {
      ...request,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      requestedAt: new Date(),
    };
    setManagerApprovals((prev) => [local, ...prev].slice(0, 200));

    const { data, error } = await supabase
      .from("inventory_manager_approvals")
      .insert({
        action: request.action,
        status: 'pending',
        requested_by: request.requestedBy || currentUser?.name || null,
        payload: request.payload,
        notes: request.notes || null,
      })
      .select("*")
      .single();
    if (error) {
      console.warn("inventory_manager_approvals insert failed:", error.message);
      return;
    }
    if (data) {
      setManagerApprovals((prev) => [
        {
          id: data.id,
          action: data.action as InventoryManagerApproval['action'],
          status: data.status as InventoryManagerApproval['status'],
          requestedBy: data.requested_by || undefined,
          approvedBy: data.approved_by || undefined,
          requestedAt: new Date(data.requested_at),
          approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
          payload: (data.payload || {}) as Record<string, unknown>,
          notes: data.notes || undefined,
        },
        ...prev.filter((r) => r.id !== local.id),
      ].slice(0, 200));
    }
  }, [currentUser?.name]);

  const approveManagerApproval = useCallback(async (requestId: string): Promise<void> => {
    const request = managerApprovals.find((r) => r.id === requestId);
    if (!request || request.status !== 'pending') return;

    if (request.action === 'inventory_update') {
      const itemId = Number(request.payload.itemId);
      const updates = (request.payload.updates || {}) as Partial<InventoryItem>;
      updateItem(itemId, updates);
    } else if (request.action === 'inventory_delete') {
      const itemId = Number(request.payload.itemId);
      removeItem(itemId);
    } else if (request.action === 'stock_allocation_create') {
      const allocationData = request.payload.allocationData as Omit<StockAllocation, 'id' | 'requestedDate' | 'status'> | undefined;
      if (allocationData) requestStockAllocation(allocationData);
    }

    const { error } = await supabase
      .from("inventory_manager_approvals")
      .update({
        status: 'approved',
        approved_by: currentUser?.name || 'admin',
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) {
      console.warn("approve manager approval failed:", error.message);
    }
    setManagerApprovals((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'approved', approvedBy: currentUser?.name, approvedAt: new Date() } : r)));
  }, [currentUser?.name, managerApprovals, removeItem, requestStockAllocation, updateItem]);

  const rejectManagerApproval = useCallback(async (requestId: string, notes?: string): Promise<void> => {
    const { error } = await supabase
      .from("inventory_manager_approvals")
      .update({
        status: 'rejected',
        approved_by: currentUser?.name || 'admin',
        approved_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq("id", requestId);
    if (error) {
      console.warn("reject manager approval failed:", error.message);
    }
    setManagerApprovals((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'rejected', approvedBy: currentUser?.name, approvedAt: new Date(), notes } : r)));
  }, [currentUser?.name]);

  const getStockMath = useCallback((itemId: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return { inQty: 0, outQty: 0, netDelta: 0, expectedStock: 0, matches: true };
    const rows = stockMovements.filter((m) => m.itemId === itemId);
    const inQty = rows.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0);
    const outQty = rows.filter((m) => m.delta < 0).reduce((s, m) => s + Math.abs(m.delta), 0);
    const netDelta = inQty - outQty;
    const expectedStock = Math.max(0, item.initialStock + netDelta);
    return {
      inQty,
      outQty,
      netDelta,
      expectedStock,
      matches: expectedStock === item.stock,
    };
  }, [items, stockMovements]);

  const completeExchange = (exchangeId: string) => {
    const exchange = exchanges.find(e => e.id === exchangeId);
    if (!exchange || exchange.status === 'completed') return;

    // Deduct from source shop
    exchange.items.forEach(exchangeItem => {
      const item = items.find(i => i.id === exchangeItem.itemId && i.shopId === exchange.fromShopId);
      if (item && item.stock >= exchangeItem.qty) {
        setItems(prev =>
          prev.map(i =>
            i.id === item.id && i.shopId === exchange.fromShopId
              ? { ...i, stock: Math.max(0, i.stock - exchangeItem.qty) }
              : i
          )
        );
      }
    });

    // Add to destination shop
    exchange.items.forEach(exchangeItem => {
      const sourceItem = items.find(i => i.id === exchangeItem.itemId && i.shopId === exchange.fromShopId);
      if (sourceItem) {
        // Check if item exists in destination shop
        const destItem = items.find(i => i.name === sourceItem.name && i.shopId === exchange.toShopId);
        if (destItem) {
          // Update existing item
          setItems(prev =>
            prev.map(i =>
              i.id === destItem.id && i.shopId === exchange.toShopId
                ? { ...i, stock: i.stock + exchangeItem.qty }
                : i
            )
          );
        } else {
          // Create new item in destination shop
          const newId = Math.max(...items.map(i => i.id), 0) + 1;
          const newItem: InventoryItem = {
            id: newId,
            name: sourceItem.name,
            category: sourceItem.category,
            stock: exchangeItem.qty,
            price: sourceItem.price,
            reorderLevel: sourceItem.reorderLevel,
            initialStock: exchangeItem.qty,
            shopId: exchange.toShopId,
            supplier: sourceItem.supplier,
            costPrice: sourceItem.costPrice,
          };
          setItems(prev => [...prev, newItem]);
        }
      }
    });

    setExchanges(prev => {
      const updated = prev.map(e =>
        e.id === exchangeId ? { ...e, status: 'completed' as const } : e
      );
      // Update localStorage
      try {
        localStorage.setItem('phonemart_exchanges', JSON.stringify(updated));
      } catch (error) {
        console.error('Error updating exchange in storage:', error);
      }
      return updated;
    });
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        purchases,
        exchanges,
        stockAllocations,
        auditLogs,
        managerApprovals,
        stockMovements,
        addItem,
        updateItem,
        removeItem,
        addStock,
        deductStock,
        deductStockById,
        addPurchase,
        confirmPurchase,
        deletePurchase,
        addExchange,
        confirmExchangeReceipt,
        completeExchange,
        requestStockAllocation,
        approveStockAllocation,
        rejectStockAllocation,
        refreshStockAllocations,
        addAuditLog,
        requestManagerApproval,
        approveManagerApproval,
        rejectManagerApproval,
        getStockMath,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("InventoryContext not found");
  return ctx;
};
