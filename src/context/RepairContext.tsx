import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

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
  additionalItems?: Array<{
    itemName: string;
    source: 'inventory' | 'outsourced';
    itemId?: number;
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
  paymentApproved?: boolean;
  paymentMade?: boolean;
  pendingTransactionCodes?: {
    paymentMethod: string;
    transactionCodes: any;
  };
  ticketNumber?: string; // Ticket number assigned to repair (not for deposits)
  collected?: boolean; // Whether phone has been collected
};

type RepairContextType = {
  repairs: Repair[];
  addRepair: (repair: Omit<Repair, 'id' | 'date' | 'totalCost'> & { amountPaid?: number; balance?: number }) => void;
  updateRepairStatus: (repairId: string, status: RepairStatus) => void;
  updateRepairPayment: (repairId: string, amountPaid: number) => void;
  confirmPayment: (repairId: string, transactionCodes: any, paymentMethod: string, splitPayments?: any[]) => void;
  approvePayment: (repairId: string) => void;
  confirmCollection: (repairId: string) => void;
  deleteRepair: (repairId: string) => void;
  getRepairsByStatus: (status: RepairStatus) => Repair[];
  getRepairsByShop: (shopId: string) => Repair[];
  getTotalRepairRevenue: () => number;
  getTotalOutsourcedCosts: () => number;
  getTotalLaborCosts: () => number;
};

const RepairContext = createContext<RepairContextType | null>(null);

export const RepairProvider = ({ children }: { children: React.ReactNode }) => {
  const [repairs, setRepairs] = useState<Repair[]>([]);

  // Helper function to load repair with details
  const loadRepairWithDetails = useCallback(async (repairData: any): Promise<Repair> => {
    const { data: partsData } = await supabase
      .from("repair_parts")
      .select("*")
      .eq("repair_id", repairData.id);
    
    const { data: additionalData } = await supabase
      .from("additional_repair_items")
      .select("*")
      .eq("repair_id", repairData.id);

    return {
      id: repairData.id,
      date: new Date(repairData.date),
      customerName: repairData.customer_name,
      phoneNumber: repairData.phone_number,
      imei: repairData.imei || "",
      phoneModel: repairData.phone_model,
      issue: repairData.issue,
      technician: repairData.technician || "",
      partsUsed: (partsData || []).map((p: any) => ({
        itemId: p.item_id || 0,
        itemName: p.item_name,
        qty: p.qty,
        cost: Number(p.cost) || 0,
      })),
      additionalItems: (additionalData || []).map((a: any) => ({
        itemName: a.item_name,
        source: a.source as 'inventory' | 'outsourced',
        itemId: a.item_id || undefined,
      })),
      outsourcedCost: Number(repairData.outsourced_cost) || 0,
      laborCost: Number(repairData.labor_cost) || 0,
      totalCost: Number(repairData.total_cost) || 0,
      status: repairData.status as RepairStatus,
      shopId: repairData.shop_id || undefined,
      paymentStatus: repairData.payment_status as 'pending' | 'partial' | 'fully_paid',
      amountPaid: Number(repairData.amount_paid) || 0,
      balance: Number(repairData.balance) || 0,
      customerStatus: repairData.customer_status as 'waiting' | 'coming_back' | undefined,
      totalAgreedAmount: repairData.total_agreed_amount ? Number(repairData.total_agreed_amount) : undefined,
      paymentTiming: repairData.payment_timing as 'before' | 'after' | undefined,
      depositAmount: repairData.deposit_amount ? Number(repairData.deposit_amount) : undefined,
      paymentApproved: repairData.payment_approved || false,
      paymentMade: repairData.payment_made || false,
      pendingTransactionCodes: repairData.pending_transaction_codes || undefined,
      ticketNumber: repairData.ticket_number || undefined,
      collected: repairData.collected || false,
    };
  }, []);

  // Load repairs from Supabase on mount and set up real-time subscription
  useEffect(() => {
    let cancelled = false;
    
    // Initial load
    (async () => {
      try {
        const { data: repairsData, error: repairsError } = await supabase
          .from("repairs")
          .select("*")
          .order("date", { ascending: false });
        if (repairsError) throw repairsError;
        if (cancelled) return;

        const repairsWithDetails: Repair[] = await Promise.all(
          (repairsData || []).map(r => loadRepairWithDetails(r))
        );
        setRepairs(repairsWithDetails);
      } catch (e) {
        console.error("Error loading repairs from Supabase:", e);
        setRepairs([]);
      }
    })();

    // Set up real-time subscription
    const channel = supabase
      .channel('repairs-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'repairs' },
        async () => {
          if (cancelled) return;
          
          // Reload all repairs when any change occurs
          try {
            const { data: repairsData } = await supabase
              .from("repairs")
              .select("*")
              .order("date", { ascending: false });
            
            if (repairsData) {
              const repairsWithDetails: Repair[] = await Promise.all(
                repairsData.map(r => loadRepairWithDetails(r))
              );
              setRepairs(repairsWithDetails);
            }
          } catch (e) {
            console.error("Error reloading repairs:", e);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [loadRepairWithDetails]);

  const addRepair = useCallback((repairData: Omit<Repair, 'id' | 'date' | 'totalCost'> & { amountPaid?: number; balance?: number }) => {
    (async () => {
      const partsTotal = repairData.partsUsed.reduce((sum, part) => sum + (part.cost * part.qty), 0);
      const totalCost = partsTotal + repairData.outsourcedCost + repairData.laborCost;
      // Use agreed amount as the final total if available, otherwise use calculated total
      const finalTotal = repairData.totalAgreedAmount || totalCost;
      
      // Use provided amountPaid and balance if available, otherwise calculate
      const amountPaid = repairData.amountPaid !== undefined ? repairData.amountPaid : 0;
      const balance = repairData.balance !== undefined ? repairData.balance : (finalTotal - amountPaid);
      
      // Insert repair
      const { data: repairRecord, error: repairError } = await supabase
        .from("repairs")
        .insert({
          customer_name: repairData.customerName,
          phone_number: repairData.phoneNumber,
          imei: repairData.imei || null,
          phone_model: repairData.phoneModel,
          issue: repairData.issue,
          technician: repairData.technician || null,
          outsourced_cost: repairData.outsourcedCost || 0,
          labor_cost: repairData.laborCost || 0,
          total_cost: totalCost,
          total_agreed_amount: repairData.totalAgreedAmount || null,
          status: repairData.status || 'RECEIVED',
          shop_id: repairData.shopId || null,
          payment_status: repairData.paymentStatus || 'pending',
          amount_paid: amountPaid,
          balance: balance,
          customer_status: repairData.customerStatus || null,
          payment_timing: repairData.paymentTiming || null,
          deposit_amount: repairData.depositAmount || null,
          payment_approved: repairData.paymentApproved || false,
          payment_made: repairData.paymentMade || false,
          pending_transaction_codes: repairData.pendingTransactionCodes || null,
          ticket_number: (repairData as any).ticketNumber || null,
          collected: (repairData as any).collected || false,
        })
        .select("*")
        .single();
      if (repairError) {
        console.error("Error adding repair:", repairError);
        return;
      }

      // Insert repair parts
      if (repairData.partsUsed.length > 0) {
        const partsPayload = repairData.partsUsed.map((part) => ({
          repair_id: repairRecord.id,
          item_id: part.itemId || null,
          item_name: part.itemName,
          qty: part.qty,
          cost: part.cost,
        }));
        const { error: partsError } = await supabase
          .from("repair_parts")
          .insert(partsPayload);
        if (partsError) {
          console.error("Error adding repair parts:", partsError);
          return;
        }
      }

      // Insert additional items
      if (repairData.additionalItems && repairData.additionalItems.length > 0) {
        const additionalPayload = repairData.additionalItems.map((item) => ({
          repair_id: repairRecord.id,
          item_name: item.itemName,
          source: item.source,
          item_id: item.itemId || null,
          supplier_name: item.source === 'outsourced' ? item.itemName : null, // Store supplier name if outsourced
        }));
        const { error: additionalError } = await supabase
          .from("additional_repair_items")
          .insert(additionalPayload);
        if (additionalError) {
          console.error("Error adding additional repair items:", additionalError);
          return;
        }
      }

      // Reload repairs to get the new one with all details
      const { data: newRepairData, error: fetchError } = await supabase
        .from("repairs")
        .select("*")
        .eq("id", repairRecord.id)
        .single();
      if (fetchError) {
        console.error("Error fetching new repair:", fetchError);
        return;
      }

      const { data: partsData } = await supabase
        .from("repair_parts")
        .select("*")
        .eq("repair_id", repairRecord.id);

      const { data: additionalData } = await supabase
        .from("additional_repair_items")
        .select("*")
        .eq("repair_id", repairRecord.id);

      const newRepair: Repair = {
        id: newRepairData.id,
        date: new Date(newRepairData.date),
        customerName: newRepairData.customer_name,
        phoneNumber: newRepairData.phone_number,
        imei: newRepairData.imei || "",
        phoneModel: newRepairData.phone_model,
        issue: newRepairData.issue,
        technician: newRepairData.technician || "",
        partsUsed: (partsData || []).map((p: any) => ({
          itemId: p.item_id || 0,
          itemName: p.item_name,
          qty: p.qty,
          cost: Number(p.cost) || 0,
        })),
        additionalItems: (additionalData || []).map((a: any) => ({
          itemName: a.item_name,
          source: a.source as 'inventory' | 'outsourced',
          itemId: a.item_id || undefined,
        })),
        outsourcedCost: Number(newRepairData.outsourced_cost) || 0,
        laborCost: Number(newRepairData.labor_cost) || 0,
        totalCost: Number(newRepairData.total_cost) || 0,
        status: newRepairData.status as RepairStatus,
        shopId: newRepairData.shop_id || undefined,
        paymentStatus: newRepairData.payment_status as 'pending' | 'partial' | 'fully_paid',
        amountPaid: Number(newRepairData.amount_paid) || 0,
        balance: Number(newRepairData.balance) || 0,
        customerStatus: newRepairData.customer_status as 'waiting' | 'coming_back' | undefined,
        totalAgreedAmount: newRepairData.total_agreed_amount ? Number(newRepairData.total_agreed_amount) : undefined,
        paymentTiming: newRepairData.payment_timing as 'before' | 'after' | undefined,
        depositAmount: newRepairData.deposit_amount ? Number(newRepairData.deposit_amount) : undefined,
              paymentApproved: newRepairData.payment_approved || false,
              paymentMade: newRepairData.payment_made || false,
              pendingTransactionCodes: newRepairData.pending_transaction_codes || undefined,
              ticketNumber: newRepairData.ticket_number || undefined,
              collected: newRepairData.collected || false,
            };
      
      setRepairs((prev) => [newRepair, ...prev]);
    })();
  }, []);

  const updateRepairStatus = useCallback((repairId: string, status: RepairStatus) => {
    (async () => {
      const { error } = await supabase
        .from("repairs")
        .update({ status })
        .eq("id", repairId);
      if (error) {
        console.error("Error updating repair status:", error);
        return;
      }
      setRepairs((prev) =>
        prev.map((repair) =>
          repair.id === repairId ? { ...repair, status } : repair
        )
      );
    })();
  }, []);

  const updateRepairPayment = useCallback((repairId: string, amountPaid: number) => {
    (async () => {
      const repair = repairs.find((r) => r.id === repairId);
      if (!repair) return;

      const newAmountPaid = repair.amountPaid + amountPaid;
      const balance = (repair.totalAgreedAmount || repair.totalCost) - newAmountPaid;
      const paymentStatus = balance <= 0 ? 'fully_paid' : newAmountPaid > 0 ? 'partial' : 'pending';
      const status = paymentStatus === 'fully_paid' ? 'FULLY_PAID' : repair.status;

      const { error } = await supabase
        .from("repairs")
        .update({
          amount_paid: newAmountPaid,
          balance: balance,
          payment_status: paymentStatus,
          status: status,
        })
        .eq("id", repairId);
      if (error) {
        console.error("Error updating repair payment:", error);
        return;
      }

      setRepairs((prev) =>
        prev.map((r) => {
          if (r.id === repairId) {
            return {
              ...r,
              amountPaid: newAmountPaid,
              balance,
              paymentStatus,
              status,
            };
          }
          return r;
        })
      );
    })();
  }, [repairs]);

  const confirmPayment = useCallback((repairId: string, _transactionCodes: any, _paymentMethod: string, _splitPayments?: any[]) => {
    (async () => {
      const repair = repairs.find((r) => r.id === repairId);
      if (!repair) return;

      const totalAmount = repair.totalAgreedAmount || repair.totalCost;
      const newAmountPaid = totalAmount; // Full payment
      const balance = 0;
      const paymentStatus = 'fully_paid';
      const status = 'FULLY_PAID';

      const { error } = await supabase
        .from("repairs")
        .update({
          amount_paid: newAmountPaid,
          balance: balance,
          payment_status: paymentStatus,
          status: status,
          payment_approved: true,
          pending_transaction_codes: null,
        })
        .eq("id", repairId);
      if (error) {
        console.error("Error confirming payment:", error);
        return;
      }

      setRepairs((prev) =>
        prev.map((r) => {
          if (r.id === repairId) {
            return {
              ...r,
              amountPaid: newAmountPaid,
              balance,
              paymentStatus,
              status,
              paymentApproved: true,
              pendingTransactionCodes: undefined,
            };
          }
          return r;
        })
      );
    })();
  }, [repairs]);

  const approvePayment = useCallback((repairId: string) => {
    (async () => {
      const repair = repairs.find((r) => r.id === repairId);
      if (!repair) return;

      const totalAmount = repair.totalAgreedAmount || repair.totalCost;
      const balance = totalAmount - repair.amountPaid;
      const paymentStatus = balance <= 0 ? 'fully_paid' : repair.amountPaid > 0 ? 'partial' : 'pending';
      const status = paymentStatus === 'fully_paid' ? 'FULLY_PAID' : 'PAYMENT_PENDING';

      const { error } = await supabase
        .from("repairs")
        .update({
          payment_approved: true,
          payment_status: paymentStatus,
          status: status,
          balance: balance,
        })
        .eq("id", repairId);
      if (error) {
        console.error("Error approving payment:", error);
        return;
      }

      setRepairs((prev) =>
        prev.map((r) => {
          if (r.id === repairId) {
            return {
              ...r,
              paymentApproved: true,
              paymentStatus,
              status,
              balance,
            };
          }
          return r;
        })
      );
    })();
  }, [repairs]);

  const confirmCollection = useCallback((repairId: string) => {
    (async () => {
      const { error } = await supabase
        .from("repairs")
        .update({ status: 'COLLECTED', collected: true })
        .eq("id", repairId);
      if (error) {
        console.error("Error confirming collection:", error);
        return;
      }
      setRepairs((prev) =>
        prev.map((repair) => {
          if (repair.id === repairId) {
            return {
              ...repair,
              status: 'COLLECTED' as RepairStatus,
              collected: true,
            };
          }
          return repair;
        })
      );
    })();
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

  const deleteRepair = useCallback((repairId: string) => {
    (async () => {
      // Delete related records first (cascade should handle this, but being explicit)
      await supabase.from("repair_parts").delete().eq("repair_id", repairId);
      await supabase.from("additional_repair_items").delete().eq("repair_id", repairId);
      
      // Delete the repair
      const { error } = await supabase.from("repairs").delete().eq("id", repairId);
      if (error) {
        console.error("Error deleting repair:", error);
        return;
      }
      
      setRepairs((prev) => prev.filter((repair) => repair.id !== repairId));
    })();
  }, []);

  return (
    <RepairContext.Provider
      value={{
        repairs,
        addRepair,
        updateRepairStatus,
        updateRepairPayment,
        confirmPayment,
        approvePayment,
        confirmCollection,
        deleteRepair,
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
