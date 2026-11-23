export type Role = "owner" | "purchasing" | "viewer";

export interface Profile { id: string; email: string; name: string; role: Role; created_at?: string }

export type SupplierType = "bahan" | "konveksi" | "aksesoris" | "lainnya";
export interface Supplier {
  id: string; name: string; type: SupplierType;
  contact?: string | null; phone?: string | null; address?: string | null; notes?: string | null;
  created_at?: string;
}

export interface Material {
  id: string; name: string; supplier_id: string | null;
  price_per_yard: number; roll_length: number;
  width?: string | null; notes?: string | null; created_at?: string;
}

export interface Article {
  id: string; prefix: string; name: string; material_id: string | null;
  usage: Record<string, number>;
  waste_pct: number; sewing_cost: number; accessory_cost: number; other_cost: number;
  sell_price: number; notes?: string | null; created_at?: string;
}

export type PoType = "bahan" | "produksi";
export type PoStatus = "draft" | "dipesan" | "sebagian" | "diterima" | "batal";
export interface PoItem {
  sku?: string; description: string; color?: string; size?: string;
  qty: number; unit: string; price: number; received: number;
}
export interface PurchaseOrder {
  id: string; number: string; type: PoType; supplier_id: string | null; status: PoStatus;
  order_date: string; due_date: string | null; notes: string | null; items: PoItem[];
  created_by?: string | null; created_at?: string; updated_at?: string;
}

export interface Tables {
  suppliers: Supplier; materials: Material; articles: Article; purchase_orders: PurchaseOrder; profiles: Profile;
}
export type TableName = keyof Tables;

/** Satu baris varian hasil export Ginee "Penjualan per Varian". */
export interface SalesRow {
  product: string; prefix: string; listing: string; bundle: string; sizeDetail: string; variant: string; sku: string;
  color: string; colorCode?: string; size: string; series: string;
  tot: number; eff: number; rev: number; revTot: number; daily: number; cancel: number; refund: number;
}
