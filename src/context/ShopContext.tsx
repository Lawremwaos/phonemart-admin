import React, { createContext, useContext, useState, useCallback } from "react";

export type Shop = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  whatsappGroup?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  shopId: string;
  role: 'admin' | 'technician' | 'manager';
};

type ShopContextType = {
  currentShop: Shop | null;
  currentUser: User | null;
  shops: Shop[];
  users: User[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  setCurrentShop: (shop: Shop | null) => void;
  setCurrentUser: (user: User | null) => void;
  addShop: (shop: Omit<Shop, 'id'>) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  getShopById: (shopId: string) => Shop | undefined;
  getUserShops: (userId: string) => Shop[];
};

const ShopContext = createContext<ShopContextType | null>(null);

// Default shops for demo - 4 shops
const defaultShops: Shop[] = [
  {
    id: '1',
    name: 'PHONEMART - Main Branch',
    address: '123 Main Street, Nairobi',
    phone: '+254712345678',
    email: 'main@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example1',
  },
  {
    id: '2',
    name: 'PHONEMART - Westlands',
    address: '456 Westlands Road, Nairobi',
    phone: '+254712345679',
    email: 'westlands@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example2',
  },
  {
    id: '3',
    name: 'PHONEMART - Karen',
    address: '789 Karen Road, Nairobi',
    phone: '+254712345680',
    email: 'karen@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example3',
  },
  {
    id: '4',
    name: 'PHONEMART - Parklands',
    address: '321 Parklands Avenue, Nairobi',
    phone: '+254712345681',
    email: 'parklands@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example4',
  },
];

// Default users for demo - users for each shop
const defaultUsers: User[] = [
  // Admin/CEO - can see all shops
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@phonemart.com',
    password: 'admin123',
    shopId: '1',
    role: 'admin',
  },
  // Shop 1 - Main Branch
  {
    id: '2',
    name: 'Technician Main',
    email: 'tech1@phonemart.com',
    password: 'tech123',
    shopId: '1',
    role: 'technician',
  },
  // Shop 2 - Westlands
  {
    id: '3',
    name: 'Manager Westlands',
    email: 'manager@phonemart.com',
    password: 'manager123',
    shopId: '2',
    role: 'manager',
  },
  {
    id: '4',
    name: 'Technician Westlands',
    email: 'tech2@phonemart.com',
    password: 'tech123',
    shopId: '2',
    role: 'technician',
  },
  // Shop 3 - Karen
  {
    id: '5',
    name: 'Technician Karen',
    email: 'tech3@phonemart.com',
    password: 'tech123',
    shopId: '3',
    role: 'technician',
  },
  // Shop 4 - Parklands
  {
    id: '6',
    name: 'Technician Parklands',
    email: 'tech4@phonemart.com',
    password: 'tech123',
    shopId: '4',
    role: 'technician',
  },
];

export const ShopProvider = ({ children }: { children: React.ReactNode }) => {
  const [shops, setShops] = useState<Shop[]>(defaultShops);
  const [users, setUsers] = useState<User[]>(defaultUsers);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const login = useCallback((email: string, password: string): boolean => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      setCurrentUser(user);
      // Set user's shop as current shop
      const userShop = shops.find(s => s.id === user.shopId);
      if (userShop) {
        setCurrentShop(userShop);
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, [users, shops]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setCurrentShop(null);
    setIsAuthenticated(false);
  }, []);

  const addShop = useCallback((shopData: Omit<Shop, 'id'>) => {
    const newShop: Shop = {
      ...shopData,
      id: Date.now().toString(),
    };
    setShops((prev) => [...prev, newShop]);
  }, []);

  const addUser = useCallback((userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
      id: Date.now().toString(),
    };
    setUsers((prev) => [...prev, newUser]);
  }, []);

  const getShopById = useCallback((shopId: string) => {
    return shops.find(shop => shop.id === shopId);
  }, [shops]);

  const getUserShops = useCallback((userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return [];
    
    if (user.role === 'admin') {
      return shops; // Admin sees all shops
    }
    
    return shops.filter(shop => shop.id === user.shopId);
  }, [users, shops]);

  return (
    <ShopContext.Provider
      value={{
        currentShop,
        currentUser,
        shops,
        users,
        isAuthenticated,
        login,
        logout,
        setCurrentShop,
        setCurrentUser,
        addShop,
        addUser,
        getShopById,
        getUserShops,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("ShopContext not found");
  return ctx;
};
