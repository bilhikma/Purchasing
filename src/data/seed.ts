// Data contoh untuk mode demo. Semua angka hanya ilustrasi — ganti dengan data Bilhikma yang sebenarnya.
import type { Tables, TableName } from "../lib/types";

export function demoSeed(): { [K in TableName]: Tables[K][] } {
  const now = new Date().toISOString();
  const d = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const all = (sizes: string[], v: number) => Object.fromEntries(sizes.map(s => [s, v]));
  return {
    profiles: [
      { id: "demo-owner", email: "owner@demo", name: "Owner (demo)", role: "owner", created_at: now },
      { id: "demo-purch", email: "purchasing@demo", name: "Admin Purchasing (demo)", role: "purchasing", created_at: now },
      { id: "demo-view", email: "viewer@demo", name: "Tim Gudang (demo)", role: "viewer", created_at: now },
    ],
    suppliers: [
      { id: "sup-kain", name: "Toko Kain Contoh", type: "bahan", contact: "Pak Budi", phone: "0812-0000-0001", address: "Cigondewah, Bandung", notes: null, created_at: now },
      { id: "sup-cmt", name: "Konveksi Contoh", type: "konveksi", contact: "Bu Sari", phone: "0812-0000-0002", address: "Bandung", notes: "CMT, kapasitas ±1.000 pcs/minggu", created_at: now },
      { id: "sup-acc", name: "Grosir Aksesoris Contoh", type: "aksesoris", contact: null, phone: null, address: null, notes: null, created_at: now },
    ],
    materials: [
      { id: "mat-twill", name: "Twill Stretch", supplier_id: "sup-kain", price_per_yard: 32000, roll_length: 100, width: "58\"", notes: null, created_at: now },
      { id: "mat-drill", name: "Drill Cotton", supplier_id: "sup-kain", price_per_yard: 28000, roll_length: 100, width: "58\"", notes: null, created_at: now },
    ],
    articles: [
      { id: "art-shk", prefix: "SHK", name: "Cargo Hakim", material_id: "mat-twill", usage: all(["XS", "S", "M", "L", "XL", "XXL"], 1.4),
        waste_pct: 3, sewing_cost: 25000, accessory_cost: 8000, other_cost: 2000, sell_price: 149000, notes: null, created_at: now },
      { id: "art-jrv", prefix: "JRV", name: "Cargo Jarvis", material_id: "mat-drill", usage: all(["S", "M", "L", "XL"], 1.4),
        waste_pct: 3, sewing_cost: 25000, accessory_cost: 7000, other_cost: 2000, sell_price: 149000, notes: null, created_at: now },
    ],
    purchase_orders: [
      { id: "po-demo-1", number: "PO-BHN-" + d(-6).slice(2, 4) + d(-6).slice(5, 7) + "-001", type: "bahan", supplier_id: "sup-kain", status: "dipesan",
        order_date: d(-6), due_date: d(2), notes: "Contoh PO bahan",
        items: [
          { description: "Twill Stretch — Black (Hakim01)", color: "Black (Hakim01)", qty: 300, unit: "yard", price: 32000, received: 0 },
          { description: "Twill Stretch — Grey (Hakim03)", color: "Grey (Hakim03)", qty: 200, unit: "yard", price: 32000, received: 0 },
        ],
        created_by: "demo-owner", created_at: now, updated_at: now },
    ],
  };
}
