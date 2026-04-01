/** Persist line type + inventory vs outsourced in repair_parts.source (single column). */

export type RepairLineKind = "spare_part" | "accessory" | "service";
export type PartInventorySource = "in-house" | "outsourced";

export type EncodedPartForDb = {
  lineKind: RepairLineKind;
  source: PartInventorySource;
};

/** Values stored in repair_parts.source */
export const REPAIR_PART_SOURCE = {
  spareInhouse: "spare_inhouse",
  spareOutsourced: "spare_outsourced",
  accessoryInhouse: "accessory_inhouse",
  accessoryOutsourced: "accessory_outsourced",
  service: "service",
} as const;

export function encodeRepairPartSource(p: EncodedPartForDb): string {
  if (p.lineKind === "service") return REPAIR_PART_SOURCE.service;
  if (p.lineKind === "accessory") {
    return p.source === "outsourced"
      ? REPAIR_PART_SOURCE.accessoryOutsourced
      : REPAIR_PART_SOURCE.accessoryInhouse;
  }
  return p.source === "outsourced"
    ? REPAIR_PART_SOURCE.spareOutsourced
    : REPAIR_PART_SOURCE.spareInhouse;
}

export function decodeRepairPartSource(
  raw: string | undefined | null
): EncodedPartForDb {
  const s = (raw || "").trim();
  if (s === REPAIR_PART_SOURCE.service) {
    return { lineKind: "service", source: "in-house" };
  }
  if (s === REPAIR_PART_SOURCE.accessoryInhouse) {
    return { lineKind: "accessory", source: "in-house" };
  }
  if (s === REPAIR_PART_SOURCE.accessoryOutsourced) {
    return { lineKind: "accessory", source: "outsourced" };
  }
  if (s === REPAIR_PART_SOURCE.spareInhouse) {
    return { lineKind: "spare_part", source: "in-house" };
  }
  if (s === REPAIR_PART_SOURCE.spareOutsourced) {
    return { lineKind: "spare_part", source: "outsourced" };
  }
  // Legacy rows
  if (s === "outsourced") return { lineKind: "spare_part", source: "outsourced" };
  if (s === "in-house" || s === "") return { lineKind: "spare_part", source: "in-house" };
  return { lineKind: "spare_part", source: "in-house" };
}

export function lineKindLabel(k: RepairLineKind): string {
  if (k === "spare_part") return "Spare part";
  if (k === "accessory") return "Accessory";
  return "Service";
}

export function sourceLabelForReceipt(
  lineKind: RepairLineKind,
  source: PartInventorySource
): string {
  if (lineKind === "service") return "Service (no part)";
  return source === "outsourced" ? "Outsourced" : "Our inventory";
}
