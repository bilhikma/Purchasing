import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { backend } from "../data/backend";
import { useStore } from "../data/store";
import { Kpis } from "../components/ui";
import { fmt, fmtDate, rp, rpShort, today } from "../lib/format";
import { poTotal } from "../lib/calc";
import { statusLabel, typeLabel } from "../lib/po";
import type { PurchaseOrder } from "../lib/types";

export default function Dashboard() {
  const { user, rows, sales, articles, materials, suppliers, articleByPrefix, toast } = useStore();
  const nav = useNavigate();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  useEffect(() => { backend.list("purchase_orders").then(setPos).catch(e => toast(e.message)); }, [toast]);

  const open = pos.filter(p => !["diterima", "batal"].includes(p.status));
  const late = open.filter(p => p.due_date && p.due_date < today());
  const month = today().slice(0, 7);
  const thisMonth = pos.filter(p => p.order_date.startsWith(month) && p.status !== "batal");
  const remaining = (p: PurchaseOrder) => p.items.reduce((s, i) => s + Math.max(0, i.qty - (i.received || 0)) * i.price, 0);

  const unknown = [...new Set(rows.map(r => r.prefix).filter(p => p && !articleByPrefix.has(p)))];
  const incomplete = articles.filter(a => !a.material_id || !Object.values(a.usage || {}).some(v => v > 0) || !a.sell_price);
  const todo: [string, string][] = [];
  if (!suppliers.length) todo.push(["Tambah supplier (toko kain & konveksi)", "/master/supplier"]);
  if (!materials.length) todo.push(["Tambah jenis bahan & harga per yard", "/master/bahan"]);
  if (unknown.length) todo.push([`Daftarkan artikel dari data penjualan: ${unknown.join(", ")}`, "/master/artikel"]);
  if (incomplete.length) todo.push([`Lengkapi bahan / pemakaian / harga jual: ${incomplete.map(a => a.prefix).join(", ")}`, "/master/artikel"]);
  if (sales.isSample) todo.push(["Upload export Ginee terbaru (sekarang masih data contoh)", "/analisa"]);

  const byProd = new Map<string, { eff: number; rev: number }>();
  rows.forEach(r => { const g = byProd.get(r.product) || { eff: 0, rev: 0 }; g.eff += r.eff; g.rev += r.rev; byProd.set(r.product, g); });

  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Bilhikma Purchasing</div><h1>Halo, {user?.name?.split(" ")[0]}</h1><div className="sub">Ringkasan pembelian dan restok.</div></div></div>
      <Kpis items={[
        ["PO berjalan", fmt(open.length), rpShort(open.reduce((s, p) => s + remaining(p), 0)) + " belum diterima"],
        ["PO lewat target", fmt(late.length), late.length ? "perlu ditindaklanjuti" : "semua sesuai jadwal"],
        ["Nilai PO bulan ini", rpShort(thisMonth.reduce((s, p) => s + poTotal(p.items), 0)), `${thisMonth.length} PO`],
        ["Qty terjual (data Ginee)", fmt(rows.reduce((s, r) => s + r.eff, 0)) + " pcs", sales.file + (sales.isSample ? " (contoh)" : "")],
      ]} />
      {todo.length > 0 && (
        <div className="card insight"><h2>Yang perlu dilengkapi</h2>
          <ul>{todo.map(([t, to]) => <li key={t}><Link to={to}>{t}</Link></li>)}</ul></div>
      )}
      <div className="grid2">
        <div className="card">
          <h2>PO berjalan</h2><div className="desc">Urut dari target paling dekat.</div>
          <div className="tbl-wrap"><table className="dt"><tbody>
            {[...open].sort((a, b) => (a.due_date || "9").localeCompare(b.due_date || "9")).slice(0, 8).map(p => (
              <tr key={p.id} className="row-link" onClick={() => nav("/po/" + p.id)}>
                <td><b>{p.number}</b><div className="note">{typeLabel(p.type)}</div></td>
                <td className={p.due_date && p.due_date < today() ? "cancel-hi" : ""}>{fmtDate(p.due_date)}</td>
                <td className="num">{rp(poTotal(p.items))}</td>
                <td><span className={"badge " + p.status}>{statusLabel(p.status)}</span></td>
              </tr>))}
            {!open.length && <tr><td className="empty">Tidak ada PO berjalan.</td></tr>}
          </tbody></table></div>
          <Link to="/po" className="note">Lihat semua PO →</Link>
        </div>
        <div className="card">
          <h2>Penjualan per artikel</h2><div className="desc">Dari data Ginee yang terakhir diupload.</div>
          <div className="tbl-wrap"><table className="dt">
            <thead><tr><th>Artikel</th><th className="num">Qty efektif</th><th className="num">Omzet</th></tr></thead>
            <tbody>{[...byProd].sort((a, b) => b[1].eff - a[1].eff).map(([p, g]) => (
              <tr key={p}><td>{p}</td><td className="num">{fmt(g.eff)}</td><td className="num">{rpShort(g.rev)}</td></tr>))}
            </tbody>
          </table></div>
          <Link to="/analisa" className="note">Buka analisa restok →</Link>
        </div>
      </div>
    </>
  );
}
