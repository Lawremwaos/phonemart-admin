import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  itemType?: string; // Type of item (e.g., "USB-C Charger", "Tempered Glass", "Screen", "Battery")
  stock: number;
  price: number; // Amount sold (not fixed price)
  reorderLevel: number; // when stock <= this, mark low stock
  initialStock: number; // track initial stock for movement calculation
  shopId?: string; // which shop owns this inventory
  supplier?: string; // supplier name
  costPrice?: number; // purchase cost from supplier (admin only)
  adminCostPrice?: number; // admin's purchase cost (hidden from staff)
  pendingAllocation?: boolean; // true if stock needs to be allocated
};

export type Purchase = {
  id: string;
  date: Date;
  supplier: string;
  items: Array<{
    itemId: number;
    itemName: string;
    qty: number;
    costPrice: number;
  }>;
  total: number;
  shopId?: string;
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

type InventoryContextType = {
  items: InventoryItem[];
  purchases: Purchase[];
  exchanges: Exchange[];
  stockAllocations: StockAllocation[];
  addItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateItem: (id: number, updates: Partial<InventoryItem>) => void;
  removeItem: (id: number) => void;
  addStock: (itemId: number, qty: number) => void;
  deductStock: (name: string, qty: number) => void;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'date'>) => void;
  addExchange: (exchange: Omit<Exchange, 'id' | 'date'>) => void;
  confirmExchangeReceipt: (exchangeId: string) => void;
  completeExchange: (exchangeId: string) => void;
  requestStockAllocation: (allocation: Omit<StockAllocation, 'id' | 'requestedDate' | 'status'>) => void;
  approveStockAllocation: (allocationId: string) => void;
  rejectStockAllocation: (allocationId: string) => void;
};

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [stockAllocations, setStockAllocations] = useState<StockAllocation[]>([]);
  const { currentUser } = useShop();

  // Load items from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("inventory_items")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        const mapped: InventoryItem[] = (data || []).map((item: any) => ({
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
          pendingAllocation: item.pending_allocation || false,
        }));
        setItems(mapped);
      } catch (e) {
        console.error("Error loading inventory from Supabase:", e);
        setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load purchases from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: purchasesData, error: purchasesError } = await supabase
          .from("purchases")
          .select("*")
          .order("date", { ascending: false });
        if (purchasesError) throw purchasesError;
        if (cancelled) return;

        const purchasesWithItems: Purchase[] = await Promise.all(
          (purchasesData || []).map(async (p: any) => {
            const { data: itemsData, error: itemsError } = await supabase
              .from("purchase_items")
              .select("*")
              .eq("purchase_id", p.id);
            if (itemsError) throw itemsError;
            return {
              id: p.id,
              date: new Date(p.date),
              supplier: p.supplier,
              total: Number(p.total) || 0,
              shopId: p.shop_id || undefined,
              items: (itemsData || []).map((pi: any) => ({
                itemId: pi.item_id,
                itemName: pi.item_name,
                qty: pi.qty,
                costPrice: Number(pi.cost_price) || 0,
              })),
            };
          })
        );
        setPurchases(purchasesWithItems);
      } catch (e) {
        console.error("Error loading purchases from Supabase:", e);
        setPurchases([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load stock allocations from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: allocsData, error: allocsError } = await supabase
          .from("stock_allocations")
          .select("*")
          .order("requested_date", { ascending: false });
        if (allocsError) throw allocsError;
        if (cancelled) return;

        const allocationsWithLines: StockAllocation[] = await Promise.all(
          (allocsData || []).map(async (a: any) => {
            const { data: linesData, error: linesError } = await supabase
              .from("stock_allocation_lines")
              .select("*")
              .eq("allocation_id", a.id);
            if (linesError) throw linesError;
            return {
              id: a.id,
              itemId: a.item_id,
              itemName: a.item_name,
              totalQty: a.total_qty,
              status: a.status as 'pending' | 'approved' | 'rejected',
              requestedBy: a.requested_by || undefined,
              requestedDate: new Date(a.requested_date),
              approvedBy: a.approved_by || undefined,
              approvedDate: a.approved_date ? new Date(a.approved_date) : undefined,
              allocations: (linesData || []).map((l: any) => ({
                shopId: l.shop_id,
                shopName: l.shop_name,
                qty: l.qty,
              })),
            };
          })
        );
        setStockAllocations(allocationsWithLines);
      } catch (e) {
        console.error("Error loading stock allocations from Supabase:", e);
        setStockAllocations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = useCallback((itemData: Omit<InventoryItem, 'id'>) => {
    (async () => {
      const payload = {
        name: itemData.name,
        category: itemData.category,
        item_type: itemData.itemType || null,
        stock: itemData.stock || 0,
        price: itemData.price || 0,
        reorder_level: itemData.reorderLevel || 0,
        initial_stock: itemData.stock || 0,
        shop_id: itemData.shopId || null,
        supplier: itemData.supplier || null,
        cost_price: itemData.costPrice || null,
        admin_cost_price: itemData.adminCostPrice || null,
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
        pendingAllocation: data.pending_allocation || false,
      };
      setItems((prev) => [newItem, ...prev]);
    })();
  }, []);

  const updateItem = useCallback((id: number, updates: Partial<InventoryItem>) => {
    (async () => {
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
      if (updates.pendingAllocation !== undefined) payload.pending_allocation = updates.pendingAllocation;

      const { error } = await supabase.from("inventory_items").update(payload).eq("id", id);
      if (error) {
        console.error("Error updating inventory item:", error);
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    })();
  }, []);

  const removeItem = useCallback((id: number) => {
    (async () => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) {
        console.error("Error deleting inventory item:", error);
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    })();
  }, []);

  const addStock = useCallback((itemId: number, qty: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    updateItem(itemId, { stock: item.stock + qty });
  }, [items, updateItem]);

  const deductStock = useCallback((name: string, qty: number) => {
    const item = items.find((i) => i.name === name);
    if (!item) return;
    updateItem(item.id, { stock: Math.max(0, item.stock - qty) });
  }, [items, updateItem]);

  const addPurchase = useCallback((purchaseData: Omit<Purchase, 'id' | 'date'>) => {
    (async () => {
      // Insert purchase
      const { data: purchaseRecord, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          supplier: purchaseData.supplier,
          total: purchaseData.total,
          shop_id: purchaseData.shopId || null,
        })
        .select("*")
        .single();
      if (purchaseError) {
        console.error("Error adding purchase:", purchaseError);
        return;
      }

      // Insert purchase items
      const purchaseItemsPayload = purchaseData.items.map((item) => ({
        purchase_id: purchaseRecord.id,
        item_id: item.itemId,
        item_name: item.itemName,
        qty: item.qty,
        cost_price: item.costPrice,
      }));
      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(purchaseItemsPayload);
      if (itemsError) {
        console.error("Error adding purchase items:", itemsError);
        return;
      }

      // Update or create inventory items - mark as pending allocation
      for (const purchaseItem of purchaseData.items) {
        const existingItem = items.find((i) => i.id === purchaseItem.itemId);
        if (existingItem) {
          // Update existing item
          await updateItem(existingItem.id, {
            stock: existingItem.stock + purchaseItem.qty,
            pendingAllocation: true,
            adminCostPrice: purchaseItem.costPrice,
            supplier: purchaseData.supplier,
          });
        } else {
          // Create new item (shouldn't happen often, but handle it)
          console.warn("Item not found for purchase, creating new item:", purchaseItem.itemName);
          await addItem({
            name: purchaseItem.itemName,
            category: "Spare", // Default, should be set properly
            stock: purchaseItem.qty,
            price: 0,
            reorderLevel: 0,
            initialStock: purchaseItem.qty,
            pendingAllocation: true,
            adminCostPrice: purchaseItem.costPrice,
            supplier: purchaseData.supplier,
          });
        }
      }

      // Reload purchases to get the new one
      const { data: newPurchaseData, error: fetchError } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseRecord.id)
        .single();
      if (fetchError) {
        console.error("Error fetching new purchase:", fetchError);
        return;
      }

      const { data: itemsData } = await supabase
        .from("purchase_items")
        .select("*")
        .eq("purchase_id", purchaseRecord.id);

      const newPurchase: Purchase = {
        id: newPurchaseData.id,
        date: new Date(newPurchaseData.date),
        supplier: newPurchaseData.supplier,
        total: Number(newPurchaseData.total) || 0,
        shopId: newPurchaseData.shop_id || undefined,
        items: (itemsData || []).map((pi: any) => ({
          itemId: pi.item_id,
          itemName: pi.item_name,
          qty: pi.qty,
          costPrice: Number(pi.cost_price) || 0,
        })),
      };
      setPurchases((prev) => [newPurchase, ...prev]);
    })();
  }, [items, addItem, updateItem]);

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
    })();
  }, []);

  const approveStockAllocation = useCallback((allocationId: string) => {
    (async () => {
      const allocation = stockAllocations.find((a) => a.id === allocationId);
      if (!allocation || allocation.status !== 'pending') return;

      // Distribute to destination shops
      for (const alloc of allocation.allocations) {
        const sourceItem = items.find((i) => i.id === allocation.itemId);
        if (!sourceItem) continue;

        const destItem = items.find((i) => i.name === sourceItem.name && i.shopId === alloc.shopId);
        if (destItem) {
          await updateItem(destItem.id, { stock: destItem.stock + alloc.qty });
        } else {
          await addItem({
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
          });
        }
      }

      // Deduct from unassigned/main stock
      const sourceItem = items.find((i) => i.id === allocation.itemId && !i.shopId);
      if (sourceItem) {
        const newStock = Math.max(0, sourceItem.stock - allocation.totalQty);
        await updateItem(sourceItem.id, {
          stock: newStock,
          pendingAllocation: newStock > 0 ? sourceItem.pendingAllocation : false,
        });
      }

      // Update allocation status in Supabase
      const { error } = await supabase
        .from("stock_allocations")
        .update({
          status: 'approved',
          approved_by: 'admin', // TODO: Get actual admin user
          approved_date: new Date().toISOString(),
        })
        .eq("id", allocationId);
      if (error) {
        console.error("Error approving stock allocation:", error);
        return;
      }

      setStockAllocations((prev) =>
        prev.map((a) =>
          a.id === allocationId ? { ...a, status: 'approved', approvedDate: new Date() } : a
        )
      );
    })();
  }, [stockAllocations, items, addItem, updateItem]);

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
      setStockAllocations((prev) =>
        prev.map((a) => (a.id === allocationId ? { ...a, status: 'rejected' } : a))
      );
    })();
  }, []);

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
        addItem,
        updateItem,
        removeItem,
        addStock,
        deductStock,
        addPurchase,
        addExchange,
        confirmExchangeReceipt,
        completeExchange,
        requestStockAllocation,
        approveStockAllocation,
        rejectStockAllocation,
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
