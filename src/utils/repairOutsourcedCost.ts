import type { Repair } from "../context/RepairContext";

export type OutsourcedItemNeedingCost = {
  itemName: string;
  qty: number;
  source: "part" | "additional";
  currentCost: number;
  supplierName?: string;
};

/** Parts and additional lines that still need a per-unit cost so profit and reports are accurate. */
export function getOutsourcedItemsNeedingCostForRepair(repair: Repair): OutsourcedItemNeedingCost[] {
  const items: OutsourcedItemNeedingCost[] = [];

  repair.partsUsed
    .filter((p) => {
      const cost = p.cost ?? 0;
      const isOutsourced = (p as { source?: string }).source === "outsourced" || !!p.supplierName;
      return cost === 0 || cost === null || (isOutsourced && cost <= 0);
    })
    .forEach((part) => {
      items.push({
        itemName: part.itemName,
        qty: part.qty,
        source: "part",
        currentCost: Number(part.cost) || 0,
        supplierName: part.supplierName,
      });
    });

  if (repair.additionalItems) {
    repair.additionalItems
      .filter((item) => item.source === "outsourced")
      .forEach((item) => {
        const alreadyInParts = items.some((i) => i.itemName === item.itemName);
        const hasPartWithCost = repair.partsUsed.some(
          (p) => p.itemName === item.itemName && (Number(p.cost) || 0) > 0
        );
        if (!alreadyInParts && !hasPartWithCost) {
          items.push({
            itemName: item.itemName,
            qty: 1,
            source: "additional",
            currentCost: 0,
            supplierName: item.supplierName,
          });
        }
      });
  }

  return items;
}

export function repairNeedsOutsourcedCost(repair: Repair): boolean {
  return getOutsourcedItemsNeedingCostForRepair(repair).length > 0;
}
