import { useState } from "react";
import { backend } from "../data/backend";
import { useStore } from "../data/store";
import { Field, Icon, Modal } from "../components/ui";
import type { Supplier, SupplierType } from "../lib/types";

export const SUPPLIER_TYPES: [SupplierType, string][] = [["bahan", "Toko bahan / kain"], ["konveksi", "Konveksi / penjahit"], ["aksesoris", "Aksesoris"], ["lainnya", "Lainnya"]];
const typeLabel = (t: string) => SUPPLIER_TYPES.find(x => x[0] === t)?.[1] || t;

export default function Suppliers() {
  const { suppliers, canEdit, reloadMaster, toast, materials, ask } = useStore();
  const [edit, setEdit] = useState<Partial<Supplier> | null>(null);

  async function save() {
    if (!edit?.name?.trim()) return toast("Nama supplier wajib diisi");
    try {
      const { id, created_at: _c, ...row } = edit;
      if (id) await backend.update("suppliers", id, row); else await backend.insert("suppliers", row);
      setEdit(null); await reloadMaster(); toast("Supplier tersimpan");
    } catch (e) { toast((e as Error).message); }
  }
  async function del(s: Supplier) {
    const used = materials.filter(m => m.supplier_id === s.id).length;
    if (!await ask(`Hapus supplier "${s.name}"?${used ? ` ${used} bahan akan kehilangan supplier default-nya.` : ""}`)) return;
    try { await backend.remove("suppliers", s.id); await reloadMaster(); } catch (e) { toast((e as Error).message); }
  }
  const set = (k: keyof Supplier, v: string) => setEdit(e => ({ ...e!, [k]: v }));

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Master Data</div><h1>Supplier</h1><div className="sub">Toko bahan, konveksi (CMT), dan pemasok aksesoris.</div></div>
        {canEdit && <button className="btn primary" onClick={() => setEdit({ type: "bahan" })}><Icon name="plus" />Tambah supplier</button>}
      </div>
      <div className="card"><div className="tbl-wrap">
        <table className="dt">
          <thead><tr><th>Nama</th><th>Jenis</th><th>Kontak</th><th>Telepon</th><th>Alamat</th><th></th></tr></thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id}>
                <td><b>{s.name}</b>{s.notes && <div className="note">{s.notes}</div>}</td>
                <td>{typeLabel(s.type)}</td><td>{s.contact || "–"}</td><td>{s.phone || "–"}</td><td>{s.address || "–"}</td>
                <td className="act">{canEdit && <><button className="btn sm" onClick={() => setEdit(s)}>Ubah</button> <button className="btn sm danger" onClick={() => del(s)}>Hapus</button></>}</td>
              </tr>
            ))}
            {!suppliers.length && <tr><td colSpan={6} className="empty">Belum ada supplier.</td></tr>}
          </tbody>
        </table>
      </div></div>
      {edit && (
        <Modal title={edit.id ? "Ubah supplier" : "Tambah supplier"} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" onClick={save}>Simpan</button></>}>
          <div className="form">
            <Field label="Nama"><input value={edit.name || ""} onChange={e => set("name", e.target.value)} autoFocus /></Field>
            <Field label="Jenis"><select value={edit.type} onChange={e => set("type", e.target.value)}>{SUPPLIER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Nama kontak"><input value={edit.contact || ""} onChange={e => set("contact", e.target.value)} /></Field>
            <Field label="Telepon / WA"><input value={edit.phone || ""} onChange={e => set("phone", e.target.value)} /></Field>
            <Field label="Alamat" full><input value={edit.address || ""} onChange={e => set("address", e.target.value)} /></Field>
            <Field label="Catatan" full><textarea value={edit.notes || ""} onChange={e => set("notes", e.target.value)} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
