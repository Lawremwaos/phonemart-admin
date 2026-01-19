import React, { createContext, useContext, useState, useCallback } from "react";

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    {
      id: '1',
      name: 'Local Parts Supplier',
      phone: '+254712345678',
      categories: ['spare_parts'],
      createdAt: new Date(),
    },
    {
      id: '2',
      name: 'Tech Parts Kenya',
      phone: '+254723456789',
      categories: ['spare_parts'],
      createdAt: new Date(),
    },
  ]);

  const addSupplier = useCallback((supplierData: Omit<Supplier, 'id' | 'createdAt'>) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setSuppliers((prev) => [...prev, newSupplier]);
  }, []);

  const updateSupplier = useCallback((id: string, supplierData: Partial<Supplier>) => {
    setSuppliers((prev) =>
      prev.map((supplier) =>
        supplier.id === id ? { ...supplier, ...supplierData } : supplier
      )
    );
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id));
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
