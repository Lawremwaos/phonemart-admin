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
  repairId?: string;
  saleId?: string;
  type: 'repair' | 'sale' | 'purchase';
  paid: boolean;
  paidDate?: Date;
  paidBy?: string;
};

type SupplierDebtContextType = {
  debts: SupplierDebt[];
  addDebt: (debt: Omit<SupplierDebt, 'id' | 'date' | 'totalCost' | 'paid'>) => void;
  updateDebtCost: (debtId: string, costPerUnit: number) => void;
  markAsPaid: (debtId: string, paidBy?: string) => void;
  getTotalDebtBySupplier: (supplierId: string) => number;
  getDebtsBySupplier: (supplierId: string) => SupplierDebt[];
  getAllUnpaidDebts: () => SupplierDebt[];
  getTodaysDebtsBySupplier: (supplierId: string) => SupplierDebt[];
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
      type: debtData.type || 'repair',
    };
    setDebts((prev) => [...prev, newDebt]);
  }, []);

  const updateDebtCost = useCallback((debtId: string, costPerUnit: number) => {
    setDebts((prev) =>
      prev.map((debt) => {
        if (debt.id === debtId) {
          const totalCost = costPerUnit * debt.quantity;
          return { ...debt, costPerUnit, totalCost };
        }
        return debt;
      })
    );
  }, []);

  const markAsPaid = useCallback((debtId: string, paidBy?: string) => {
    setDebts((prev) =>
      prev.map((debt) =>
        debt.id === debtId 
          ? { ...debt, paid: true, paidDate: new Date(), paidBy } 
          : debt
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

  const getTodaysDebtsBySupplier = useCallback((supplierId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return debts.filter((debt) => {
      if (debt.supplierId !== supplierId || debt.paid) return false;
      const debtDate = new Date(debt.date);
      debtDate.setHours(0, 0, 0, 0);
      return debtDate.getTime() === today.getTime();
    });
  }, [debts]);

  return (
    <SupplierDebtContext.Provider
      value={{
        debts,
        addDebt,
        updateDebtCost,
        markAsPaid,
        getTotalDebtBySupplier,
        getDebtsBySupplier,
        getAllUnpaidDebts,
        getTodaysDebtsBySupplier,
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
