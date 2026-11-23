import { abc } from "./ginee";
import type { Article, Material, PoItem, SalesRow } from "./types";

// ---------------- HPP ----------------
export interface Hpp { usage: number; material: number; sewing: number; accessory: number; other: number; total: number }

/** HPP per pcs untuk satu ukuran: bahan (yard × harga × (1+sisa potong)) + jahit + aksesoris + lain-lain. */
export function hppFor(a: Article, m: Material | undefined, size: string): Hpp {
  const usage = Number(a.usage?.[size] ?? 0);
  const material = usage * (m?.price_per_yard || 0) * (1 + (a.waste_pct || 0) / 100);
  const sewing = a.sewing_cost || 0, accessory = a.accessory_cost || 0, other = a.other_cost || 0;
  return { usage, material, sewing, accessory, other, total: material + sewing + accessory + other };
}

export function marginOf(price: number, hpp: number) {
  const m = price - hpp;
  return { margin: m, pct: price ? (m / price) * 100 : 0 };
}

// ---------------- Rencana restok ----------------
export type RestockMode = "pct" | "total";
export interface RestockOpts { mode: RestockMode; pct: number; total: number; skipC: boolean }

export interface RestockLine {
  row: SalesRow; sku: string; prefix: string; color: string; size: string; bundle: string;
  eff: number; share: number; cls: "A" | "B" | "C"; qty: number;
  article?: Article; material?: Material; use: number; price: number; yard: number; cost: number; hpp: number;
}

export function computeRestock(
  rows: SalesRow[], o: RestockOpts,
  articleByPrefix: Map<string, Article>, materialById: Map<string, Material>,
): RestockLine[] {
  const cls = abc(rows);
  const elig = rows.filter(r => !(o.skipC && cls.get(r) === "C"));
  const base = elig.reduce((s, r) => s + r.eff, 0);
  const alloc = new Map<SalesRow, number>();
  if (o.mode === "pct") {
    const f = 1 + Math.max(0, o.pct) / 100;
    elig.forEach(r => alloc.set(r, Math.ceil(r.eff * f - 1e-9)));
  } else if (base > 0) {
    const Q = Math.max(0, Math.round(o.total));
    const raw = elig.map(r => ({ r, x: (Q * r.eff) / base, f: 0 }));
    let used = 0;
    raw.forEach(x => { x.f = Math.floor(x.x); used += x.f; });
    raw.sort((a, b) => b.x - b.f - (a.x - a.f));
    for (let i = 0; i < Q - used && i < raw.length; i++) raw[i].f++;
    raw.forEach(x => alloc.set(x.r, x.f));
  }
  const totalEff = rows.reduce((s, x) => s + x.eff, 0);
  return [...rows].sort((a, b) => b.eff - a.eff).map(r => {
    const qty = alloc.get(r) || 0;
    const article = articleByPrefix.get(r.prefix);
    const material = article?.material_id ? materialById.get(article.material_id) : undefined;
    const h = article ? hppFor(article, material, r.size) : undefined;
    const use = h?.usage || 0, price = material?.price_per_yard || 0;
    const yard = qty * use * (1 + (article?.waste_pct || 0) / 100);
    return {
      row: r, sku: r.sku, prefix: r.prefix, color: r.color, size: r.size, bundle: r.bundle,
      eff: r.eff, share: totalEff ? (r.eff / totalEff) * 100 : 0, cls: cls.get(r)!, qty,
      article, material, use, price, yard, cost: yard * price, hpp: h?.total || 0,
    };
  });
}

export interface MaterialNeed { key: string; material?: Material; color: string; pcs: number; yard: number; cost: number; rolls: number }

/** Kebutuhan bahan dikelompokkan per (jenis bahan × warna); rol dibulatkan ke atas per kelompok. */
export function materialNeeds(lines: RestockLine[]): MaterialNeed[] {
  const m = new Map<string, MaterialNeed>();
  lines.filter(l => l.qty > 0).forEach(l => {
    const key = (l.material?.id || "?") + "|" + l.color;
    const g = m.get(key) || { key, material: l.material, color: l.color, pcs: 0, yard: 0, cost: 0, rolls: 0 };
    g.pcs += l.qty; g.yard += l.yard; g.cost += l.cost;
    m.set(key, g);
  });
  return [...m.values()].map(g => {
    const rl = g.material?.roll_length || 0;
    return { ...g, rolls: rl ? Math.ceil(g.yard / rl - 1e-9) : 0 };
  }).sort((a, b) => b.yard - a.yard);
}

// ---------------- PO dari rencana restok ----------------
export type ProdPriceBasis = "cmt" | "fob";

export function prodItemsFrom(lines: RestockLine[], basis: ProdPriceBasis): PoItem[] {
  return lines.filter(l => l.qty > 0).map(l => {
    const a = l.article;
    const price = !a ? 0 : basis === "cmt" ? (a.sewing_cost || 0) : l.hpp;
    return {
      sku: l.sku, description: (a?.name || l.row.product) + " — " + l.color + " / " + l.size,
      color: l.color, size: l.size, qty: l.qty, unit: "pcs", price: Math.round(price), received: 0,
    };
  });
}

export function materialItemsFrom(needs: MaterialNeed[], roundToRoll: boolean): PoItem[] {
  return needs.map(n => {
    const rl = n.material?.roll_length || 0;
    const qty = roundToRoll && rl ? n.rolls * rl : Math.ceil(n.yard * 10) / 10;
    return {
      description: (n.material?.name || "Bahan (belum diatur)") + " — " + n.color,
      color: n.color, qty, unit: "yard", price: n.material?.price_per_yard || 0, received: 0,
    };
  });
}

export const poTotal = (items: PoItem[]) => items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
