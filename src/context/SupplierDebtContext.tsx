import React, { createContext, useContext, useState, useCallback } from "react";

export type SupplierDebt = {
  id: string;
  supplierId: string;
  supplierName: string;
  itemName: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  date: Date;
  repairId: string;
  paid: boolean;
  paidDate?: Date;
};

type SupplierDebtContextType = {
  debts: SupplierDebt[];
  addDebt: (debt: Omit<SupplierDebt, 'id' | 'date' | 'totalCost' | 'paid'>) => void;
  markAsPaid: (debtId: string) => void;
  getTotalDebtBySupplier: (supplierId: string) => number;
  getDebtsBySupplier: (supplierId: string) => SupplierDebt[];
  getAllUnpaidDebts: () => SupplierDebt[];
};

const SupplierDebtContext = createContext<SupplierDebtContextType | null>(null);

export const SupplierDebtProvider = ({ children }: { children: React.ReactNode }) => {
  const [debts, setDebts] = useState<SupplierDebt[]>([]);

  const addDebt = useCallback((debtData: Omit<SupplierDebt, 'id' | 'date' | 'totalCost' | 'paid'>) => {
    const totalCost = debtData.costPerUnit * debtData.quantity;
    const newDebt: SupplierDebt = {
      ...debtData,
      id: Date.now().toString(),
      date: new Date(),
      totalCost,
      paid: false,
    };
    setDebts((prev) => [...prev, newDebt]);
  }, []);

  const markAsPaid = useCallback((debtId: string) => {
    setDebts((prev) =>
      prev.map((debt) =>
        debt.id === debtId ? { ...debt, paid: true, paidDate: new Date() } : debt
      )
    );
  }, []);

  const getTotalDebtBySupplier = useCallback((supplierId: string) => {
    return debts
      .filter((debt) => debt.supplierId === supplierId && !debt.paid)
      .reduce((sum, debt) => sum + debt.totalCost, 0);
  }, [debts]);

  const getDebtsBySupplier = useCallback((supplierId: string) => {
    return debts.filter((debt) => debt.supplierId === supplierId);
  }, [debts]);

  const getAllUnpaidDebts = useCallback(() => {
    return debts.filter((debt) => !debt.paid);
  }, [debts]);

  return (
    <SupplierDebtContext.Provider
      value={{
        debts,
        addDebt,
        markAsPaid,
        getTotalDebtBySupplier,
        getDebtsBySupplier,
        getAllUnpaidDebts,
      }}
    >
      {children}
    </SupplierDebtContext.Provider>
  );
};

export const useSupplierDebt = () => {
  const context = useContext(SupplierDebtContext);
  if (!context) {
    throw new Error("useSupplierDebt must be used within SupplierDebtProvider");
  }
  return context;
};
