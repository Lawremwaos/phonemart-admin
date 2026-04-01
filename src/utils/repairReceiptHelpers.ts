import type { Repair } from "../context/RepairContext";

export function canMarkRepairCollected(repair: Repair): boolean {
  return (
    repair.status !== "COLLECTED" &&
    repair.paymentStatus === "fully_paid" &&
    repair.paymentApproved === true &&
    repair.balance === 0
  );
}

export function repairToReceiptState(repair: Repair) {
  return {
    id: repair.id,
    date: repair.date,
    shopId: repair.shopId,
    saleType: "repair" as const,
    items: [
      ...repair.partsUsed.map((p) => ({
        name: p.itemName,
        qty: p.qty,
        price: 0,
      })),
      ...(repair.additionalItems || []).map((item) => ({
        name: item.itemName,
        qty: 1,
        price: 0,
      })),
    ],
    total: repair.totalAgreedAmount || repair.totalCost,
    totalAgreedAmount: repair.totalAgreedAmount || repair.totalCost,
    paymentMethod: repair.pendingTransactionCodes?.paymentMethod || "unknown",
    paymentStatus: "paid" as const,
    amountPaid: repair.amountPaid,
    balance: 0,
    customerName: repair.customerName,
    customerPhone: repair.phoneNumber,
    phoneModel: repair.phoneModel,
    issue: repair.issue,
    technician: repair.technician,
    customerStatus: repair.customerStatus,
    paymentApproved: true,
    depositAmount: repair.depositAmount || 0,
    ticketNumber: repair.ticketNumber,
    serviceType: repair.serviceType,
  };
}
