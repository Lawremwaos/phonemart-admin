export type InventoryItem = {
    id: number;
    name: string;
    category: "Accessory" | "Spare";
    stock: number;
    price: number;
    reorderLevel: number;
  };
  
  export const inventoryItems: InventoryItem[] = [
    {
      id: 1,
      name: "Screen Protector",
      category: "Accessory",
      stock: 25,
      price: 300,
      reorderLevel: 10,
    },
    {
      id: 2,
      name: "Fast Charger",
      category: "Accessory",
      stock: 8,
      price: 1500,
      reorderLevel: 10,
    },
    {
      id: 3,
      name: "iPhone 11 Screen",
      category: "Spare",
      stock: 5,
      price: 6000,
      reorderLevel: 3,
    },
    {
      id: 4,
      name: "Samsung Battery",
      category: "Spare",
      stock: 2,
      price: 3500,
      reorderLevel: 3,
    },
  ];
  