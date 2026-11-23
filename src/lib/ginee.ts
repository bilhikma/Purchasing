// Parser export Ginee "Penjualan per Varian" — diporting dari artefak Analisa Restok.
import { num } from "./format";
import type { SalesRow } from "./types";

export const SIZE_ORDER = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL", "OVERSIZE", "JUMBO", "ALLSIZE"];

/** Nama artikel bawaan per prefix SKU; nama di Master Artikel selalu didahulukan. */
const DEFAULT_ARTICLE_NAMES: Record<string, string> = { SHK: "Cargo Hakim", JRV: "Cargo Jarvis", SH: "Sarcel Hamzah" };
const SIZE_CODES: Record<string, string> = { OVR: "OVERSIZE", OVS: "OVERSIZE", JMB: "JUMBO", AS: "ALLSIZE" };
const ARTICLES: [RegExp, string][] = [
  [/cargo\s*hakim|\bhakim\b/i, "Cargo Hakim"], [/jarvis/i, "Cargo Jarvis"], [/hamzah/i, "Sarcel Hamzah"],
  [/husein/i, "Koko Husein"], [/bukhori/i, "Peci Bukhori"], [/bilal/i, "Peci Bilal"], [/orion/i, "Celana Orion"],
];

export function sizeRank(s: string) {
  const u = s.toUpperCase().replace(/\s+/g, "");
  const i = SIZE_ORDER.indexOf(u);
  if (i >= 0) return i;
  const n = parseFloat(u);
  if (!isNaN(n)) return 100 + n;
  return 1000;
}
export const sortSizes = (arr: string[]) => arr.sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));

function normSize(raw: string) {
  const u = String(raw || "").trim().toUpperCase();
  if (!u) return "-";
  const tok = u.split(/[\s(\[]+/)[0].replace(/[^A-Z0-9]/g, "");
  if (SIZE_ORDER.includes(tok) || /^\d+$/.test(tok)) return tok;
  return u;
}

function splitVariant(v0: unknown) {
  const v = String(v0 || "").trim();
  let color = v, size = "-";
  let i = -1, d = 0;
  for (let k = 0; k < v.length; k++) {
    const ch = v[k];
    if (ch === "(" || ch === "[") d++;
    else if (ch === ")" || ch === "]") d = Math.max(0, d - 1);
    else if (ch === "," && d === 0) i = k;
  }
  if (i < 0) { const m = v.match(/^(.*?)[\s]*[-\/|][\s]*([^-\/|]+)$/); if (m) { color = m[1]; size = m[2]; } }
  else { color = v.slice(0, i); size = v.slice(i + 1); }
  color = color.trim() || "(Tanpa warna)";
  const sizeDetail = size.trim();
  size = normSize(sizeDetail);
  let bundle = "";
  const bm = color.match(/^(.*?)\s*\+\s*(.+)$/);
  if (bm && bm[1].trim()) { bundle = bm[2].trim(); color = bm[1].trim(); }
  color = color.replace(/\b([A-Za-z]+)-\1\b/gi, "$1").replace(/\b\w/g, c => c.toUpperCase());
  const sm = color.match(/\(([^)]+)\)/);
  const series = sm ? sm[1].replace(/[\d\s]+$/, "").trim().toUpperCase() : "";
  return { color, size, series, sizeDetail, bundle };
}

export function parseSku(sku: string) {
  const m = String(sku || "").trim().toUpperCase().match(/^([A-Z]+)[-_]?(\d+)[-_ ]+([A-Z0-9]+)$/);
  return m ? { prefix: m[1], code: m[2], size: SIZE_CODES[m[3]] || m[3] } : null;
}

function articleOf(name: string) {
  for (const [re, l] of ARTICLES) if (re.test(name)) return "BILHIKMA " + l;
  return name;
}

type Parsed = ReturnType<typeof parseSku> & { base?: string };

/** SKU = acuan utama: PREFIX + kode warna + "-" + ukuran (SHK01-L, SH04-OVR, SHP03-XL). */
function applySku(rows: SalesRow[], names: Record<string, string>) {
  const known = { ...DEFAULT_ARTICLE_NAMES, ...names };
  const ps = new Map<SalesRow, Parsed>();
  const prefixes = new Set<string>();
  rows.forEach(r => { const s = parseSku(r.sku); if (s) { ps.set(r, s); prefixes.add(s.prefix); } });
  rows.forEach(r => {
    const s = ps.get(r); if (!s) return;
    // prefix berakhiran P dengan induk yang ada (mis. SHP -> SH) = varian bundling
    const parent = s.prefix.slice(0, -1);
    if (!known[s.prefix] && s.prefix.endsWith("P") && (known[parent] || prefixes.has(parent))) { s.base = parent; if (!r.bundle) r.bundle = "Bundling"; }
    else s.base = s.prefix;
  });
  const colorNames = new Map<string, { n: string; bundle: boolean }>();
  rows.forEach(r => {
    const s = ps.get(r); if (!s) return;
    const k = s.base! + s.code, cur = colorNames.get(k);
    if (!cur || (cur.bundle && !r.bundle)) colorNames.set(k, { n: r.color, bundle: !!r.bundle });
  });
  const lst = new Map<string, string[]>();
  rows.forEach(r => { const s = ps.get(r); if (!s) return; const a = lst.get(s.base!) || []; if (!r.bundle) a.push(r.listing); lst.set(s.base!, a); });
  rows.forEach(r => { const s = ps.get(r); if (s && !lst.get(s.base!)!.length) lst.get(s.base!)!.push(r.listing); });
  const clean = (n: string) => {
    const t = String(n).replace(/^\s*BILHIKMA\s*[-–:|]*\s*/i, "").trim();
    return t.length > 55 ? t.slice(0, 55).replace(/\s+\S*$/, "") + "…" : t;
  };
  const artName = (b: string) => b + " · " + (known[b] || clean([...lst.get(b)!].sort((x, y) => x.length - y.length)[0] || ""));
  rows.forEach(r => {
    const s = ps.get(r); if (!s) return;
    const art = artName(s.base!);
    r.product = art; r.series = art; r.prefix = s.base!; r.colorCode = s.base! + s.code;
    r.color = colorNames.get(s.base! + s.code)!.n; r.size = s.size;
  });
  const byName = new Map<string, Set<string>>();
  rows.forEach(r => { if (!r.colorCode) return; const set = byName.get(r.color) || new Set(); set.add(r.colorCode); byName.set(r.color, set); });
  rows.forEach(r => { if (r.colorCode && byName.get(r.color)!.size > 1) r.color = r.color + " (" + r.colorCode + ")"; });
}

/** aoa = array-of-arrays dari sheet. names = {prefix: nama artikel} dari master. */
export function parseRows(aoa: unknown[][], names: Record<string, string> = {}): SalesRow[] {
  let h = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    if ((aoa[i] || []).some(c => /nama variasi/i.test(String(c || "")))) { h = i; break; }
  }
  if (h < 0) throw new Error("Kolom 'Nama Variasi' tidak ditemukan. Pastikan file adalah export Penjualan per Varian dari Ginee.");
  const head = aoa[h].map(c => String(c || "").trim().toLowerCase());
  const col = (...ns: string[]) => {
    for (const n of ns) { const i = head.findIndex(x => x === n); if (i >= 0) return i; }
    for (const n of ns) { const i = head.findIndex(x => x.includes(n)); if (i >= 0) return i; }
    return -1;
  };
  const C = {
    prod: col("nama master produk", "nama produk"), varn: col("nama variasi"), sku: col("msku", "sku"),
    tot: col("total penjualan produk"), eff: col("penjualan efektif produk"),
    rev: col("total penjualan"), revEff: col("jumlah penjualan efektif"),
    daily: col("rata-rata penjualan harian"), cancel: col("jumlah pesanan dibatalkan"),
    fail: col("jumlah pesanan gagal"), refund: col("jumlah pengembalian dana"),
  };
  if (C.eff < 0 && C.tot < 0) throw new Error("Kolom jumlah penjualan tidak ditemukan di file ini.");
  const out: SalesRow[] = [];
  for (let i = h + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const vn = r[C.varn];
    if (vn == null || String(vn).trim() === "") continue;
    const p = splitVariant(vn);
    const tot = C.tot >= 0 ? num(r[C.tot]) : num(r[C.eff]);
    const eff = C.eff >= 0 ? num(r[C.eff]) : tot;
    const revTot = C.rev >= 0 ? num(r[C.rev]) : 0;
    const revEff = C.revEff >= 0 ? num(r[C.revEff]) : revTot;
    const listing = String(C.prod >= 0 ? r[C.prod] || "Produk" : "Produk").replace(/\s+/g, " ").trim();
    out.push({
      product: articleOf(listing), prefix: "", listing, bundle: p.bundle, sizeDetail: p.sizeDetail, variant: String(vn).trim(),
      sku: C.sku >= 0 ? String(r[C.sku] || "") : "", color: p.color, size: p.size, series: p.series,
      tot, eff, rev: revEff, revTot, daily: C.daily >= 0 ? num(r[C.daily]) : 0,
      cancel: (C.cancel >= 0 ? num(r[C.cancel]) : 0) + (C.fail >= 0 ? num(r[C.fail]) : 0),
      refund: C.refund >= 0 ? num(r[C.refund]) : 0,
    });
  }
  if (!out.length) throw new Error("Tidak ada baris varian yang terbaca di file ini.");
  applySku(out, names);
  return out;
}

export interface Group { name: string; eff: number; tot: number; rev: number; cancel: number; n: number }
export function group(rows: SalesRow[], key: "color" | "size" | "product"): Group[] {
  const m = new Map<string, Group>();
  rows.forEach(r => {
    const g = m.get(r[key]) || { name: r[key], eff: 0, tot: 0, rev: 0, cancel: 0, n: 0 };
    g.eff += r.eff; g.tot += r.tot; g.rev += r.rev; g.cancel += r.cancel; g.n++;
    m.set(r[key], g);
  });
  return [...m.values()];
}

/** Kelas ABC: A = penyumbang 80% penjualan, B = 15% berikutnya, C = 5% terbawah. */
export function abc(rows: SalesRow[]) {
  const sorted = [...rows].sort((a, b) => b.eff - a.eff);
  const total = sorted.reduce((s, r) => s + r.eff, 0);
  let cum = 0;
  const cls = new Map<SalesRow, "A" | "B" | "C">();
  sorted.forEach(r => {
    const before = cum; cum += r.eff;
    cls.set(r, total === 0 ? "C" : before / total < 0.8 ? "A" : before / total < 0.95 ? "B" : "C");
  });
  return cls;
}
