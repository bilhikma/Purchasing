export const fmt = (n: number) => Math.round(n || 0).toLocaleString("id-ID");
export const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
export const rpShort = (n: number) =>
  n >= 1e9 ? "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M"
  : n >= 1e6 ? "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt"
  : rp(n);
export const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
export const pctS = (x: number) => x.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%";
export const yd = (v: number) => (v || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 });
export const dec = (v: number) => (v || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

/** Angka dari input bebas: "1,4" "45.000" "Rp 45.000" "1.234,5" → number. */
export function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes("."))
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(","))
    s = /,\d{3}$/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (d?: string | null) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "–";
