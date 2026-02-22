import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
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
    supplierName?: string;
    source?: string;
  }>;
  additionalItems?: Array<{
    itemName: string;
    source: 'inventory' | 'outsourced';
    itemId?: number;
    supplierName?: string;
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
  addRepair: (repair: Omit<Repair, 'id' | 'date' | 'totalCost'> & { amountPaid?: number; balance?: number }) => Promise<string | null>;
  updateRepairStatus: (repairId: string, status: RepairStatus) => void;
  updateRepairPayment: (repairId: string, amountPaid: number) => void;
  confirmPayment: (repairId: string, transactionCodes: any, paymentMethod: string, splitPayments?: any[]) => void;
  approvePayment: (repairId: string) => void;
  confirmCollection: (repairId: string) => void;
  deleteRepair: (repairId: string) => void;
  updatePartCost: (repairId: string, itemName: string, costPerUnit: number, qty: number) => Promise<void>;
  getRepairsByStatus: (status: RepairStatus) => Repair[];
  getRepairsByShop: (shopId: string) => Repair[];
  getTotalRepairRevenue: () => number;
  getTotalOutsourcedCosts: () => number;
  getTotalLaborCosts: () => number;
};

const RepairContext = createContext<RepairContextType | null>(null);

export const RepairProvider = ({ children }: { children: React.ReactNode }) => {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const lastLocalUpdateRef = useRef<number>(0);
  const DEBOUNCE_MS = 3000;

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
        supplierName: p.supplier_name || undefined,
        source: p.source || undefined,
      })),
      additionalItems: (additionalData || []).map((a: any) => ({
        itemName: a.item_name,
        source: a.source as 'inventory' | 'outsourced',
        itemId: a.item_id || undefined,
        supplierName: a.supplier_name || undefined,
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

  const loadAllRepairs = useCallback(async (): Promise<Repair[]> => {
    const { data: repairsData, error: repairsError } = await supabase
      .from("repairs")
      .select("*")
      .order("date", { ascending: false });
    if (repairsError) throw repairsError;
    return Promise.all((repairsData || []).map(r => loadRepairWithDetails(r)));
  }, [loadRepairWithDetails]);

  // Load repairs from Supabase on mount, set up real-time subscription + polling
  useEffect(() => {
    let cancelled = false;
    
    // Initial load
    (async () => {
      try {
        const loaded = await loadAllRepairs();
        if (!cancelled) setRepairs(loaded);
      } catch (e) {
        console.error("Error loading repairs from Supabase:", e);
        if (!cancelled) setRepairs([]);
      }
    })();

    // Real-time subscription - skip reload if we just made a local update (prevents race condition)
    const channel = supabase
      .channel('repairs-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'repairs' },
        async () => {
          if (cancelled) return;
          const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
          if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
          
          try {
            const loaded = await loadAllRepairs();
            if (!cancelled) setRepairs(loaded);
          } catch (e) {
            console.error("Error reloading repairs:", e);
          }
        }
      )
      .subscribe((status) => {
        console.log("Repairs real-time subscription status:", status);
      });

    // Periodic polling every 15 seconds as fallback for when Realtime isn't enabled
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLocalUpdate < DEBOUNCE_MS) return;
      
      try {
        const loaded = await loadAllRepairs();
        if (!cancelled) setRepairs(loaded);
      } catch (e) {
        console.error("Error polling repairs:", e);
      }
    }, 15000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadAllRepairs]);

  const addRepair = useCallback(async (repairData: Omit<Repair, 'id' | 'date' | 'totalCost'> & { amountPaid?: number; balance?: number }): Promise<string | null> => {
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
        return null;
      }

      // Insert repair parts (try with supplier columns, fallback without)
      if (repairData.partsUsed.length > 0) {
        const partsWithSupplier = repairData.partsUsed.map((part) => ({
          repair_id: repairRecord.id,
          item_id: part.itemId || null,
          item_name: part.itemName,
          qty: part.qty,
          cost: part.cost,
          supplier_name: (part as any).supplierName || null,
          source: (part as any).source || 'in-house',
        }));
        const { error: partsError } = await supabase
          .from("repair_parts")
          .insert(partsWithSupplier);
        if (partsError) {
          // Fallback: columns may not exist yet, try without supplier fields
          const partsBasic = repairData.partsUsed.map((part) => ({
            repair_id: repairRecord.id,
            item_id: part.itemId || null,
            item_name: part.itemName,
            qty: part.qty,
            cost: part.cost,
          }));
          const { error: fallbackError } = await supabase
            .from("repair_parts")
            .insert(partsBasic);
          if (fallbackError) {
            console.error("Error adding repair parts:", fallbackError);
            return null;
          }
        }
      }

      // Insert additional items
      if (repairData.additionalItems && repairData.additionalItems.length > 0) {
        const additionalPayload = repairData.additionalItems.map((item) => ({
          repair_id: repairRecord.id,
          item_name: item.itemName,
          source: item.source,
          item_id: item.itemId || null,
          supplier_name: item.source === 'outsourced' ? ((item as any).supplierName || null) : null,
        }));
        const { error: additionalError } = await supabase
          .from("additional_repair_items")
          .insert(additionalPayload);
        if (additionalError) {
          console.error("Error adding additional repair items:", additionalError);
          return null;
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
        return null;
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
      
      lastLocalUpdateRef.current = Date.now();
      setRepairs((prev) => [newRepair, ...prev]);
      return repairRecord.id;
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
      lastLocalUpdateRef.current = Date.now();
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

      lastLocalUpdateRef.current = Date.now();
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
      const newAmountPaid = totalAmount;
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

      lastLocalUpdateRef.current = Date.now();
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

      lastLocalUpdateRef.current = Date.now();
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
      lastLocalUpdateRef.current = Date.now();
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
    return repairs.reduce((sum, repair) => {
      return sum + repair.partsUsed.reduce((s, p) => s + (p.cost * p.qty), 0);
    }, 0);
  }, [repairs]);

  const getTotalLaborCosts = useCallback(() => {
    return repairs.reduce((sum, repair) => sum + repair.laborCost, 0);
  }, [repairs]);

  const updatePartCost = useCallback(async (repairId: string, itemName: string, costPerUnit: number, qty: number): Promise<void> => {
    // Try to update existing repair_parts record
    const { data: existingParts } = await supabase
      .from("repair_parts")
      .select("*")
      .eq("repair_id", repairId)
      .eq("item_name", itemName);

    if (existingParts && existingParts.length > 0) {
      const { error } = await supabase
        .from("repair_parts")
        .update({ cost: costPerUnit })
        .eq("repair_id", repairId)
        .eq("item_name", itemName);
      if (error) {
        console.error("Error updating part cost:", error);
        return;
      }
    } else {
      // Insert new repair_parts record for outsourced additional items
      const { error } = await supabase
        .from("repair_parts")
        .insert({
          repair_id: repairId,
          item_name: itemName,
          qty: qty,
          cost: costPerUnit,
          item_id: null,
        });
      if (error) {
        console.error("Error inserting part cost:", error);
        return;
      }
    }

    // Update local state immediately
    lastLocalUpdateRef.current = Date.now();
    setRepairs((prev) =>
      prev.map((repair) => {
        if (repair.id !== repairId) return repair;

        const updatedParts = repair.partsUsed.map(p =>
          p.itemName === itemName ? { ...p, cost: costPerUnit } : p
        );

        // If item wasn't in partsUsed (was an additional outsourced item), add it
        const existsInParts = repair.partsUsed.some(p => p.itemName === itemName);
        if (!existsInParts) {
          updatedParts.push({ itemId: 0, itemName, qty, cost: costPerUnit });
        }

        // Remove from additionalItems since cost is now tracked in partsUsed
        const updatedAdditional = (repair.additionalItems || []).filter(
          a => !(a.itemName === itemName && a.source === 'outsourced')
        );

        return {
          ...repair,
          partsUsed: updatedParts,
          additionalItems: updatedAdditional,
        };
      })
    );
  }, []);

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
      
      lastLocalUpdateRef.current = Date.now();
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
        updatePartCost,
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
