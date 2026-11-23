import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { backend } from "../data/backend";
import { useStore } from "../data/store";
import { Field, Icon } from "../components/ui";
import { dec, fmt, fmtDate, num, rp } from "../lib/format";
import { poTotal } from "../lib/calc";
import { statusFromReceipt, statusLabel, typeLabel } from "../lib/po";
import type { PoItem, PoStatus, PurchaseOrder } from "../lib/types";

/** Item dalam bentuk teks supaya input angka gaya Indonesia ("1,5" / "45.000") bisa diketik bebas. */
type ItemDraft = Omit<PoItem, "qty" | "price" | "received"> & { qty: string; price: string; received: string };
const toDraft = (i: PoItem): ItemDraft => ({ ...i, qty: String(i.qty ?? "").replace(".", ","), price: String(i.price ?? ""), received: String(i.received ?? 0).replace(".", ",") });
const fromDraft = (i: ItemDraft): PoItem => ({ ...i, qty: num(i.qty), price: num(i.price), received: num(i.received) });

export default function PoDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { supplierById, suppliers, canEdit, toast, user } = useStore();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [head, setHead] = useState({ supplier_id: "", order_date: "", due_date: "", notes: "" });
  const [dirty, setDirty] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    backend.list("purchase_orders").then(all => {
      const p = all.find(x => x.id === id);
      if (!p) { setMissing(true); return; }
      setPo(p); setItems(p.items.map(toDraft));
      setHead({ supplier_id: p.supplier_id || "", order_date: p.order_date, due_date: p.due_date || "", notes: p.notes || "" });
    }).catch(e => toast(e.message));
  }, [id, toast]);

  if (missing) return <div className="card empty">PO tidak ditemukan. <Link to="/po">Kembali ke daftar PO</Link></div>;
  if (!po) return <div className="empty">Memuat…</div>;

  const editable = canEdit && po.status === "draft";
  const sup = supplierById.get(head.supplier_id);
  const parsed = items.map(fromDraft);
  const total = poTotal(parsed);

  async function persist(patch: Partial<PurchaseOrder>, msg = "PO tersimpan") {
    try {
      const saved = await backend.update("purchase_orders", po!.id, { ...patch, updated_at: new Date().toISOString() });
      setPo(saved); setItems(saved.items.map(toDraft)); setDirty(false); setReceiving(false); toast(msg);
    } catch (e) { toast((e as Error).message); }
  }
  const saveAll = (extra: Partial<PurchaseOrder> = {}, msg?: string) =>
    persist({ items: parsed, supplier_id: head.supplier_id || null, order_date: head.order_date, due_date: head.due_date || null, notes: head.notes || null, ...extra }, msg);

  async function setStatus(s: PoStatus) {
    if (s === "dipesan") {
      if (!head.supplier_id) return toast("Pilih supplier dulu");
      if (!parsed.length || parsed.some(i => !i.qty)) return toast("Lengkapi item dan qty dulu");
      return saveAll({ status: "dipesan" }, "PO ditandai sudah dipesan");
    }
    if (s === "batal" && !confirm("Batalkan PO ini?")) return;
    if (s === "draft" && !confirm("Kembalikan PO ke draft supaya bisa diubah?")) return;
    persist({ status: s }, "Status diperbarui");
  }
  async function saveReceipt() {
    const next = statusFromReceipt(parsed, po!.status);
    persist({ items: parsed, status: next }, "Penerimaan barang tersimpan");
  }
  async function del() {
    if (!confirm(`Hapus ${po!.number}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await backend.remove("purchase_orders", po!.id); toast("PO dihapus"); nav("/po"); } catch (e) { toast((e as Error).message); }
  }
  const setItem = (i: number, k: keyof ItemDraft, v: string) => { setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x))); setDirty(true); };
  const setH = (k: keyof typeof head, v: string) => { setHead({ ...head, [k]: v }); setDirty(true); };
  const unit = po.type === "bahan" ? "yard" : "pcs";

  return (
    <>
      <div className="print-only" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div><div style={{ fontSize: 22, fontWeight: 800 }}>BILHIKMA</div><div className="muted">Purchase Order {typeLabel(po.type)}</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 18, fontWeight: 800 }}>{po.number}</div><div>Tanggal: {fmtDate(head.order_date)}</div>{head.due_date && <div>Target: {fmtDate(head.due_date)}</div>}</div>
        </div>
        <div style={{ marginTop: 14 }}>Kepada: <b>{sup?.name || "—"}</b>{sup?.contact && <> · {sup.contact}</>}{sup?.phone && <> · {sup.phone}</>}{sup?.address && <div>{sup.address}</div>}</div>
      </div>

      <div className="page-head no-print">
        <div>
          <div className="eyebrow"><Link to="/po">Purchase Order</Link> · {typeLabel(po.type)}</div>
          <h1>{po.number} <span className={"badge " + po.status} style={{ verticalAlign: "middle" }}>{statusLabel(po.status)}</span></h1>
          <div className="sub">Dibuat {fmtDate(po.created_at?.slice(0, 10))}{po.updated_at && po.updated_at !== po.created_at ? ` · diubah ${fmtDate(po.updated_at.slice(0, 10))}` : ""}</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => print()}><Icon name="print" />Cetak / PDF</button>
          {sup?.phone && <a className="btn" target="_blank" rel="noreferrer" href={waLink(sup.phone, po, parsed, total)}>Kirim via WA</a>}
          {canEdit && po.status === "draft" && <>
            <button className="btn" disabled={!dirty} onClick={() => saveAll()}>Simpan</button>
            <button className="btn primary" onClick={() => setStatus("dipesan")}>Tandai sudah dipesan</button>
          </>}
          {canEdit && ["dipesan", "sebagian"].includes(po.status) && !receiving && <button className="btn primary" onClick={() => setReceiving(true)}>Terima barang</button>}
          {canEdit && receiving && <><button className="btn" onClick={() => { setItems(po.items.map(toDraft)); setReceiving(false); }}>Batal</button><button className="btn primary" onClick={saveReceipt}>Simpan penerimaan</button></>}
        </div>
      </div>

      <div className="card no-print">
        <div className="form">
          <Field label="Supplier">
            <select disabled={!editable} value={head.supplier_id} onChange={e => setH("supplier_id", e.target.value)}>
              <option value="">— pilih supplier —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Tanggal PO"><input type="date" disabled={!editable} value={head.order_date} onChange={e => setH("order_date", e.target.value)} /></Field>
          <Field label="Target selesai / datang"><input type="date" disabled={!editable} value={head.due_date} onChange={e => setH("due_date", e.target.value)} /></Field>
          <Field label="Catatan" full><textarea disabled={!editable} value={head.notes} onChange={e => setH("notes", e.target.value)} /></Field>
        </div>
      </div>
      {head.notes && <p className="print-only">Catatan: {head.notes}</p>}

      <div className="card">
        <div className="tbl-wrap"><table className="dt">
          <thead><tr><th>#</th>{po.type === "produksi" && <th>SKU</th>}<th>Deskripsi</th><th className="num">Qty</th><th>Satuan</th><th className="num">Harga</th><th className="num">Subtotal</th>{po.status !== "draft" && <th className="num">Diterima</th>}{editable && <th className="no-print" />}</tr></thead>
          <tbody>
            {items.map((it, i) => {
              const p = parsed[i];
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {po.type === "produksi" && <td>{editable ? <input className="cell-inp l" style={{ width: 110 }} value={it.sku || ""} onChange={e => setItem(i, "sku", e.target.value)} /> : it.sku}</td>}
                  <td>{editable ? <input className="cell-inp l" style={{ minWidth: 240 }} value={it.description} onChange={e => setItem(i, "description", e.target.value)} /> : it.description}</td>
                  <td className="num">{editable ? <input className="cell-inp" inputMode="decimal" value={it.qty} onChange={e => setItem(i, "qty", e.target.value)} /> : dec(p.qty)}</td>
                  <td>{editable ? <input className="cell-inp l" style={{ width: 70 }} value={it.unit} onChange={e => setItem(i, "unit", e.target.value)} /> : it.unit}</td>
                  <td className="num">{editable ? <input className="cell-inp" inputMode="numeric" value={it.price} onChange={e => setItem(i, "price", e.target.value)} /> : rp(p.price)}</td>
                  <td className="num">{rp(p.qty * p.price)}</td>
                  {po.status !== "draft" && <td className="num">{receiving
                    ? <input className="cell-inp" style={{ width: 90 }} inputMode="decimal" value={it.received} onChange={e => setItem(i, "received", e.target.value)} />
                    : <span className={p.received >= p.qty ? "" : p.received > 0 ? "cancel-hi" : "muted"}>{dec(p.received)} / {dec(p.qty)}</span>}</td>}
                  {editable && <td className="act no-print"><button className="btn sm ghost danger" title="Hapus baris" onClick={() => { setItems(items.filter((_, j) => j !== i)); setDirty(true); }}><Icon name="trash" /></button></td>}
                </tr>
              );
            })}
            {!items.length && <tr><td colSpan={9} className="empty">Belum ada item.</td></tr>}
          </tbody>
          <tfoot><tr>
            <td colSpan={po.type === "produksi" ? 3 : 2}>Total</td>
            <td className="num">{fmt(parsed.reduce((s, i) => s + i.qty, 0))}</td><td>{unit}</td><td />
            <td className="num">{rp(total)}</td>{po.status !== "draft" && <td />}{editable && <td className="no-print" />}
          </tr></tfoot>
        </table></div>
        {editable && <div className="hstack no-print" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => { setItems([...items, { description: "", qty: "", unit, price: "", received: "0" }]); setDirty(true); }}><Icon name="plus" />Tambah baris</button>
        </div>}
        {receiving && <div className="hstack no-print" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => setItems(items.map(x => ({ ...x, received: x.qty })))}>Isi semua = qty dipesan</button>
          <span className="note">Isi jumlah yang sudah diterima (kumulatif). Status berubah otomatis jadi "Diterima sebagian" atau "Selesai diterima".</span>
        </div>}
      </div>

      <div className="print-only" style={{ marginTop: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center", width: 200 }}>Dibuat oleh<br /><br /><br /><br />( {user?.name} )</div>
          <div style={{ textAlign: "center", width: 200 }}>Disetujui supplier<br /><br /><br /><br />( {sup?.contact || "............................"} )</div>
        </div>
      </div>

      {canEdit && <div className="hstack no-print" style={{ marginTop: 8 }}>
        {po.status === "dipesan" && <button className="btn sm" onClick={() => setStatus("draft")}>Kembalikan ke draft</button>}
        {!["diterima", "batal"].includes(po.status) && po.status !== "draft" && <button className="btn sm danger" onClick={() => setStatus("batal")}>Batalkan PO</button>}
        {po.status === "batal" && <button className="btn sm" onClick={() => setStatus("draft")}>Aktifkan lagi (draft)</button>}
        {["draft", "batal"].includes(po.status) && <button className="btn sm danger" onClick={del}>Hapus PO</button>}
      </div>}
    </>
  );
}

function waLink(phone: string, po: PurchaseOrder, items: PoItem[], total: number) {
  let n = phone.replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  const lines = [`*${po.number}* — PO ${typeLabel(po.type)} Bilhikma`, po.due_date ? `Target: ${fmtDate(po.due_date)}` : "", "",
    ...items.map((i, k) => `${k + 1}. ${i.sku ? i.sku + " · " : ""}${i.description}: ${dec(i.qty)} ${i.unit}${i.price ? ` @ ${rp(i.price)}` : ""}`),
    "", `Total: ${rp(total)}`, po.notes ? `Catatan: ${po.notes}` : ""].filter((x, i, a) => x || (a[i - 1] && i < a.length - 1));
  return `https://wa.me/${n}?text=${encodeURIComponent(lines.join("\n"))}`;
}
