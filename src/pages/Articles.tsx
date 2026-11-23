import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { backend } from "../data/backend";
import { useStore } from "../data/store";
import { Field, Icon, Modal } from "../components/ui";
import { dec, num, rp, pctS } from "../lib/format";
import { hppFor, marginOf } from "../lib/calc";
import { SIZE_ORDER, sortSizes } from "../lib/ginee";
import type { Article } from "../lib/types";

interface Draft {
  id?: string; prefix: string; name: string; material_id: string; notes: string;
  sizes: string[]; usage: Record<string, string>;
  waste_pct: string; sewing_cost: string; accessory_cost: string; other_cost: string; sell_price: string;
}
const s = (v: unknown) => (v == null || v === 0 ? "" : String(v).replace(".", ","));

function toDraft(a: Article): Draft {
  return {
    id: a.id, prefix: a.prefix, name: a.name, material_id: a.material_id || "", notes: a.notes || "",
    sizes: sortSizes(Object.keys(a.usage || {})), usage: Object.fromEntries(Object.entries(a.usage || {}).map(([k, v]) => [k, s(v)])),
    waste_pct: s(a.waste_pct), sewing_cost: s(a.sewing_cost), accessory_cost: s(a.accessory_cost), other_cost: s(a.other_cost), sell_price: s(a.sell_price),
  };
}
function fromDraft(d: Draft): Partial<Article> {
  return {
    prefix: d.prefix.trim().toUpperCase(), name: d.name.trim(), material_id: d.material_id || null, notes: d.notes || null,
    usage: Object.fromEntries(d.sizes.map(z => [z, num(d.usage[z])])),
    waste_pct: num(d.waste_pct), sewing_cost: num(d.sewing_cost), accessory_cost: num(d.accessory_cost), other_cost: num(d.other_cost), sell_price: num(d.sell_price),
  };
}

export default function Articles() {
  const { articles, materials, materialById, canEdit, reloadMaster, toast, rows } = useStore();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [newSize, setNewSize] = useState("");
  const [params, setParams] = useSearchParams();

  // Artikel yang muncul di data penjualan tapi belum ada di master
  const missing = useMemo(() => {
    const m = new Map<string, { prefix: string; name: string; sizes: Set<string>; eff: number; rev: number }>();
    rows.forEach(r => {
      if (!r.prefix || articles.some(a => a.prefix === r.prefix)) return;
      const g = m.get(r.prefix) || { prefix: r.prefix, name: r.product.split(" · ").slice(1).join(" · ") || r.product, sizes: new Set(), eff: 0, rev: 0 };
      g.sizes.add(r.size); g.eff += r.eff; g.rev += r.rev; m.set(r.prefix, g);
    });
    return [...m.values()];
  }, [rows, articles]);

  const blank = (prefix = "", name = "", sizes: string[] = ["S", "M", "L", "XL"], price = 0): Draft => ({
    prefix, name, material_id: "", notes: "", sizes: sortSizes([...sizes]), usage: {}, waste_pct: "3",
    sewing_cost: "", accessory_cost: "", other_cost: "", sell_price: price ? String(Math.round(price / 1000) * 1000) : "",
  });

  // ?baru=PREFIX dari halaman Analisa
  const want = params.get("baru");
  useEffect(() => {
    if (!want || !canEdit) return;
    const g = missing.find(x => x.prefix === want);
    setParams({}, { replace: true });
    setEdit(g ? blank(g.prefix, g.name, [...g.sizes], g.eff ? g.rev / g.eff : 0) : blank(want));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, canEdit]);

  async function save() {
    if (!edit) return;
    if (!edit.prefix.trim() || !edit.name.trim()) return toast("Prefix SKU dan nama artikel wajib diisi");
    try {
      const row = fromDraft(edit);
      if (edit.id) await backend.update("articles", edit.id, row); else await backend.insert("articles", row);
      setEdit(null); await reloadMaster(); toast("Artikel tersimpan");
    } catch (e) { toast((e as Error).message); }
  }
  async function del(a: Article) {
    if (!confirm(`Hapus artikel ${a.prefix} · ${a.name}?`)) return;
    try { await backend.remove("articles", a.id); await reloadMaster(); } catch (e) { toast((e as Error).message); }
  }
  const set = (k: keyof Draft, v: string) => setEdit(e => ({ ...e!, [k]: v }));
  const addSize = () => {
    const z = newSize.trim().toUpperCase(); if (!z || !edit || edit.sizes.includes(z)) return;
    setEdit({ ...edit, sizes: sortSizes([...edit.sizes, z]), usage: { ...edit.usage, [z]: edit.usage[edit.sizes[0]] || "" } });
    setNewSize("");
  };

  const preview = edit ? (() => { const a = { ...fromDraft(edit), id: "", usage: fromDraft(edit).usage! } as Article; const m = materialById.get(edit.material_id); return edit.sizes.map(z => ({ z, h: hppFor(a, m, z) })); })() : [];

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Master Data</div><h1>Artikel</h1><div className="sub">Satu artikel = satu prefix SKU (mis. SHK untuk SHK01-L). Isi pemakaian bahan per ukuran dan biaya produksi untuk HPP.</div></div>
        {canEdit && <button className="btn primary" onClick={() => setEdit(blank())}><Icon name="plus" />Tambah artikel</button>}
      </div>

      {canEdit && missing.length > 0 && (
        <div className="warnbox">
          Ada artikel di data penjualan yang belum terdaftar:{" "}
          {missing.map(g => <button key={g.prefix} className="btn sm" style={{ margin: "2px 4px" }} onClick={() => setEdit(blank(g.prefix, g.name, [...g.sizes], g.eff ? g.rev / g.eff : 0))}>+ {g.prefix} · {g.name}</button>)}
        </div>
      )}

      <div className="card"><div className="tbl-wrap">
        <table className="dt">
          <thead><tr><th>Prefix</th><th>Artikel</th><th>Bahan</th><th>Pemakaian (yard/pcs)</th><th className="num">Jahit</th><th className="num">Aksesoris + lain</th><th className="num">HPP (rata-rata)</th><th className="num">Harga jual</th><th className="num">Margin</th><th></th></tr></thead>
          <tbody>
            {articles.map(a => {
              const m = a.material_id ? materialById.get(a.material_id) : undefined;
              const sizes = sortSizes(Object.keys(a.usage || {}));
              const avg = sizes.length ? sizes.reduce((t, z) => t + hppFor(a, m, z).total, 0) / sizes.length : hppFor(a, m, "").total;
              const mg = marginOf(a.sell_price, avg);
              return (
                <tr key={a.id}>
                  <td><b>{a.prefix}</b></td><td>{a.name}</td><td>{m?.name || <span className="cancel-hi">belum diatur</span>}</td>
                  <td>{sizes.map(z => `${z} ${dec(a.usage[z])}`).join(" · ") || "–"}</td>
                  <td className="num">{rp(a.sewing_cost)}</td><td className="num">{rp(a.accessory_cost + a.other_cost)}</td>
                  <td className="num"><b>{rp(avg)}</b></td><td className="num">{a.sell_price ? rp(a.sell_price) : "–"}</td>
                  <td className={"num" + (a.sell_price && mg.pct < 20 ? " cancel-hi" : "")}>{a.sell_price ? pctS(mg.pct) : "–"}</td>
                  <td className="act">{canEdit && <><button className="btn sm" onClick={() => setEdit(toDraft(a))}>Ubah</button> <button className="btn sm danger" onClick={() => del(a)}>Hapus</button></>}</td>
                </tr>
              );
            })}
            {!articles.length && <tr><td colSpan={10} className="empty">Belum ada artikel.</td></tr>}
          </tbody>
        </table>
      </div></div>

      {edit && (
        <Modal wide title={edit.id ? `Ubah artikel ${edit.prefix}` : "Tambah artikel"} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" onClick={save}>Simpan</button></>}>
          <div className="form">
            <Field label="Prefix SKU" hint="Huruf di depan SKU, mis. SHK untuk SHK01-L"><input value={edit.prefix} onChange={e => set("prefix", e.target.value.toUpperCase())} autoFocus={!edit.id} /></Field>
            <Field label="Nama artikel"><input value={edit.name} onChange={e => set("name", e.target.value)} placeholder="mis. Cargo Hakim" /></Field>
            <Field label="Bahan utama">
              <select value={edit.material_id} onChange={e => set("material_id", e.target.value)}>
                <option value="">— pilih bahan —</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({rp(m.price_per_yard)}/yard)</option>)}
              </select>
            </Field>
            <Field label="Toleransi sisa potong (%)"><input inputMode="decimal" value={edit.waste_pct} onChange={e => set("waste_pct", e.target.value)} /></Field>
          </div>

          <div className="tb-label" style={{ margin: "16px 0 6px" }}>Pemakaian bahan per pcs (yard)</div>
          <div className="tbl-wrap"><table className="cfg"><tbody>
            <tr>{edit.sizes.map(z => <th key={z}>{z} <button className="btn sm ghost" style={{ padding: "0 4px" }} title="Hapus ukuran" onClick={() => setEdit({ ...edit, sizes: edit.sizes.filter(x => x !== z) })}>×</button></th>)}</tr>
            <tr>{edit.sizes.map(z => <td key={z}><input inputMode="decimal" placeholder="0,0" className={num(edit.usage[z]) > 0 ? "" : "missing"} value={edit.usage[z] || ""} onChange={e => setEdit({ ...edit, usage: { ...edit.usage, [z]: e.target.value } })} /></td>)}</tr>
          </tbody></table></div>
          <div className="hstack" style={{ marginTop: 8 }}>
            <input className="inp" style={{ width: 120 }} list="sizes" placeholder="Ukuran baru" value={newSize} onChange={e => setNewSize(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSize())} />
            <datalist id="sizes">{SIZE_ORDER.map(z => <option key={z} value={z} />)}</datalist>
            <button className="btn sm" onClick={addSize}>+ Ukuran</button>
            <button className="btn sm ghost" onClick={() => { const v = edit.usage[edit.sizes[0]] || ""; setEdit({ ...edit, usage: Object.fromEntries(edit.sizes.map(z => [z, v])) }); }}>Samakan semua dengan {edit.sizes[0] || "–"}</button>
          </div>

          <div className="form" style={{ marginTop: 16 }}>
            <Field label="Ongkos jahit / CMT per pcs (Rp)"><input inputMode="numeric" value={edit.sewing_cost} onChange={e => set("sewing_cost", e.target.value)} /></Field>
            <Field label="Aksesoris per pcs (Rp)" hint="Kancing, resleting, label, hangtag"><input inputMode="numeric" value={edit.accessory_cost} onChange={e => set("accessory_cost", e.target.value)} /></Field>
            <Field label="Biaya lain per pcs (Rp)" hint="Packing, ongkir bahan, dll"><input inputMode="numeric" value={edit.other_cost} onChange={e => set("other_cost", e.target.value)} /></Field>
            <Field label="Harga jual (Rp)"><input inputMode="numeric" value={edit.sell_price} onChange={e => set("sell_price", e.target.value)} /></Field>
            <Field label="Catatan" full><input value={edit.notes} onChange={e => set("notes", e.target.value)} /></Field>
          </div>

          {preview.length > 0 && (
            <>
              <div className="tb-label" style={{ margin: "16px 0 6px" }}>Pratinjau HPP per pcs</div>
              <div className="tbl-wrap"><table className="dt">
                <thead><tr><th>Ukuran</th><th className="num">Bahan</th><th className="num">Jahit</th><th className="num">Aksesoris + lain</th><th className="num">HPP</th><th className="num">Margin</th></tr></thead>
                <tbody>{preview.map(({ z, h }) => { const mg = marginOf(num(edit.sell_price), h.total); return (
                  <tr key={z}><td>{z}</td><td className="num">{rp(h.material)}</td><td className="num">{rp(h.sewing)}</td><td className="num">{rp(h.accessory + h.other)}</td><td className="num"><b>{rp(h.total)}</b></td>
                    <td className="num">{num(edit.sell_price) ? `${rp(mg.margin)} (${pctS(mg.pct)})` : "–"}</td></tr>); })}</tbody>
              </table></div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
