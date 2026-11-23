import { useState } from "react";
import { backend } from "../data/backend";
import { useStore } from "../data/store";
import { Field, Icon, Modal } from "../components/ui";
import { fmt, num, rp } from "../lib/format";
import type { Material } from "../lib/types";

type Draft = Omit<Partial<Material>, "price_per_yard" | "roll_length"> & { price_per_yard?: string | number; roll_length?: string | number };

export default function Materials() {
  const { materials, suppliers, supplierById, articles, canEdit, reloadMaster, toast, ask } = useStore();
  const [edit, setEdit] = useState<Draft | null>(null);

  async function save() {
    if (!edit?.name?.trim()) return toast("Nama bahan wajib diisi");
    try {
      const { id, created_at: _c, ...rest } = edit;
      const row = { ...rest, supplier_id: rest.supplier_id || null, price_per_yard: num(rest.price_per_yard), roll_length: num(rest.roll_length) || 100 };
      if (id) await backend.update("materials", id, row); else await backend.insert("materials", row);
      setEdit(null); await reloadMaster(); toast("Bahan tersimpan");
    } catch (e) { toast((e as Error).message); }
  }
  async function del(m: Material) {
    const used = articles.filter(a => a.material_id === m.id).map(a => a.prefix);
    if (!await ask(`Hapus bahan "${m.name}"?${used.length ? ` Dipakai artikel: ${used.join(", ")}.` : ""}`)) return;
    try { await backend.remove("materials", m.id); await reloadMaster(); } catch (e) { toast((e as Error).message); }
  }
  const set = (k: keyof Draft, v: string) => setEdit(e => ({ ...e!, [k]: v }));

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Master Data</div><h1>Bahan</h1><div className="sub">Jenis kain beserta harga per yard dan isi per rol. Dipakai untuk menghitung HPP &amp; kebutuhan bahan restok.</div></div>
        {canEdit && <button className="btn primary" onClick={() => setEdit({ roll_length: 100, supplier_id: suppliers.find(s => s.type === "bahan")?.id || null })}><Icon name="plus" />Tambah bahan</button>}
      </div>
      <div className="card"><div className="tbl-wrap">
        <table className="dt">
          <thead><tr><th>Bahan</th><th>Supplier default</th><th className="num">Harga / yard</th><th className="num">Isi 1 rol</th><th className="num">Harga / rol</th><th>Dipakai artikel</th><th></th></tr></thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id}>
                <td><b>{m.name}</b>{m.width && <span className="muted"> · lebar {m.width}</span>}{m.notes && <div className="note">{m.notes}</div>}</td>
                <td>{(m.supplier_id && supplierById.get(m.supplier_id)?.name) || "–"}</td>
                <td className="num">{rp(m.price_per_yard)}</td><td className="num">{fmt(m.roll_length)} yard</td>
                <td className="num">{rp(m.price_per_yard * m.roll_length)}</td>
                <td>{articles.filter(a => a.material_id === m.id).map(a => a.prefix).join(", ") || "–"}</td>
                <td className="act">{canEdit && <><button className="btn sm" onClick={() => setEdit(m)}>Ubah</button> <button className="btn sm danger" onClick={() => del(m)}>Hapus</button></>}</td>
              </tr>
            ))}
            {!materials.length && <tr><td colSpan={7} className="empty">Belum ada bahan.</td></tr>}
          </tbody>
        </table>
      </div></div>
      {edit && (
        <Modal title={edit.id ? "Ubah bahan" : "Tambah bahan"} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" onClick={save}>Simpan</button></>}>
          <div className="form">
            <Field label="Nama bahan"><input value={edit.name || ""} onChange={e => set("name", e.target.value)} placeholder="mis. Twill Stretch" autoFocus /></Field>
            <Field label="Supplier default">
              <select value={edit.supplier_id || ""} onChange={e => set("supplier_id", e.target.value)}>
                <option value="">— belum ada —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Harga per yard (Rp)"><input inputMode="numeric" value={edit.price_per_yard ?? ""} onChange={e => set("price_per_yard", e.target.value)} placeholder="mis. 32000" /></Field>
            <Field label="Isi 1 rol (yard)"><input inputMode="decimal" value={edit.roll_length ?? ""} onChange={e => set("roll_length", e.target.value)} /></Field>
            <Field label="Lebar kain"><input value={edit.width || ""} onChange={e => set("width", e.target.value)} placeholder={'mis. 58"'} /></Field>
            <Field label="Catatan" full><textarea value={edit.notes || ""} onChange={e => set("notes", e.target.value)} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
