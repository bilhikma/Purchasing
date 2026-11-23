import { backend } from "../data/backend";
import { today } from "./format";
import type { PoItem, PoStatus, PoType, PurchaseOrder } from "./types";

export const PO_STATUS: [PoStatus, string][] = [["draft", "Draft"], ["dipesan", "Dipesan"], ["sebagian", "Diterima sebagian"], ["diterima", "Selesai diterima"], ["batal", "Batal"]];
export const statusLabel = (s: PoStatus) => PO_STATUS.find(x => x[0] === s)?.[1] || s;
export const typeLabel = (t: PoType) => (t === "bahan" ? "Bahan" : "Produksi");

/** Nomor PO: PO-BHN-2611-001 / PO-PRD-2611-001 (urut per jenis per bulan). */
export async function nextPoNumber(type: PoType) {
  const d = new Date();
  const prefix = `PO-${type === "bahan" ? "BHN" : "PRD"}-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-`;
  const all = await backend.list("purchase_orders");
  const max = all.filter(p => p.number.startsWith(prefix)).reduce((m, p) => Math.max(m, parseInt(p.number.slice(prefix.length)) || 0), 0);
  return prefix + String(max + 1).padStart(3, "0");
}

export async function createPo(type: PoType, supplier_id: string | null, items: PoItem[], notes = "", due_date: string | null = null): Promise<PurchaseOrder> {
  // Coba ulang bila nomor bentrok (dua orang membuat PO bersamaan)
  for (let i = 0; i < 3; i++) {
    const number = await nextPoNumber(type);
    try {
      return await backend.insert("purchase_orders", { number, type, supplier_id, status: "draft", order_date: today(), due_date, notes: notes || null, items });
    } catch (e) {
      if (i === 2 || !/duplicate|sudah dipakai|unique/i.test((e as Error).message)) throw e;
    }
  }
  throw new Error("Gagal membuat nomor PO");
}

/** Status otomatis berdasarkan barang yang sudah diterima. */
export function statusFromReceipt(items: PoItem[], current: PoStatus): PoStatus {
  if (current === "batal" || current === "draft") return current;
  const anyRecv = items.some(i => (i.received || 0) > 0);
  const allRecv = items.length > 0 && items.every(i => (i.received || 0) >= (i.qty || 0));
  return allRecv ? "diterima" : anyRecv ? "sebagian" : "dipesan";
}
