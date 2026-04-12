import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const ROLE_SET = new Set(["admin", "technician", "manager"]);

function normalizeRoles(raw: unknown): ("admin" | "technician" | "manager")[] {
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  } else if (typeof raw === "string") {
    const s = raw.trim();
    if (s.startsWith("[")) {
      try {
        const p = JSON.parse(s) as unknown;
        if (Array.isArray(p)) list = p.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
      } catch {
        list = [];
      }
    }
    if (list.length === 0) {
      list = s.split(/[,\s|]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    }
  }
  const out = [...new Set(list)].filter((r): r is "admin" | "technician" | "manager" =>
    ROLE_SET.has(r)
  );
  return out.length ? out : ["technician"];
}

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
  managerScope?: 'accessories' | 'repair' | 'both';
};

export type StaffAuditLog = {
  id: string;
  action: 'staff_add' | 'staff_update' | 'staff_delete';
  actor?: string;
  targetUserId?: string;
  targetName?: string;
  details?: string;
  createdAt: Date;
};

type ShopContextType = {
  currentShop: Shop | null;
  currentUser: User | null;
  shops: Shop[];
  users: User[];
  staffAuditLogs: StaffAuditLog[];
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrentShop: (shop: Shop | null) => void;
  setCurrentUser: (user: User | null) => void;
  addShop: (shop: Omit<Shop, 'id'>) => void;
  updateShop: (shopId: string, shop: Partial<Shop>) => void;
  deleteShop: (shopId: string) => void;
  addUser: (user: Omit<User, 'id'>) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (userId: string, user: Partial<User>) => Promise<{ ok: boolean; error?: string }>;
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
  const [staffAuditLogs, setStaffAuditLogs] = useState<StaffAuditLog[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);

  // Load shops and users from Supabase on mount, with real-time subscriptions
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
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
          roles: normalizeRoles(u.roles),
          managerScope: (u.manager_scope || undefined) as 'accessories' | 'repair' | 'both' | undefined,
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
                roles: normalizeRoles(userData.roles),
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
              roles: normalizeRoles(newUser.roles),
              managerScope: (newUser.manager_scope || undefined) as 'accessories' | 'repair' | 'both' | undefined,
            });
          }
        }

        setUsers(loadedUsers);
        console.log("Loaded users from Supabase:", loadedUsers.length, loadedUsers.map(u => u.email));
      } catch (e) {
        console.error("Error loading shops/users from Supabase:", e);
        setShops([]);
        setUsers([]);
      }
    };

    loadData();

    // Real-time subscriptions for live updates
    const shopsChannel = supabase
      .channel('shops-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
        if (!cancelled) loadData();
      })
      .subscribe();

    const usersChannel = supabase
      .channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        if (!cancelled) loadData();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(shopsChannel);
      supabase.removeChannel(usersChannel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("staff_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!cancelled) {
          setStaffAuditLogs(
            (data || []).map((row: any) => ({
              id: row.id,
              action: row.action as StaffAuditLog['action'],
              actor: row.actor || undefined,
              targetUserId: row.target_user_id || undefined,
              targetName: row.target_name || undefined,
              details: row.details || undefined,
              createdAt: new Date(row.created_at),
            }))
          );
        }
      } catch {
        if (!cancelled) setStaffAuditLogs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addStaffAuditLog = useCallback(async (entry: Omit<StaffAuditLog, 'id' | 'createdAt'>) => {
    const local: StaffAuditLog = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
    };
    setStaffAuditLogs((prev) => [local, ...prev].slice(0, 200));
    const { data, error } = await supabase
      .from("staff_audit_logs")
      .insert({
        action: entry.action,
        actor: entry.actor || currentUser?.name || null,
        target_user_id: entry.targetUserId || null,
        target_name: entry.targetName || null,
        details: entry.details || null,
      })
      .select("*")
      .single();
    if (error) return;
    setStaffAuditLogs((prev) => [
      {
        id: data.id,
        action: data.action as StaffAuditLog['action'],
        actor: data.actor || undefined,
        targetUserId: data.target_user_id || undefined,
        targetName: data.target_name || undefined,
        details: data.details || undefined,
        createdAt: new Date(data.created_at),
      },
      ...prev.filter((l) => l.id !== local.id),
    ].slice(0, 200));
  }, [currentUser?.name]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const emailVariants = [...new Set([normalizedEmail, email.trim()])];

    setIsLoadingAuth(true);
    try {
      type DbUserRow = {
        id: string;
        name: string;
        email: string;
        password: string;
        shop_id: string | null;
        roles: string[] | null;
        manager_scope: 'accessories' | 'repair' | 'both' | null;
      };
      let userRow: DbUserRow | null = null;

      for (const em of emailVariants) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", em)
          .eq("password", normalizedPassword)
          .maybeSingle();

        if (error) {
          if (import.meta.env.DEV) {
            console.error("Login query failed:", error.code, error.message);
          }
          return false;
        }
        if (data) {
          userRow = data as DbUserRow;
          break;
        }
      }

      if (!userRow) {
        return false;
      }

      const user: User = {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        password: userRow.password,
        shopId: userRow.shop_id || '',
        roles: normalizeRoles(userRow.roles),
        managerScope: userRow.manager_scope || undefined,
      };

      setCurrentUser(user);

      if (userRow.shop_id) {
        const { data: shopData, error: shopErr } = await supabase
          .from("shops")
          .select("*")
          .eq("id", userRow.shop_id)
          .maybeSingle();

        if (!shopErr && shopData) {
          const s = shopData as Record<string, unknown>;
          setCurrentShop({
            id: String(s.id),
            name: String(s.name),
            address: String(s.address),
            phone: String(s.phone),
            email: s.email ? String(s.email) : undefined,
            whatsappGroup: s.whatsapp_group ? String(s.whatsapp_group) : undefined,
          });
        } else {
          const userShop = shops.find((x) => x.id === user.shopId);
          if (userShop) setCurrentShop(userShop);
        }
      } else {
        const userShop = shops.find((x) => x.id === user.shopId);
        if (userShop) setCurrentShop(userShop);
      }

      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoadingAuth(false);
    }
  }, [shops]);

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

  const addUser = useCallback(
    async (userData: Omit<User, "id">): Promise<{ ok: boolean; error?: string }> => {
      const email = (userData.email || "").trim().toLowerCase();
      const password = (userData.password || "").trim();
      if (!password) {
        const msg = "Password is required when adding a user";
        console.error(msg);
        return { ok: false, error: msg };
      }
      const roles = normalizeRoles(userData.roles);
      const { data, error } = await supabase
        .from("users")
        .insert({
          name: (userData.name || "").trim(),
          email,
          password,
          shop_id: userData.shopId || null,
          roles,
          manager_scope: userData.managerScope || null,
        })
        .select("*")
        .single();
      if (error) {
        console.error("Error adding user:", error);
        return { ok: false, error: error.message };
      }
      const newUser: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        password: data.password,
        shopId: data.shop_id || "",
        roles: normalizeRoles(data.roles),
        managerScope: (data.manager_scope || undefined) as "accessories" | "repair" | "both" | undefined,
      };
      setUsers((prev) => [newUser, ...prev]);
      void addStaffAuditLog({
        action: "staff_add",
        targetUserId: newUser.id,
        targetName: newUser.name,
        details: `Added staff with roles: ${newUser.roles.join(", ")}`,
      });
      return { ok: true };
    },
    [addStaffAuditLog]
  );

  const updateUser = useCallback(
    async (userId: string, userData: Partial<User>): Promise<{ ok: boolean; error?: string }> => {
      const payload: Record<string, unknown> = {};
      if (userData.name !== undefined) payload.name = (userData.name || "").trim();
      if (userData.email !== undefined) payload.email = (userData.email || "").trim().toLowerCase();
      if (userData.password !== undefined && (userData.password || "").trim() !== "") {
        payload.password = (userData.password || "").trim();
      }
      if (userData.shopId !== undefined) payload.shop_id = userData.shopId || null;
      if (userData.roles !== undefined) payload.roles = normalizeRoles(userData.roles);
      if (userData.managerScope !== undefined) payload.manager_scope = userData.managerScope || null;

      const { error } = await supabase.from("users").update(payload).eq("id", userId);
      if (error) {
        console.error("Error updating user:", error);
        return { ok: false, error: error.message };
      }
      setUsers((prev) =>
        prev.map((user) => {
          if (user.id !== userId) return user;
          const merged = { ...user, ...userData } as User;
          if (userData.roles !== undefined) merged.roles = normalizeRoles(userData.roles);
          if (payload.password === undefined) merged.password = user.password;
          return merged;
        })
      );
      const target = users.find((u) => u.id === userId);
      void addStaffAuditLog({
        action: "staff_update",
        targetUserId: userId,
        targetName: userData.name || target?.name,
        details: `Updated staff account fields: ${Object.keys(payload).join(", ")}`,
      });
      return { ok: true };
    },
    [addStaffAuditLog, users]
  );

  const deleteUser = useCallback((userId: string) => {
    (async () => {
      const { error } = await supabase.from("users").delete().eq("id", userId);
      if (error) {
        console.error("Error deleting user:", error);
        return;
      }
      const target = users.find((u) => u.id === userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      void addStaffAuditLog({
        action: 'staff_delete',
        targetUserId: userId,
        targetName: target?.name,
        details: 'Deleted staff account',
      });
    })();
  }, [addStaffAuditLog, users]);

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
        staffAuditLogs,
        isAuthenticated,
        isLoadingAuth,
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
