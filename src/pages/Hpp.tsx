import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../data/store";
import { Kpis, Seg } from "../components/ui";
import { dec, fmt, pctS, rp } from "../lib/format";
import { hppFor, marginOf } from "../lib/calc";
import { sortSizes } from "../lib/ginee";

export default function Hpp() {
  const { articles, materialById, rows, sales } = useStore();
  const [priceSrc, setPriceSrc] = useState<"master" | "ginee">("master");

  // Harga jual rata-rata yang benar-benar terjadi di Ginee (omzet efektif / qty efektif) per prefix × ukuran
  const real = useMemo(() => {
    const m = new Map<string, { rev: number; eff: number }>();
    rows.forEach(r => {
      for (const k of [r.prefix + "|" + r.size, r.prefix + "|*"]) {
        const g = m.get(k) || { rev: 0, eff: 0 }; g.rev += r.rev; g.eff += r.eff; m.set(k, g);
      }
    });
    return m;
  }, [rows]);
  const realPrice = (p: string, z: string) => { const g = real.get(p + "|" + z) || real.get(p + "|*"); return g && g.eff ? g.rev / g.eff : 0; };

  const table = articles.flatMap(a => {
    const m = a.material_id ? materialById.get(a.material_id) : undefined;
    const sizes = sortSizes(Object.keys(a.usage || {}));
    return (sizes.length ? sizes : ["-"]).map(z => {
      const h = hppFor(a, m, z);
      const price = priceSrc === "master" ? a.sell_price : realPrice(a.prefix, z);
      const qty = rows.filter(r => r.prefix === a.prefix && (z === "-" || r.size === z)).reduce((s, r) => s + r.eff, 0);
      return { a, m, z, h, price, mg: marginOf(price, h.total), qty };
    });
  });
  const withPrice = table.filter(t => t.price > 0);
  const sold = withPrice.filter(t => t.qty > 0);
  const wAvg = (f: (t: typeof table[number]) => number) => { const q = sold.reduce((s, t) => s + t.qty, 0); return q ? sold.reduce((s, t) => s + f(t) * t.qty, 0) / q : 0; };
  const low = withPrice.filter(t => t.mg.pct < 20);

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Biaya</div><h1>HPP &amp; Margin</h1>
          <div className="sub">HPP per pcs = bahan (yard × harga × (1 + sisa potong)) + ongkos jahit + aksesoris + biaya lain. Ubah komponennya di <Link to="/master/artikel">Master Artikel</Link> dan <Link to="/master/bahan">Master Bahan</Link>.</div></div>
      </div>
      <div className="toolbar">
        <div className="tb-group"><span className="tb-label">Harga jual pakai</span>
          <Seg value={priceSrc} onChange={setPriceSrc} options={[["master", "Harga di master"], ["ginee", "Rata-rata aktual Ginee"]]} />
        </div>
        {priceSrc === "ginee" && <span className="note">Dari omzet efektif ÷ qty efektif di {sales.file}{sales.isSample ? " (contoh)" : ""} — sudah termasuk diskon/voucher yang tercatat Ginee.</span>}
      </div>
      <Kpis items={[
        ["Artikel", fmt(articles.length), `${table.length} kombinasi ukuran`],
        ["HPP rata-rata", rp(wAvg(t => t.h.total)), "tertimbang qty terjual"],
        ["Margin rata-rata", pctS(wAvg(t => t.mg.pct)), "tertimbang qty terjual"],
        ["Margin < 20%", fmt(low.length), low.length ? "perlu dicek harganya" : "aman"],
      ]} />
      <div className="card"><div className="tbl-wrap">
        <table className="dt">
          <thead><tr><th>Artikel</th><th>Ukuran</th><th className="num">Yard/pcs</th><th className="num">Bahan</th><th className="num">Jahit</th><th className="num">Aksesoris</th><th className="num">Lain</th><th className="num">HPP</th><th className="num">Harga jual</th><th className="num">Margin</th><th className="num">%</th><th className="num">Terjual</th></tr></thead>
          <tbody>
            {table.map(({ a, m, z, h, price, mg, qty }) => (
              <tr key={a.id + z}>
                <td><b>{a.prefix}</b> {a.name}{!m && <div className="note cancel-hi">bahan belum dipilih</div>}</td><td>{z}</td>
                <td className="num">{h.usage ? dec(h.usage) : <span className="cancel-hi">?</span>}</td>
                <td className="num">{rp(h.material)}</td><td className="num">{rp(h.sewing)}</td><td className="num">{rp(h.accessory)}</td><td className="num">{rp(h.other)}</td>
                <td className="num"><b>{rp(h.total)}</b></td>
                <td className="num">{price ? rp(price) : "–"}</td>
                <td className="num">{price ? rp(mg.margin) : "–"}</td>
                <td className={"num" + (price && mg.pct < 20 ? " cancel-hi" : "")}>{price ? pctS(mg.pct) : "–"}</td>
                <td className="num">{qty ? fmt(qty) : "–"}</td>
              </tr>
            ))}
            {!table.length && <tr><td colSpan={12} className="empty">Belum ada artikel. <Link to="/master/artikel">Tambah artikel</Link>.</td></tr>}
          </tbody>
        </table>
      </div></div>
    </>
  );
}
