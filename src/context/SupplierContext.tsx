import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export type SupplierType = 'local' | 'wholesale';

export type Supplier = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  categories: ('accessories' | 'spare_parts')[];
  supplierType?: SupplierType; // local = visible to staff; wholesale = admin only; default local
  createdAt: Date;
};

type SupplierContextType = {
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Promise<string | null>;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => void;
  getSupplierById: (id: string) => Supplier | undefined;
};

const SupplierContext = createContext<SupplierContextType | null>(null);

export const SupplierProvider = ({ children }: { children: React.ReactNode }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Load from Supabase on mount and set up real-time subscription
  useEffect(() => {
    let cancelled = false;
    
    // Initial load
    (async () => {
      try {
        const { data, error } = await supabase
          .from("suppliers")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        const mapped: Supplier[] = (data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          phone: s.phone || undefined,
          email: s.email || undefined,
          address: s.address || undefined,
          categories: (s.categories || []) as any,
          supplierType: (s.supplier_type === 'wholesale' ? 'wholesale' : 'local') as SupplierType,
          createdAt: new Date(s.created_at),
        }));
        setSuppliers(mapped);
      } catch (e) {
        console.error("Error loading suppliers from Supabase:", e);
        setSuppliers([]);
      }
    })();

    // Set up real-time subscription
    const channel = supabase
      .channel('suppliers-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'suppliers' },
        async () => {
          if (cancelled) return;
          try {
            const { data, error } = await supabase
              .from("suppliers")
              .select("*")
              .order("created_at", { ascending: false });
            if (!error && data) {
              const mapped: Supplier[] = data.map((s: any) => ({
                id: s.id,
                name: s.name,
                phone: s.phone || undefined,
                email: s.email || undefined,
                address: s.address || undefined,
                categories: (s.categories || []) as any,
                supplierType: (s.supplier_type === 'wholesale' ? 'wholesale' : 'local') as SupplierType,
                createdAt: new Date(s.created_at),
              }));
              setSuppliers(mapped);
            }
          } catch (e) {
            console.error("Error reloading suppliers:", e);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const addSupplier = useCallback(async (supplierData: Omit<Supplier, 'id' | 'createdAt'>): Promise<string | null> => {
    const existingSupplier = suppliers.find(s =>
      s.name.toLowerCase() === supplierData.name.toLowerCase()
    );
    if (existingSupplier) return existingSupplier.id;

    const payload = {
      name: supplierData.name,
      phone: supplierData.phone || null,
      email: supplierData.email || null,
      address: supplierData.address || null,
      categories: supplierData.categories,
    };

    const { data, error } = await supabase.from("suppliers").insert(payload).select("*").single();
    if (error) {
      if (error.code === "23505" || error.message.includes("unique")) {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("*")
          .eq("name", supplierData.name)
          .single();
        if (existing) {
          const mapped: Supplier = {
            id: existing.id,
            name: existing.name,
            phone: existing.phone || undefined,
            email: existing.email || undefined,
            address: existing.address || undefined,
            categories: (existing.categories || []) as Supplier["categories"],
            supplierType: (existing.supplier_type === "wholesale" ? "wholesale" : "local") as SupplierType,
            createdAt: new Date(existing.created_at),
          };
          setSuppliers((prev) =>
            prev.some((s) => s.id === mapped.id) ? prev : [mapped, ...prev]
          );
          return mapped.id;
        }
      }
      console.error("Error adding supplier:", error);
      throw error;
    }
    const newSupplier: Supplier = {
      id: data.id,
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      categories: (data.categories || []) as Supplier["categories"],
      supplierType: (data.supplier_type === "wholesale" ? "wholesale" : "local") as SupplierType,
      createdAt: new Date(data.created_at),
    };
    setSuppliers((prev) => [newSupplier, ...prev]);
    return newSupplier.id;
  }, [suppliers]);

  const updateSupplier = useCallback(async (id: string, supplierData: Partial<Supplier>): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (supplierData.name !== undefined) payload.name = supplierData.name;
    if (supplierData.phone !== undefined) payload.phone = supplierData.phone;
    if (supplierData.email !== undefined) payload.email = supplierData.email;
    if (supplierData.address !== undefined) payload.address = supplierData.address;
    if (supplierData.categories !== undefined) payload.categories = supplierData.categories;
    const { error } = await supabase.from("suppliers").update(payload).eq("id", id);
    if (error) {
      console.error("Error updating supplier:", error);
      throw error;
    }
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...supplierData } : s))
    );
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    (async () => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) {
        console.error("Error deleting supplier:", error);
        return;
      }
      setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id));
    })();
  }, []);

  const getSupplierById = useCallback((id: string) => {
    return suppliers.find((s) => s.id === id);
  }, [suppliers]);

  return (
    <SupplierContext.Provider
      value={{
        suppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        getSupplierById,
      }}
    >
      {children}
    </SupplierContext.Provider>
  );
};

export const useSupplier = () => {
  const context = useContext(SupplierContext);
  if (!context) {
    throw new Error("useSupplier must be used within SupplierProvider");
  }
  return context;
};
