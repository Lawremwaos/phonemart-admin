import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export type Supplier = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  categories: ('accessories' | 'spare_parts')[]; // Can be both
  createdAt: Date;
};

type SupplierContextType = {
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  getSupplierById: (id: string) => Supplier | undefined;
};

const SupplierContext = createContext<SupplierContextType | null>(null);

export const SupplierProvider = ({ children }: { children: React.ReactNode }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Load from Supabase on mount
  useEffect(() => {
    let cancelled = false;
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
          createdAt: new Date(s.created_at),
        }));
        setSuppliers(mapped);
      } catch (e) {
        console.error("Error loading suppliers from Supabase:", e);
        setSuppliers([]);
      } finally {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addSupplier = useCallback((supplierData: Omit<Supplier, 'id' | 'createdAt'>) => {
    return (async () => {
      // Check if supplier with same name already exists
      const existingSupplier = suppliers.find(s => 
        s.name.toLowerCase() === supplierData.name.toLowerCase()
      );
      
      if (existingSupplier) {
        console.warn(`Supplier "${supplierData.name}" already exists`);
        return existingSupplier.id; // Return existing supplier ID
      }

      const payload = {
        name: supplierData.name,
        phone: supplierData.phone || null,
        email: supplierData.email || null,
        address: supplierData.address || null,
        categories: supplierData.categories,
      };
      const { data, error } = await supabase.from("suppliers").insert(payload).select("*").single();
      if (error) {
        // Handle duplicate name error gracefully
        if (error.code === '23505' || error.message.includes('unique')) {
          console.warn(`Supplier "${supplierData.name}" already exists in database`);
          // Try to fetch the existing supplier
          const { data: existing } = await supabase
            .from("suppliers")
            .select("*")
            .eq("name", supplierData.name)
            .single();
          if (existing) {
            const existingSupplier: Supplier = {
              id: existing.id,
              name: existing.name,
              phone: existing.phone || undefined,
              email: existing.email || undefined,
              address: existing.address || undefined,
              categories: (existing.categories || []) as any,
              createdAt: new Date(existing.created_at),
            };
            // Add to state if not already there
            setSuppliers((prev) => {
              if (prev.find(s => s.id === existingSupplier.id)) {
                return prev;
              }
              return [existingSupplier, ...prev];
            });
            return existingSupplier.id;
          }
        } else {
          console.error("Error adding supplier:", error);
        }
        return null;
      }
      const newSupplier: Supplier = {
        id: data.id,
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        categories: (data.categories || []) as any,
        createdAt: new Date(data.created_at),
      };
      setSuppliers((prev) => [newSupplier, ...prev]);
      return newSupplier.id;
    })();
  }, [suppliers]);

  const updateSupplier = useCallback((id: string, supplierData: Partial<Supplier>) => {
    (async () => {
      const payload: any = {
        ...(supplierData.name !== undefined ? { name: supplierData.name } : {}),
        ...(supplierData.phone !== undefined ? { phone: supplierData.phone } : {}),
        ...(supplierData.email !== undefined ? { email: supplierData.email } : {}),
        ...(supplierData.address !== undefined ? { address: supplierData.address } : {}),
        ...(supplierData.categories !== undefined ? { categories: supplierData.categories } : {}),
      };
      const { error } = await supabase.from("suppliers").update(payload).eq("id", id);
      if (error) {
        console.error("Error updating supplier:", error);
        return;
      }
      setSuppliers((prev) =>
        prev.map((supplier) => (supplier.id === id ? { ...supplier, ...supplierData } : supplier))
      );
    })();
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
