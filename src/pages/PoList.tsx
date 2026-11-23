import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "../data/backend";
import { useStore } from "../data/store";
import { Field, Icon, Modal, Seg } from "../components/ui";
import { fmtDate, pct, pctS, rp, today } from "../lib/format";
import { poTotal } from "../lib/calc";
import { createPo, PO_STATUS, statusLabel, typeLabel } from "../lib/po";
import type { PoStatus, PoType, PurchaseOrder } from "../lib/types";

export default function PoList() {
  const { supplierById, suppliers, canEdit, toast } = useStore();
  const nav = useNavigate();
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null);
  const [type, setType] = useState<"all" | PoType>("all");
  const [status, setStatus] = useState<"open" | "all" | PoStatus>("open");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<{ type: PoType; supplier_id: string } | null>(null);

  useEffect(() => { backend.list("purchase_orders").then(setPos).catch(e => toast(e.message)); }, [toast]);

  const shown = (pos || []).filter(p =>
    (type === "all" || p.type === type) &&
    (status === "all" || (status === "open" ? !["diterima", "batal"].includes(p.status) : p.status === status)) &&
    (!q || (p.number + " " + (supplierById.get(p.supplier_id || "")?.name || "") + " " + (p.notes || "")).toLowerCase().includes(q.toLowerCase())));

  async function create() {
    if (!creating) return;
    try { const po = await createPo(creating.type, creating.supplier_id || null, []); nav("/po/" + po.id); }
    catch (e) { toast((e as Error).message); }
  }

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Purchasing</div><h1>Purchase Order</h1><div className="sub">PO bahan ke toko kain dan PO produksi ke konveksi. Buat otomatis dari halaman Analisa Restok, atau manual di sini.</div></div>
        {canEdit && <button className="btn primary" onClick={() => setCreating({ type: "produksi", supplier_id: "" })}><Icon name="plus" />PO manual</button>}
      </div>
      <div className="toolbar">
        <div className="tb-group"><span className="tb-label">Jenis</span><Seg value={type} onChange={setType} options={[["all", "Semua"], ["bahan", "Bahan"], ["produksi", "Produksi"]]} /></div>
        <div className="tb-group"><span className="tb-label">Status</span>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
            <option value="open">Masih berjalan</option><option value="all">Semua</option>
            {PO_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="tb-group spacer"><input className="inp" placeholder="Cari nomor / supplier / catatan" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 320 }} /></div>
      </div>
      <div className="card"><div className="tbl-wrap">
        <table className="dt">
          <thead><tr><th>Nomor</th><th>Jenis</th><th>Supplier</th><th>Tanggal</th><th>Target</th><th className="num">Item</th><th className="num">Total</th><th className="num">Diterima</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map(p => {
              const qty = p.items.reduce((s, i) => s + i.qty, 0), rec = p.items.reduce((s, i) => s + Math.min(i.received || 0, i.qty), 0);
              const late = p.due_date && p.due_date < today() && !["diterima", "batal"].includes(p.status);
              return (
                <tr key={p.id} className="row-link" onClick={() => nav("/po/" + p.id)}>
                  <td><b>{p.number}</b></td><td>{typeLabel(p.type)}</td><td>{supplierById.get(p.supplier_id || "")?.name || <span className="muted">–</span>}</td>
                  <td>{fmtDate(p.order_date)}</td><td className={late ? "cancel-hi" : ""}>{fmtDate(p.due_date)}{late ? " (lewat)" : ""}</td>
                  <td className="num">{p.items.length}</td><td className="num">{rp(poTotal(p.items))}</td>
                  <td className="num">{qty ? pctS(pct(rec, qty)) : "–"}</td>
                  <td><span className={"badge " + p.status}>{statusLabel(p.status)}</span></td>
                </tr>
              );
            })}
            {pos && !shown.length && <tr><td colSpan={9} className="empty">Tidak ada PO.</td></tr>}
            {!pos && <tr><td colSpan={9} className="empty">Memuat…</td></tr>}
          </tbody>
        </table>
      </div></div>
      {creating && (
        <Modal title="PO manual" onClose={() => setCreating(null)} footer={<><button className="btn" onClick={() => setCreating(null)}>Batal</button><button className="btn primary" onClick={create}>Buat &amp; isi item</button></>}>
          <div className="form">
            <Field label="Jenis PO"><select value={creating.type} onChange={e => setCreating({ ...creating, type: e.target.value as PoType })}><option value="produksi">Produksi (ke konveksi)</option><option value="bahan">Bahan (ke toko kain)</option></select></Field>
            <Field label="Supplier"><select value={creating.supplier_id} onChange={e => setCreating({ ...creating, supplier_id: e.target.value })}><option value="">— pilih nanti —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
