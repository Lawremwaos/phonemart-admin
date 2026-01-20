import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

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
  roles: ('admin' | 'technician' | 'manager')[]; // Multiple roles support
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
  updateShop: (shopId: string, shop: Partial<Shop>) => void;
  deleteShop: (shopId: string) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (userId: string, user: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  getShopById: (shopId: string) => Shop | undefined;
  getUserShops: (userId: string) => Shop[];
  hasRole: (user: User | null, role: 'admin' | 'technician' | 'manager') => boolean;
};

const ShopContext = createContext<ShopContextType | null>(null);

// Default shops for initial setup
const defaultShops: Omit<Shop, 'id'>[] = [
  {
    name: 'PHONEMART - Main Branch',
    address: 'THIKA',
    phone: '+254715592682',
    email: 'main@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example1',
  },
  {
    name: 'PHONEMART - Westlands',
    address: '456 Westlands Road, Nairobi',
    phone: '+254712345679',
    email: 'westlands@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example2',
  },
  {
    name: 'PHONEMART - Karen',
    address: '789 Karen Road, Nairobi',
    phone: '+254712345680',
    email: 'karen@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example3',
  },
  {
    name: 'PHONEMART - Parklands',
    address: '321 Parklands Avenue, Nairobi',
    phone: '+254712345681',
    email: 'parklands@phonemart.com',
    whatsappGroup: 'https://chat.whatsapp.com/example4',
  },
];

// Default users for initial setup (shopName used to find shop ID)
const defaultUsers: Array<Omit<User, 'id' | 'shopId'> & { shopName: string }> = [
  {
    name: 'Admin User',
    email: 'admin@phonemart.com',
    password: 'admin123',
    shopName: 'PHONEMART - Main Branch',
    roles: ['admin'],
  },
  {
    name: 'Technician Main',
    email: 'tech1@phonemart.com',
    password: 'tech123',
    shopName: 'PHONEMART - Main Branch',
    roles: ['technician'],
  },
  {
    name: 'Manager Westlands',
    email: 'manager@phonemart.com',
    password: 'manager123',
    shopName: 'PHONEMART - Westlands',
    roles: ['manager'],
  },
  {
    name: 'Technician Westlands',
    email: 'tech2@phonemart.com',
    password: 'tech123',
    shopName: 'PHONEMART - Westlands',
    roles: ['technician'],
  },
  {
    name: 'Technician Karen',
    email: 'tech3@phonemart.com',
    password: 'tech123',
    shopName: 'PHONEMART - Karen',
    roles: ['technician'],
  },
  {
    name: 'Technician Parklands',
    email: 'tech4@phonemart.com',
    password: 'tech123',
    shopName: 'PHONEMART - Parklands',
    roles: ['technician'],
  },
];

export const ShopProvider = ({ children }: { children: React.ReactNode }) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Load shops and users from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load shops
        const { data: shopsData, error: shopsError } = await supabase
          .from("shops")
          .select("*")
          .order("created_at", { ascending: false });
        if (shopsError) throw shopsError;
        if (cancelled) return;

        let loadedShops: Shop[] = (shopsData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          address: s.address,
          phone: s.phone,
          email: s.email || undefined,
          whatsappGroup: s.whatsapp_group || undefined,
        }));

        // If no shops exist, create default shops
        if (loadedShops.length === 0) {
          const shopInserts = defaultShops.map(shop => ({
            name: shop.name,
            address: shop.address,
            phone: shop.phone,
            email: shop.email || null,
            whatsapp_group: shop.whatsappGroup || null,
          }));
          const { data: newShops, error: insertError } = await supabase
            .from("shops")
            .insert(shopInserts)
            .select("*");
          if (insertError) throw insertError;
          loadedShops = (newShops || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            address: s.address,
            phone: s.phone,
            email: s.email || undefined,
            whatsappGroup: s.whatsapp_group || undefined,
          }));
        }

        setShops(loadedShops);

        // Load users
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false });
        
        // If table doesn't exist, show helpful error
        if (usersError) {
          if (usersError.message?.includes('relation') || usersError.message?.includes('does not exist')) {
            console.error(
              "❌ Users table not found in Supabase!\n" +
              "Please run the SQL schema update. See UPDATE_SCHEMA_FOR_USERS.md for instructions.\n" +
              "The 'users' and 'shops' tables need to be created first."
            );
            // Set empty arrays so app doesn't crash
            setShops([]);
            setUsers([]);
            return;
          }
          throw usersError;
        }
        if (cancelled) return;

        let loadedUsers: User[] = (usersData || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          password: u.password,
          shopId: u.shop_id || '',
          roles: (u.roles || []) as ('admin' | 'technician' | 'manager')[],
        }));

        // If no users exist, create default users
        if (loadedUsers.length === 0) {
          // Create users with shop references
          for (const userData of defaultUsers) {
            const matchingShop = loadedShops.find(s => s.name === userData.shopName);
            if (!matchingShop) continue;

            const { data: newUser, error: userError } = await supabase
              .from("users")
              .insert({
                name: userData.name,
                email: userData.email,
                password: userData.password,
                shop_id: matchingShop.id,
                roles: userData.roles,
              })
              .select("*")
              .single();
            if (userError) {
              console.error("Error creating default user:", userError);
              continue;
            }
            loadedUsers.push({
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              password: newUser.password,
              shopId: newUser.shop_id,
              roles: (newUser.roles || []) as ('admin' | 'technician' | 'manager')[],
            });
          }
        }

        setUsers(loadedUsers);
      } catch (e) {
        console.error("Error loading shops/users from Supabase:", e);
        // Fallback to empty arrays
        setShops([]);
        setUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    (async () => {
      const { data, error } = await supabase
        .from("shops")
        .insert({
          name: shopData.name,
          address: shopData.address,
          phone: shopData.phone,
          email: shopData.email || null,
          whatsapp_group: shopData.whatsappGroup || null,
        })
        .select("*")
        .single();
      if (error) {
        console.error("Error adding shop:", error);
        return;
      }
      const newShop: Shop = {
        id: data.id,
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email || undefined,
        whatsappGroup: data.whatsapp_group || undefined,
      };
      setShops((prev) => [newShop, ...prev]);
    })();
  }, []);

  const updateShop = useCallback((shopId: string, shopData: Partial<Shop>) => {
    (async () => {
      const payload: any = {};
      if (shopData.name !== undefined) payload.name = shopData.name;
      if (shopData.address !== undefined) payload.address = shopData.address;
      if (shopData.phone !== undefined) payload.phone = shopData.phone;
      if (shopData.email !== undefined) payload.email = shopData.email || null;
      if (shopData.whatsappGroup !== undefined) payload.whatsapp_group = shopData.whatsappGroup || null;

      const { error } = await supabase
        .from("shops")
        .update(payload)
        .eq("id", shopId);
      if (error) {
        console.error("Error updating shop:", error);
        return;
      }
      setShops((prev) =>
        prev.map((shop) => (shop.id === shopId ? { ...shop, ...shopData } : shop))
      );
    })();
  }, []);

  const deleteShop = useCallback((shopId: string) => {
    (async () => {
      const { error } = await supabase.from("shops").delete().eq("id", shopId);
      if (error) {
        console.error("Error deleting shop:", error);
        return;
      }
      setShops((prev) => prev.filter((shop) => shop.id !== shopId));
      // Users are automatically deleted via CASCADE
      setUsers((prev) => prev.filter((user) => user.shopId !== shopId));
    })();
  }, []);

  const addUser = useCallback((userData: Omit<User, 'id'>) => {
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .insert({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          shop_id: userData.shopId || null,
          roles: userData.roles,
        })
        .select("*")
        .single();
      if (error) {
        console.error("Error adding user:", error);
        return;
      }
      const newUser: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        password: data.password,
        shopId: data.shop_id || '',
        roles: (data.roles || []) as ('admin' | 'technician' | 'manager')[],
      };
      setUsers((prev) => [newUser, ...prev]);
    })();
  }, []);

  const updateUser = useCallback((userId: string, userData: Partial<User>) => {
    (async () => {
      const payload: any = {};
      if (userData.name !== undefined) payload.name = userData.name;
      if (userData.email !== undefined) payload.email = userData.email;
      if (userData.password !== undefined) payload.password = userData.password;
      if (userData.shopId !== undefined) payload.shop_id = userData.shopId || null;
      if (userData.roles !== undefined) payload.roles = userData.roles;

      const { error } = await supabase
        .from("users")
        .update(payload)
        .eq("id", userId);
      if (error) {
        console.error("Error updating user:", error);
        return;
      }
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, ...userData } : user))
      );
    })();
  }, []);

  const deleteUser = useCallback((userId: string) => {
    (async () => {
      const { error } = await supabase.from("users").delete().eq("id", userId);
      if (error) {
        console.error("Error deleting user:", error);
        return;
      }
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    })();
  }, []);

  const getShopById = useCallback((shopId: string) => {
    return shops.find((shop) => shop.id === shopId);
  }, [shops]);

  const getUserShops = useCallback((userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return [];

    if (user.roles.includes("admin")) {
      return shops; // Admin sees all shops
    }

    return shops.filter((shop) => shop.id === user.shopId);
  }, [users, shops]);

  const hasRole = useCallback((user: User | null, role: "admin" | "technician" | "manager") => {
    if (!user) return false;
    return user.roles.includes(role);
  }, []);

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
        updateShop,
        deleteShop,
        addUser,
        updateUser,
        deleteUser,
        getShopById,
        getUserShops,
        hasRole,
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
