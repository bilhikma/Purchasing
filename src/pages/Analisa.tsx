import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useStore } from "../data/store";
import { Field, Icon, Kpis, Modal, Seg } from "../components/ui";
import { dec, fmt, num, pct, pctS, rp, rpShort, yd } from "../lib/format";
import { group, parseRows, sortSizes, sizeRank } from "../lib/ginee";
import { computeRestock, materialItemsFrom, materialNeeds, poTotal, prodItemsFrom, type ProdPriceBasis, type RestockLine, type RestockMode } from "../lib/calc";
import { createPo } from "../lib/po";
import { saveFile } from "../lib/env";
import type { SalesRow, Supplier } from "../lib/types";

type Metric = "eff" | "tot" | "rev";
const ADVICE = { A: "Perdalam stok", B: "Stok normal", C: "Stok tipis / tahan" };
const OPT_KEY = "bilhikma-restock-opts";
const STEPS = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6", "--seq-7"];

function loadOpts() {
  const d = { mode: "pct" as RestockMode, pct: "30", total: "500", skipC: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem(OPT_KEY) || "{}") }; } catch { return d; }
}

export default function Analisa() {
  const S = useStore();
  const { rows: allRows, sales, articleByPrefix, materialById, canEdit, toast } = S;
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  // ------- pilihan tampilan -------
  const products = useMemo(() => {
    const t = new Map<string, number>();
    allRows.forEach(r => t.set(r.product, (t.get(r.product) || 0) + r.eff));
    return [...t.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }, [allRows]);
  const [product, setProduct] = useState<string>("");
  const prod = products.includes(product) || product === "__ALL__" ? product : products[0] || "";
  const [metric, setMetric] = useState<Metric>("eff");
  const [series, setSeries] = useState("ALL");
  const [sort, setSort] = useState<{ key: string; dir: number }>({ key: "eff", dir: -1 });
  const [opts, setOpts] = useState(loadOpts);
  useEffect(() => { try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch { /* abaikan */ } }, [opts]);
  const [poModal, setPoModal] = useState<null | "produksi" | "bahan">(null);

  const prodRows = allRows.filter(r => prod === "__ALL__" || r.product === prod);
  const seriesList = [...new Set(prodRows.map(r => r.series).filter(Boolean))];
  const ser = seriesList.length > 1 && seriesList.includes(series) ? series : "ALL";
  const rows = prodRows.filter(r => ser === "ALL" || r.series === ser);

  const mval = (r: { eff: number; tot: number; rev: number }) => r[metric];
  const mlabel = { eff: "Qty efektif", tot: "Qty total", rev: "Omzet efektif" }[metric];
  const short = (v: number) => (metric === "rev" ? rpShort(v) : fmt(v));

  const T = rows.reduce((t, r) => ({ eff: t.eff + r.eff, tot: t.tot + r.tot, rev: t.rev + r.rev, cancel: t.cancel + r.cancel }), { eff: 0, tot: 0, rev: 0, cancel: 0 });
  const totalM = rows.reduce((s, r) => s + mval(r), 0);
  const colors = group(rows, "color").sort((a, b) => b[metric] - a[metric]);
  const sizes = group(rows, "size");
  const sizeNames = sortSizes(sizes.map(s => s.name));
  const sizeMap = new Map(sizes.map(s => [s.name, s]));
  const topColor = colors[0], topSize = [...sizes].sort((a, b) => b[metric] - a[metric])[0];

  // ------- restok & bahan -------
  const lines = computeRestock(rows, { mode: opts.mode, pct: num(opts.pct), total: num(opts.total), skipC: opts.skipC }, articleByPrefix, materialById);
  const needs = materialNeeds(lines);
  const act = lines.filter(l => l.qty > 0);
  const TQ = act.reduce((s, l) => s + l.qty, 0), TY = act.reduce((s, l) => s + l.yard, 0), TC = act.reduce((s, l) => s + l.cost, 0);
  const prefixes = [...new Set(rows.map(r => r.prefix))];
  const unknown = prefixes.filter(p => !articleByPrefix.has(p));
  const noMaterial = prefixes.filter(p => articleByPrefix.get(p) && !articleByPrefix.get(p)!.material_id);
  const noUse = [...new Set(act.filter(l => l.article && !(l.use > 0)).map(l => l.prefix + " " + l.size))];
  const qtyHead = opts.mode === "pct" ? `Restok +${num(opts.pct).toLocaleString("id-ID")}%` : "Alokasi total";

  // ------- upload -------
  async function handleFile(f?: File | null) {
    if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      let ok = false, err: unknown = null;
      for (const n of wb.SheetNames) {
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: "" });
        try { parseRows(aoa); S.setSales(aoa, f.name); ok = true; break; } catch (e) { err = e; }
      }
      if (!ok) throw err;
      setProduct(""); setSeries("ALL");
      toast("Data " + f.name + " dimuat");
    } catch (e) { toast((e as Error)?.message || "File tidak bisa dibaca"); }
  }
  useEffect(() => {
    let dc = 0;
    const enter = (e: DragEvent) => { e.preventDefault(); dc++; setDrag(true); };
    const leave = () => { dc--; if (dc <= 0) { dc = 0; setDrag(false); } };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => { e.preventDefault(); dc = 0; setDrag(false); handleFile(e.dataTransfer?.files[0]); };
    addEventListener("dragenter", enter); addEventListener("dragleave", leave); addEventListener("dragover", over); addEventListener("drop", drop);
    return () => { removeEventListener("dragenter", enter); removeEventListener("dragleave", leave); removeEventListener("dragover", over); removeEventListener("drop", drop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- kesimpulan -------
  const insights: string[] = [];
  if (rows.length) {
    const m = metric;
    let cum = 0; const core = [];
    for (const c of colors) { core.push(c); cum += c[m]; if (cum / totalM >= 0.8) break; }
    insights.push(`Warna <b>${colors[0].name}</b> paling laris (${pctS(pct(colors[0][m], totalM))}).${colors[1] ? ` Disusul <b>${colors[1].name}</b> (${pctS(pct(colors[1][m], totalM))})` : ""}${colors[2] ? ` dan <b>${colors[2].name}</b> (${pctS(pct(colors[2][m], totalM))})` : ""}.`);
    if (colors.length > 3) insights.push(`<b>${core.length} dari ${colors.length} warna</b> sudah menyumbang ±80% penjualan — fokuskan kedalaman stok di warna-warna ini.`);
    const ss = [...sizes].sort((a, b) => b[m] - a[m]);
    const top2 = ss.slice(0, 2);
    insights.push(`Ukuran <b>${top2.map(s => s.name).join(" & ")}</b> paling dicari (gabungan ${pctS(pct(top2.reduce((s, x) => s + x[m], 0), totalM))}). Gunakan porsi ukuran: ${sizeNames.map(n => `${n} ${pctS(pct(sizeMap.get(n)![m], totalM))}`).join(" · ")}.`);
    const low = ss.filter(s => pct(s[m], totalM) < 5);
    if (low.length) insights.push(`Ukuran <b>${low.map(s => s.name).join(", ")}</b> ${low.length > 1 ? "masing-masing " : ""}di bawah 5% — cukup stok tipis atau produksi sesuai pesanan.`);
    const top = [...rows].sort((a, b) => b[m] - a[m]).slice(0, 5);
    insights.push(`5 SKU teratas: ${top.map(r => `<b>${r.sku || r.variant}</b> (${short(r[m])})`).join(", ")}.`);
    const hiC = rows.filter(r => r.tot >= 10 && pct(r.cancel, r.tot) >= 20).sort((a, b) => pct(b.cancel, b.tot) - pct(a.cancel, a.tot));
    if (hiC.length) insights.push(`Perhatikan tingkat batal tinggi (≥20%) di ${hiC.slice(0, 4).map(r => `<b>${r.sku || r.variant}</b> (${pctS(pct(r.cancel, r.tot))})`).join(", ")} — cek apakah karena stok kosong saat order masuk.`);
    const cws = new Map<string, Set<string>>();
    rows.forEach(r => { const s = cws.get(r.color) || new Set(); s.add(r.size); cws.set(r.color, s); });
    const miss: string[] = [];
    cws.forEach((set, c) => {
      const ms = sizeNames.filter(s => !set.has(s) && pct(sizeMap.get(s)![m], totalM) >= 10);
      if (ms.length && pct(colors.find(x => x.name === c)![m], totalM) >= 10) miss.push(`${c} (${ms.join(", ")})`);
    });
    if (miss.length) insights.push(`Peluang: warna laris yang belum punya ukuran populer → ${miss.slice(0, 4).join("; ")}.`);
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  // nama warna/SKU berasal dari file yang diupload → di-escape sebelum disisipkan sebagai HTML
  const safeInsights = insights.map(h => h.replace(/<b>(.*?)<\/b>/g, (_, t) => `<b>${esc(t)}</b>`));

  // ------- heatmap -------
  const cell = new Map<string, { skus: string[]; eff: number; tot: number; rev: number; cancel: number }>();
  rows.forEach(r => { const k = r.color + "|" + r.size; const c = cell.get(k) || { skus: [], eff: 0, tot: 0, rev: 0, cancel: 0 }; c.skus.push(r.sku); c.eff += r.eff; c.tot += r.tot; c.rev += r.rev; c.cancel += r.cancel; cell.set(k, c); });
  const maxCell = Math.max(1, ...[...cell.values()].map(mval));
  const shade = (v: number) => { if (v <= 0) return { background: "var(--seq-0)", color: "var(--muted)" }; const i = Math.min(6, Math.floor((v / maxCell) * 6.999)); return { background: `var(${STEPS[i]})`, color: i >= 3 ? "#fff" : "var(--text)" }; };

  // ------- tooltip -------
  const tipRef = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]"), tip = tipRef.current!;
    if (!el) { tip.style.opacity = "0"; return; }
    tip.innerText = el.dataset.tip!; tip.style.opacity = "1";
    tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px";
    tip.style.top = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8) + "px";
  };
  const tipFor = (name: string, g: { eff: number; tot: number; rev: number; cancel: number }) =>
    `${name}\nQty efektif: ${fmt(g.eff)} pcs\nQty total: ${fmt(g.tot)} pcs\nOmzet: ${rp(g.rev)}\nBatal/gagal: ${fmt(g.cancel)} (${pctS(pct(g.cancel, g.tot))})`;

  // ------- tabel SKU -------
  const skuData = rows.map(r => ({ ...r, cr: pct(r.cancel, r.tot), share: pct(mval(r), totalM) }));
  skuData.sort((a, b) => {
    if (sort.key === "size") return sort.dir * (sizeRank(a.size) - sizeRank(b.size));
    const x = (a as Record<string, unknown>)[sort.key], y = (b as Record<string, unknown>)[sort.key];
    return typeof x === "string" ? sort.dir * x.localeCompare(String(y)) : sort.dir * ((x as number) - (y as number));
  });
  const sortBy = (k: string) => setSort(s => (s.key === k ? { key: k, dir: -s.dir } : { key: k, dir: ["sku", "color", "size"].includes(k) ? 1 : -1 }));

  const prodLabel = prod === "__ALL__" ? "Semua artikel di file" : prod;
  const nListing = new Set(prodRows.map(r => r.listing)).size;

  return (
    <div onMouseMove={onMove}>
      <header>
        <div>
          <div className="eyebrow">Analisa Sales per Varian · Ginee</div>
          <h1>{prodLabel || "—"}</h1>
          <div className="sub">Sumber: {sales.file}{sales.isSample ? " (contoh)" : ""} · {prodRows.length} SKU{nListing > 1 ? ` · gabungan ${nListing} listing` : ""}</div>
        </div>
        <div className="actions">
          <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" hidden onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" />Upload Data</button>
          <button className="btn" onClick={async () => { const r = await exportXlsx({ rows, lines, needs, prodLabel, file: sales.file, series: ser, insights, qtyHead }); if (r === "saved") toast("File Excel tersimpan"); else if (r === "unavailable") toast("Export tidak tersedia di tampilan ini"); }}><Icon name="download" />Export Excel</button>
        </div>
      </header>

      <div className="toolbar">
        {products.length > 1 && (
          <div className="tb-group"><span className="tb-label">Produk</span>
            <select value={prod} onChange={e => { setProduct(e.target.value); setSeries("ALL"); }}>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__ALL__">Semua artikel di file (gabungan)</option>
            </select>
          </div>
        )}
        <div className="tb-group"><span className="tb-label">Ukur pakai</span>
          <Seg value={metric} onChange={setMetric} options={[["eff", "Qty Efektif"], ["tot", "Qty Total"], ["rev", "Omzet"]]} />
        </div>
        {seriesList.length > 1 && (
          <div className="tb-group"><span className="tb-label">Seri</span>
            <Seg value={ser} onChange={setSeries} options={[["ALL", "Semua"], ...seriesList.map(s => [s, s] as [string, string])]} />
          </div>
        )}
      </div>

      {!rows.length ? <div className="card empty">Tidak ada data. Upload file export "Penjualan per Varian" dari Ginee.</div> : <>
        <Kpis items={[
          ["Qty terjual (efektif)", fmt(T.eff) + " pcs", `dari ${fmt(T.tot)} pcs dipesan`],
          ["Omzet efektif", rpShort(T.rev), `rata-rata ${rp(T.eff ? T.rev / T.eff : 0)}/pcs`],
          ["Warna terlaris", topColor?.name || "-", topColor ? pctS(pct(topColor[metric], totalM)) + " dari " + mlabel.toLowerCase() : ""],
          ["Ukuran terlaris", topSize?.name || "-", topSize ? pctS(pct(topSize[metric], totalM)) + " dari " + mlabel.toLowerCase() : ""],
          ["Pesanan batal/gagal", fmt(T.cancel), pctS(pct(T.cancel, T.tot)) + " dari total pesanan"],
        ]} />

        <div className="card insight">
          <h2>Kesimpulan untuk restok</h2>
          <div className="desc">Dihitung otomatis dari data yang sedang tampil.</div>
          <ul>{safeInsights.map((h, i) => <li key={i} dangerouslySetInnerHTML={{ __html: h }} />)}</ul>
        </div>

        <div className="grid2">
          <div className="card">
            <h2>Penjualan per Warna</h2>
            <div className="desc">Diurutkan dari paling laris · ukuran: {mlabel.toLowerCase()}</div>
            <div className="bars">{colors.map((c, i) => (
              <div key={c.name} className={"bar-row" + (i === 0 ? " top" : "")} data-tip={tipFor(c.name, c)}>
                <div className="lab">{c.name}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: (c[metric] / Math.max(1, colors[0][metric])) * 100 + "%" }} /></div>
                <div className="val"><b>{pctS(pct(c[metric], totalM))}</b> · {short(c[metric])}</div>
              </div>))}
            </div>
          </div>
          <div className="card">
            <h2>Penjualan per Ukuran</h2>
            <div className="desc">Urutan ukuran kecil → besar. Persentase = porsi ideal stok per ukuran.</div>
            <div className="bars">{sizeNames.map(n => { const s = sizeMap.get(n)!; const maxS = Math.max(1, ...sizes.map(x => x[metric])); return (
              <div key={n} className={"bar-row" + (s === topSize ? " top" : "")} style={{ gridTemplateColumns: "70px 1fr 92px" }} data-tip={tipFor("Ukuran " + n, s)}>
                <div className="lab">{n}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: (s[metric] / maxS) * 100 + "%" }} /></div>
                <div className="val"><b>{pctS(pct(s[metric], totalM))}</b> · {short(s[metric])}</div>
              </div>); })}
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Peta Warna × Ukuran</h2>
          <div className="desc">Semakin gelap kotaknya, semakin laris kombinasi itu. Kotak "–" = varian tidak ada.</div>
          <div className="tbl-wrap"><table className="heat"><tbody>
            <tr><th></th>{sizeNames.map(s => <th key={s}>{s}</th>)}<th>Total</th></tr>
            {colors.map(c => (
              <tr key={c.name}><th className="rowh">{c.name}</th>
                {sizeNames.map(s => { const r = cell.get(c.name + "|" + s); if (!r) return <td key={s} style={{ color: "var(--muted)" }}>–</td>; const v = mval(r);
                  return <td key={s} style={shade(v)} data-tip={`${c.name} · ${s}\nSKU: ${r.skus.join(", ")}\nQty efektif: ${fmt(r.eff)} pcs\nPorsi: ${pctS(pct(v, totalM))}\nBatal/gagal: ${fmt(r.cancel)}`}>{metric === "rev" ? (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "jt" : fmt(v)}</td>; })}
                <td className="tot">{short(c[metric])}</td></tr>))}
            <tr><th className="rowh">Total</th>{sizeNames.map(s => <td key={s} className="tot">{short(sizeMap.get(s)![metric])}</td>)}<td className="tot">{short(totalM)}</td></tr>
          </tbody></table></div>
          <div className="legend-seq">Sedikit {STEPS.map(s => <span key={s} className="sw" style={{ background: `var(${s})` }} />)} Banyak</div>
        </div>

        <div className="card">
          <div className="hstack" style={{ alignItems: "flex-start" }}>
            <div className="spacer"><h2>Rencana Restok</h2></div>
            {canEdit && <><button className="btn sm primary" disabled={!TQ} onClick={() => setPoModal("produksi")}><Icon name="po" />Buat PO Produksi</button>
              <button className="btn sm" disabled={!TQ} onClick={() => setPoModal("bahan")}><Icon name="roll" />Buat PO Bahan</button></>}
          </div>
          <div className="desc">Saran restok tiap SKU = qty efektif yang benar-benar terjual, dinaikkan sesuai persen (dibulatkan ke atas), atau "Bagi total pcs" untuk membagi jumlah tertentu sesuai porsi penjualan. Kelas A = SKU penyumbang 80% penjualan (perdalam stok), B = 15% berikutnya, C = 5% terbawah (stok tipis / tahan).</div>
          <div className="restock-ctrl">
            <Seg value={opts.mode} onChange={m => setOpts({ ...opts, mode: m })} options={[["pct", "+% dari qty terjual"], ["total", "Bagi total pcs"]]} />
            {opts.mode === "pct"
              ? <label>Naikkan <input type="text" inputMode="decimal" className="sm" value={opts.pct} onChange={e => setOpts({ ...opts, pct: e.target.value })} /> % dari qty efektif</label>
              : <label>Total restok <input type="number" min={0} step={10} value={opts.total} onChange={e => setOpts({ ...opts, total: e.target.value })} /> pcs</label>}
            <label><input type="checkbox" checked={opts.skipC} onChange={e => setOpts({ ...opts, skipC: e.target.checked })} /> Jangan alokasikan ke kelas C</label>
          </div>
          <div className="tbl-wrap scroll"><table className="dt">
            <thead><tr><th>SKU</th><th>Warna</th><th>Ukuran</th><th className="num">Qty efektif</th><th className="num">Porsi</th><th>Kelas</th><th className="num">{qtyHead}</th><th className="num">Bahan (yard)</th><th className="num">Biaya bahan</th><th className="num">HPP / pcs</th></tr></thead>
            <tbody>{lines.map(l => (
              <tr key={l.sku + l.color + l.size}>
                <td>{l.sku}</td><td>{l.color}{l.bundle && <> <span className="pill B" style={{ fontWeight: 600 }}>+ {l.bundle}</span></>}</td><td>{l.size}</td>
                <td className="num">{fmt(l.eff)}</td><td className="num">{pctS(l.share)}</td>
                <td><span className={"pill " + l.cls}>{l.cls} · {ADVICE[l.cls]}</span></td>
                <td className="num"><b>{fmt(l.qty)}</b> pcs</td>
                <td className="num">{l.qty && l.use ? yd(l.yard) : "–"}</td><td className="num">{l.cost ? rp(l.cost) : "–"}</td><td className="num">{l.hpp ? rp(l.hpp) : "–"}</td>
              </tr>))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="num">{fmt(lines.reduce((s, l) => s + l.eff, 0))}</td><td /><td /><td className="num">{fmt(TQ)} pcs</td><td className="num">{yd(TY)}</td><td className="num">{rp(TC)}</td><td /></tr></tfoot>
          </table></div>

          <div className="mat-head">
            <div><h3>Kebutuhan Bahan &amp; Biaya</h3>
              <div className="desc" style={{ margin: "2px 0 0" }}>Pemakaian bahan per ukuran, harga per yard, isi rol dan toleransi sisa potong diambil dari <Link to="/master/artikel">Master Artikel</Link> &amp; <Link to="/master/bahan">Master Bahan</Link>.</div></div>
          </div>
          <div className="tbl-wrap"><table className="dt">
            <thead><tr><th>Artikel</th><th>Bahan</th><th className="num">Harga / yard</th><th>Pemakaian (yard/pcs)</th><th className="num">Sisa potong</th><th></th></tr></thead>
            <tbody>{prefixes.map(p => { const a = articleByPrefix.get(p); const m = a?.material_id ? materialById.get(a.material_id) : undefined;
              const used = sortSizes([...new Set(rows.filter(r => r.prefix === p).map(r => r.size))]);
              return (
                <tr key={p || "-"}>
                  <td><b>{p || "(SKU tidak terbaca)"}</b> {a?.name}</td>
                  <td>{a ? (m?.name || <span className="cancel-hi">belum dipilih</span>) : "–"}</td>
                  <td className="num">{m ? rp(m.price_per_yard) : "–"}</td>
                  <td>{a ? used.map(z => <span key={z} style={{ marginRight: 8 }} className={num(a.usage[z]) > 0 ? "" : "cancel-hi"}>{z} {num(a.usage[z]) > 0 ? dec(a.usage[z]) : "?"}</span>) : "–"}</td>
                  <td className="num">{a ? pctS(a.waste_pct) : "–"}</td>
                  <td className="act">{p && (a ? <Link className="btn sm" to="/master/artikel">Atur</Link> : canEdit ? <button className="btn sm primary" onClick={() => nav("/master/artikel?baru=" + encodeURIComponent(p))}>Daftarkan artikel</button> : <span className="muted">belum terdaftar</span>)}</td>
                </tr>); })}
            </tbody>
          </table></div>
          {(unknown.length > 0 || noMaterial.length > 0 || noUse.length > 0) && (
            <div className="warnbox">⚠ {[
              unknown.length ? `Artikel belum terdaftar di master: ${unknown.map(u => u || "(tanpa SKU)").join(", ")}` : "",
              noMaterial.length ? `Bahan belum dipilih untuk: ${noMaterial.join(", ")}` : "",
              noUse.length ? `Pemakaian bahan belum diisi untuk: ${noUse.join(", ")}` : "",
            ].filter(Boolean).join(" · ")} — totalnya belum lengkap.</div>
          )}
          <div className="mkpis">
            {[
              ["Total bahan", yd(TY) + " yard", `≈ ${yd(TY * 0.9144)} meter · termasuk toleransi sisa potong`],
              ["Rol yang dibeli", fmt(needs.reduce((s, n) => s + n.rolls, 0)) + " rol", "dibulatkan ke atas per bahan × warna"],
              ["Total biaya bahan", rpShort(TC), rp(TC)],
              ["Biaya bahan / pcs", rp(TQ ? TC / TQ : 0), `rata-rata dari ${fmt(TQ)} pcs`],
              ["Estimasi biaya produksi", rpShort(act.reduce((s, l) => s + l.qty * l.hpp, 0)), "qty restok × HPP per pcs"],
            ].map(([k, v, s]) => <div className="mkpi" key={k}><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>)}
          </div>
          <div className="grid2" style={{ marginTop: 4 }}>
            <div><div className="tb-label" style={{ marginBottom: 6 }}>Belanja bahan per warna</div>
              <div className="tbl-wrap"><table className="dt">
                <thead><tr><th>Bahan · warna</th><th className="num">Pcs</th><th className="num">Butuh (yard)</th><th className="num">Rol</th><th className="num">Biaya</th></tr></thead>
                <tbody>{needs.map(n => (
                  <tr key={n.key}><td>{n.material?.name || "?"} · {n.color}</td><td className="num">{fmt(n.pcs)}</td><td className="num">{yd(n.yard)}</td>
                    <td className="num" data-tip={n.material ? `${yd(n.yard / n.material.roll_length)} rol → beli ${n.rolls} rol (${fmt(n.rolls * n.material.roll_length)} yard), sisa ±${yd(n.rolls * n.material.roll_length - n.yard)} yard` : undefined}><b>{n.material ? fmt(n.rolls) : "–"}</b></td>
                    <td className="num">{rp(n.cost)}</td></tr>))}
                </tbody>
              </table></div>
            </div>
            <div><div className="tb-label" style={{ marginBottom: 6 }}>Kebutuhan per ukuran</div>
              <div className="tbl-wrap"><table className="dt">
                <thead><tr><th>Ukuran</th><th className="num">Pcs</th><th className="num">Yard</th><th className="num">Biaya</th></tr></thead>
                <tbody>{sortSizes([...new Set(act.map(l => l.size))]).map(z => { const g = act.filter(l => l.size === z); return (
                  <tr key={z}><td>{z}</td><td className="num">{fmt(g.reduce((s, l) => s + l.qty, 0))}</td><td className="num">{yd(g.reduce((s, l) => s + l.yard, 0))}</td><td className="num">{rp(g.reduce((s, l) => s + l.cost, 0))}</td></tr>); })}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Detail per SKU</h2>
          <div className="desc">Klik judul kolom untuk mengurutkan.</div>
          <div className="tbl-wrap scroll"><table className="dt">
            <thead><tr>{([["sku", "SKU"], ["color", "Warna"], ["size", "Ukuran"], ["tot", "Qty total", 1], ["eff", "Qty efektif", 1], ["rev", "Omzet efektif", 1], ["cancel", "Batal/gagal", 1], ["cr", "% batal", 1], ["share", "Porsi", 1]] as [string, string, number?][]).map(([k, l, n]) =>
              <th key={k} className={n ? "num" : ""} onClick={() => sortBy(k)}>{l}{sort.key === k ? (sort.dir < 0 ? " ↓" : " ↑") : ""}</th>)}</tr></thead>
            <tbody>{skuData.map(r => (
              <tr key={r.sku + r.variant}><td>{r.sku}</td><td>{r.color}{r.bundle && <> <span className="pill B" style={{ fontWeight: 600 }}>+ {r.bundle}</span></>}</td><td>{r.size}</td>
                <td className="num">{fmt(r.tot)}</td><td className="num"><b>{fmt(r.eff)}</b></td><td className="num">{rp(r.rev)}</td><td className="num">{fmt(r.cancel)}</td>
                <td className={"num" + (r.cr >= 20 && r.tot >= 10 ? " cancel-hi" : "")}>{pctS(r.cr)}</td><td className="num">{pctS(r.share)}</td></tr>))}
            </tbody>
          </table></div>
          <p className="note">Qty Efektif = terjual dikurangi batal/gagal/refund. Data Ginee tidak memuat tanggal per transaksi, jadi analisa ini membandingkan varian dalam periode export yang sama.</p>
        </div>
      </>}

      <div id="tip" ref={tipRef} style={{ whiteSpace: "pre-line" }} />
      <div className="drop" style={{ display: drag ? "flex" : "none" }}>Lepas file Ginee di sini</div>
      {poModal && <PoFromRestock kind={poModal} lines={lines} prodLabel={prodLabel} onClose={() => setPoModal(null)} onDone={id => nav(id ? "/po/" + id : "/po")} />}
    </div>
  );
}

// ---------------------------------------------------------------- modal buat PO
function PoFromRestock({ kind, lines, prodLabel, onClose, onDone }: { kind: "produksi" | "bahan"; lines: RestockLine[]; prodLabel: string; onClose(): void; onDone(id: string): void }) {
  const { suppliers, toast } = useStore();
  const [basis, setBasis] = useState<ProdPriceBasis>("cmt");
  const [roundRoll, setRoundRoll] = useState(true);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = (type: Supplier["type"]) => [...suppliers].sort((a, b) => Number(b.type === type) - Number(a.type === type));
  const [prodSup, setProdSup] = useState(pick("konveksi")[0]?.id || "");

  // PO bahan: satu PO per supplier default bahan
  const needs = materialNeeds(lines);
  const bySup = new Map<string, typeof needs>();
  needs.forEach(n => { const k = n.material?.supplier_id || ""; bySup.set(k, [...(bySup.get(k) || []), n]); });
  const [supOverride, setSupOverride] = useState<Record<string, string>>({});
  const prodItems = prodItemsFrom(lines, basis);
  const noPrice = prodItems.filter(i => !i.price).length;

  async function create() {
    setBusy(true);
    try {
      const note = `Dari analisa restok: ${prodLabel}`;
      if (kind === "produksi") {
        const po = await createPo("produksi", prodSup || null, prodItems, note, due || null);
        toast("PO " + po.number + " dibuat"); onDone(po.id);
      } else {
        let last = "";
        for (const [k, ns] of bySup) {
          const po = await createPo("bahan", (supOverride[k] ?? k) || null, materialItemsFrom(ns, roundRoll), note, due || null);
          last = po.id;
        }
        toast(bySup.size > 1 ? `${bySup.size} PO bahan dibuat` : "PO bahan dibuat");
        onDone(bySup.size > 1 ? "" : last);
      }
    } catch (e) { toast((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title={kind === "produksi" ? "Buat PO Produksi ke konveksi" : "Buat PO Bahan"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn primary" disabled={busy} onClick={create}>Buat PO (draft)</button></>}>
      <div className="form">
        {kind === "produksi" ? <>
          <Field label="Konveksi / supplier">
            <select value={prodSup} onChange={e => setProdSup(e.target.value)}><option value="">— pilih nanti —</option>{pick("konveksi").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </Field>
          <Field label="Dasar harga per pcs" hint={basis === "cmt" ? "Bahan disediakan sendiri; konveksi dibayar ongkos jahit." : "Konveksi menyediakan bahan; harga = HPP penuh."}>
            <select value={basis} onChange={e => setBasis(e.target.value as ProdPriceBasis)}><option value="cmt">Ongkos jahit (CMT)</option><option value="fob">HPP penuh (FOB)</option></select>
          </Field>
        </> : (
          <Field label="Pembulatan" full>
            <select value={roundRoll ? "1" : "0"} onChange={e => setRoundRoll(e.target.value === "1")}><option value="1">Bulatkan ke rol penuh</option><option value="0">Sesuai kebutuhan (yard)</option></select>
          </Field>
        )}
        <Field label="Target selesai / datang"><input type="date" value={due} onChange={e => setDue(e.target.value)} /></Field>
      </div>
      {kind === "produksi" ? (
        <p className="sub" style={{ marginTop: 14 }}>{prodItems.length} SKU · {fmt(prodItems.reduce((s, i) => s + i.qty, 0))} pcs · total {rp(poTotal(prodItems))}
          {noPrice > 0 && <span className="cancel-hi"> · {noPrice} SKU belum punya harga (lengkapi Master Artikel atau isi manual di PO)</span>}</p>
      ) : (
        <div style={{ marginTop: 14 }}>
          {[...bySup].map(([k, ns]) => { const items = materialItemsFrom(ns, roundRoll); return (
            <div key={k} className="hstack" style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <select className="inp" style={{ width: 240 }} value={supOverride[k] ?? k} onChange={e => setSupOverride({ ...supOverride, [k]: e.target.value })}>
                <option value="">— pilih supplier —</option>{pick("bahan").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="sub">{items.length} baris · {yd(items.reduce((s, i) => s + i.qty, 0))} yard · {rp(poTotal(items))}</span>
            </div>); })}
          {!needs.length && <p className="empty">Belum ada kebutuhan bahan — lengkapi bahan &amp; pemakaian di Master Artikel.</p>}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- export Excel
async function exportXlsx(o: { rows: SalesRow[]; lines: RestockLine[]; needs: ReturnType<typeof materialNeeds>; prodLabel: string; file: string; series: string; insights: string[]; qtyHead: string }) {
  const { rows, lines, needs } = o;
  if (!rows.length) return "unavailable";
  const wb = XLSX.utils.book_new();
  const totEff = rows.reduce((s, r) => s + r.eff, 0), totTot = rows.reduce((s, r) => s + r.tot, 0), totRev = rows.reduce((s, r) => s + r.rev, 0);
  const colors = group(rows, "color").sort((a, b) => b.eff - a.eff);
  const sizes = group(rows, "size"); const sizeNames = sortSizes(sizes.map(s => s.name));
  const p1 = (v: number) => Math.round(v * 10) / 10, r2 = (v: number) => Math.round(v * 100) / 100;
  const strip = (h: string) => h.replace(/<[^>]+>/g, "");
  const add = (name: string, aoa: unknown[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  add("Ringkasan", [["Produk", o.prodLabel], ["Sumber data", o.file], ["Filter seri", o.series === "ALL" ? "Semua" : o.series], [], ["Qty total dipesan", totTot], ["Qty efektif", totEff], ["Omzet efektif (Rp)", totRev], ["Jumlah SKU", rows.length], [], ["Kesimpulan"], ...o.insights.map(i => [strip(i)])]);
  add("Per Warna", [["Warna", "Qty total", "Qty efektif", "% Qty efektif", "Omzet efektif (Rp)", "Batal/gagal"], ...colors.map(c => [c.name, c.tot, c.eff, p1(pct(c.eff, totEff)), c.rev, c.cancel])]);
  add("Per Ukuran", [["Ukuran", "Qty total", "Qty efektif", "% Qty efektif", "Omzet efektif (Rp)", "Batal/gagal"], ...sizeNames.map(n => { const s = sizes.find(x => x.name === n)!; return [n, s.tot, s.eff, p1(pct(s.eff, totEff)), s.rev, s.cancel]; })]);
  const cell = new Map<string, number>(); rows.forEach(r => { const k = r.color + "|" + r.size; cell.set(k, (cell.get(k) || 0) + r.eff); });
  add("Matriks Warna x Ukuran", [["Warna \\ Ukuran (qty efektif)", ...sizeNames, "Total"], ...colors.map(c => [c.name, ...sizeNames.map(s => cell.get(c.name + "|" + s) ?? ""), c.eff]), ["Total", ...sizeNames.map(n => sizes.find(x => x.name === n)!.eff), totEff]]);
  add("Rencana Restok", [["SKU", "Warna", "Ukuran", "Qty efektif", "% Porsi", "Kelas", "Saran", o.qtyHead + " (pcs)", "Pemakaian (yard/pcs)", "Bahan (yard)", "Harga/yard (Rp)", "Biaya bahan (Rp)", "HPP/pcs (Rp)"],
    ...lines.map(l => [l.sku, l.color, l.size, l.eff, p1(l.share), l.cls, ADVICE[l.cls], l.qty, l.use || "", r2(l.yard), l.price || "", Math.round(l.cost), Math.round(l.hpp) || ""]),
    ["Total", "", "", lines.reduce((s, l) => s + l.eff, 0), "", "", "", lines.reduce((s, l) => s + l.qty, 0), "", r2(lines.reduce((s, l) => s + l.yard, 0)), "", Math.round(lines.reduce((s, l) => s + l.cost, 0)), ""]]);
  add("Kebutuhan Bahan", [["Bahan", "Warna", "Pcs", "Butuh (yard)", "Isi rol (yard)", "Rol dibeli", "Harga/yard (Rp)", "Biaya bahan terpakai (Rp)"],
    ...needs.map(n => [n.material?.name || "?", n.color, n.pcs, r2(n.yard), n.material?.roll_length || "", n.rolls || "", n.material?.price_per_yard || "", Math.round(n.cost)])]);
  add("Detail SKU", [["SKU", "Nama Listing", "Nama Variasi", "Warna", "Ukuran", "Bundling", "Seri", "Qty total", "Qty efektif", "Omzet efektif (Rp)", "Batal/gagal", "% Batal", "Rata-rata harian"],
    ...rows.map(r => [r.sku, r.listing, r.variant, r.color, r.size, r.bundle ? "+ " + r.bundle : "", r.series, r.tot, r.eff, r.rev, r.cancel, p1(pct(r.cancel, r.tot)), r.daily])]);
  wb.SheetNames.forEach(n => {
    const ws = wb.Sheets[n]; const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }); const w: number[] = [];
    aoa.forEach(r => r.forEach((v, i) => { w[i] = Math.min(60, Math.max(w[i] || 8, String(v ?? "").length + 2)); }));
    ws["!cols"] = w.map(x => ({ wch: x }));
  });
  const safe = (o.prodLabel.replace(/^BILHIKMA\s*/i, "").replace(/[^\w\- ]+/g, "").trim().slice(0, 50) || "produk").replace(/\s+/g, "_");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return saveFile(`Analisa_Sales_${safe}.xlsx`, new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
