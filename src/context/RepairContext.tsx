import React, { createContext, useContext, useState, useCallback } from "react";

export type RepairStatus = 
  | 'RECEIVED' 
  | 'IN_PROGRESS' 
  | 'WAITING_PARTS' 
  | 'REPAIR_COMPLETED' 
  | 'PAYMENT_PENDING' 
  | 'FULLY_PAID' 
  | 'COLLECTED';

export type Repair = {
  id: string;
  date: Date;
  customerName: string;
  phoneNumber: string;
  imei: string;
  phoneModel: string;
  issue: string;
  technician: string;
  partsUsed: Array<{
    itemId: number;
    itemName: string;
    qty: number;
    cost: number;
  }>;
  outsourcedCost: number;
  laborCost: number;
  totalCost: number;
  status: RepairStatus;
  shopId?: string;
  paymentStatus: 'pending' | 'partial' | 'fully_paid';
  amountPaid: number;
  balance: number;
  customerStatus?: 'waiting' | 'coming_back';
  totalAgreedAmount?: number;
  paymentTiming?: 'before' | 'after';
  depositAmount?: number;
};

type RepairContextType = {
  repairs: Repair[];
  addRepair: (repair: Omit<Repair, 'id' | 'date' | 'totalCost' | 'balance' | 'amountPaid'>) => void;
  updateRepairStatus: (repairId: string, status: RepairStatus) => void;
  updateRepairPayment: (repairId: string, amountPaid: number) => void;
  confirmPayment: (repairId: string, transactionCodes: any, paymentMethod: string, splitPayments?: any[]) => void;
  getRepairsByStatus: (status: RepairStatus) => Repair[];
  getRepairsByShop: (shopId: string) => Repair[];
  getTotalRepairRevenue: () => number;
  getTotalOutsourcedCosts: () => number;
  getTotalLaborCosts: () => number;
};

const RepairContext = createContext<RepairContextType | null>(null);

export const RepairProvider = ({ children }: { children: React.ReactNode }) => {
  const [repairs, setRepairs] = useState<Repair[]>([]);

  const addRepair = useCallback((repairData: Omit<Repair, 'id' | 'date' | 'totalCost' | 'balance' | 'amountPaid'>) => {
    const partsTotal = repairData.partsUsed.reduce((sum, part) => sum + (part.cost * part.qty), 0);
    const totalCost = partsTotal + repairData.outsourcedCost + repairData.laborCost;
    
    const newRepair: Repair = {
      ...repairData,
      id: Date.now().toString(),
      date: new Date(),
      totalCost,
      amountPaid: 0,
      balance: totalCost,
      paymentStatus: 'pending',
      status: 'RECEIVED',
    };
    
    setRepairs((prev) => [...prev, newRepair]);
  }, []);

  const updateRepairStatus = useCallback((repairId: string, status: RepairStatus) => {
    setRepairs((prev) =>
      prev.map((repair) =>
        repair.id === repairId ? { ...repair, status } : repair
      )
    );
  }, []);

  const updateRepairPayment = useCallback((repairId: string, amountPaid: number) => {
    setRepairs((prev) =>
      prev.map((repair) => {
        if (repair.id === repairId) {
          const newAmountPaid = repair.amountPaid + amountPaid;
          const balance = (repair.totalAgreedAmount || repair.totalCost) - newAmountPaid;
          const paymentStatus = balance <= 0 ? 'fully_paid' : newAmountPaid > 0 ? 'partial' : 'pending';
          const status = paymentStatus === 'fully_paid' ? 'FULLY_PAID' : repair.status;
          
          return {
            ...repair,
            amountPaid: newAmountPaid,
            balance,
            paymentStatus,
            status,
          };
        }
        return repair;
      })
    );
  }, []);

  const confirmPayment = useCallback((repairId: string, _transactionCodes: any, _paymentMethod: string, _splitPayments?: any[]) => {
    setRepairs((prev) =>
      prev.map((repair) => {
        if (repair.id === repairId) {
          const totalAmount = repair.totalAgreedAmount || repair.totalCost;
          const newAmountPaid = totalAmount; // Full payment
          const balance = 0;
          const paymentStatus = 'fully_paid';
          const status = 'FULLY_PAID';
          
          return {
            ...repair,
            amountPaid: newAmountPaid,
            balance,
            paymentStatus,
            status,
            paymentMade: true,
            pendingTransactionCodes: undefined, // Clear pending codes
          };
        }
        return repair;
      })
    );
  }, []);

  const getRepairsByStatus = useCallback((status: RepairStatus) => {
    return repairs.filter(repair => repair.status === status);
  }, [repairs]);

  const getRepairsByShop = useCallback((shopId: string) => {
    return repairs.filter(repair => repair.shopId === shopId);
  }, [repairs]);

  const getTotalRepairRevenue = useCallback(() => {
    return repairs.reduce((sum, repair) => sum + repair.amountPaid, 0);
  }, [repairs]);

  const getTotalOutsourcedCosts = useCallback(() => {
    return repairs.reduce((sum, repair) => sum + repair.outsourcedCost, 0);
  }, [repairs]);

  const getTotalLaborCosts = useCallback(() => {
    return repairs.reduce((sum, repair) => sum + repair.laborCost, 0);
  }, [repairs]);

  return (
    <RepairContext.Provider
      value={{
        repairs,
        addRepair,
        updateRepairStatus,
        updateRepairPayment,
        confirmPayment,
        getRepairsByStatus,
        getRepairsByShop,
        getTotalRepairRevenue,
        getTotalOutsourcedCosts,
        getTotalLaborCosts,
      }}
    >
      {children}
    </RepairContext.Provider>
  );
};

export const useRepair = () => {
  const ctx = useContext(RepairContext);
  if (!ctx) throw new Error("RepairContext not found");
  return ctx;
};
