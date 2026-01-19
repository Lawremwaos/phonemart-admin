import React, { createContext, useContext, useState } from "react";

export type InventoryItem = {
  id: number;
  name: string;
  category: 'Phone' | 'Spare' | 'Accessory';
  stock: number;
  price: number;
  reorderLevel: number; // when stock <= this, mark low stock
  initialStock: number; // track initial stock for movement calculation
  shopId?: string; // which shop owns this inventory
  supplier?: string; // supplier name
  costPrice?: number; // purchase cost from supplier
};

// Initial dummy data
const initialInventory: InventoryItem[] = [
  { id: 1, name: "iPhone 14", category: "Phone", stock: 10, price: 120000, reorderLevel: 3, initialStock: 10, shopId: '1', supplier: 'Apple Supplier', costPrice: 100000 },
  { id: 2, name: "Charger", category: "Accessory", stock: 25, price: 2000, reorderLevel: 5, initialStock: 25, shopId: '1', supplier: 'Accessories Co', costPrice: 1500 },
  { id: 3, name: "Screen", category: "Spare", stock: 15, price: 10000, reorderLevel: 3, initialStock: 15, shopId: '1', supplier: 'Parts Supplier', costPrice: 8000 },
];

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
  status: 'pending' | 'completed';
};

type InventoryContextType = {
  items: InventoryItem[];
  purchases: Purchase[];
  exchanges: Exchange[];
  addItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateItem: (id: number, updates: Partial<InventoryItem>) => void;
  removeItem: (id: number) => void;
  addStock: (itemId: number, qty: number) => void;
  deductStock: (name: string, qty: number) => void;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'date'>) => void;
  addExchange: (exchange: Omit<Exchange, 'id' | 'date'>) => void;
  completeExchange: (exchangeId: string) => void;
};

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<InventoryItem[]>(initialInventory);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  const addItem = (itemData: Omit<InventoryItem, 'id'>) => {
    const newId = Math.max(...items.map(i => i.id), 0) + 1;
    const newItem: InventoryItem = {
      ...itemData,
      id: newId,
      initialStock: itemData.stock,
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (id: number, updates: Partial<InventoryItem>) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addStock = (itemId: number, qty: number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, stock: item.stock + qty }
          : item
      )
    );
  };

  const deductStock = (name: string, qty: number) => {
    setItems(prev =>
      prev.map(item =>
        item.name === name
          ? { ...item, stock: Math.max(0, item.stock - qty) }
          : item
      )
    );
  };

  const addPurchase = (purchaseData: Omit<Purchase, 'id' | 'date'>) => {
    const newPurchase: Purchase = {
      ...purchaseData,
      id: Date.now().toString(),
      date: new Date(),
    };
    
    // Add stock for purchased items
    purchaseData.items.forEach(purchaseItem => {
      addStock(purchaseItem.itemId, purchaseItem.qty);
    });
    
    setPurchases(prev => [...prev, newPurchase]);
  };

  const addExchange = (exchangeData: Omit<Exchange, 'id' | 'date'>) => {
    const newExchange: Exchange = {
      ...exchangeData,
      id: Date.now().toString(),
      date: new Date(),
      status: 'pending',
    };
    setExchanges(prev => [...prev, newExchange]);
  };

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

    setExchanges(prev =>
      prev.map(e =>
        e.id === exchangeId ? { ...e, status: 'completed' as const } : e
      )
    );
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        purchases,
        exchanges,
        addItem,
        updateItem,
        removeItem,
        addStock,
        deductStock,
        addPurchase,
        addExchange,
        completeExchange,
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
