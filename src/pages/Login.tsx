import { useState, type FormEvent } from "react";
import { backend } from "../data/backend";
import { Field } from "../components/ui";

const DEMO = [
  ["owner@demo", "Owner", "semua akses, termasuk kelola pengguna"],
  ["purchasing@demo", "Admin Purchasing", "kelola master data & PO"],
  ["viewer@demo", "Tim Gudang (Viewer)", "hanya melihat"],
];

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [name, setName] = useState("");
  const [err, setErr] = useState(""), [info, setInfo] = useState(""), [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); setInfo(""); setBusy(true);
    try {
      if (mode === "in") await backend.signIn(email, pw);
      else { const m = await backend.signUp(email, pw, name); if (m) { setInfo(m); setMode("in"); } }
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <div className="card">
        <div className="eyebrow">Bilhikma</div>
        <h1 style={{ marginBottom: 14 }}>Purchasing &amp; Restok</h1>
        {backend.mode === "demo" ? (
          <>
            <p className="sub">Mode demo: pilih akun untuk mencoba tiap peran. Data tersimpan di browser ini saja.</p>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {DEMO.map(([e, n, d]) => (
                <button key={e} className="btn" style={{ justifyContent: "flex-start", textAlign: "left" }} onClick={() => backend.signIn(e, "").catch(x => setErr(x.message))}>
                  <span><b>{n}</b><br /><span className="muted" style={{ fontWeight: 500, fontSize: 12.5 }}>{d}</span></span>
                </button>
              ))}
            </div>
            {err && <p className="err">{err}</p>}
          </>
        ) : (
          <form onSubmit={submit} className="form" style={{ gridTemplateColumns: "1fr" }}>
            {mode === "up" && <Field label="Nama"><input value={name} onChange={e => setName(e.target.value)} required /></Field>}
            <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></Field>
            <Field label="Password" hint={mode === "up" ? "Minimal 6 karakter." : undefined}>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
            </Field>
            {err && <div className="err">{err}</div>}
            {info && <div className="okbox">{info}</div>}
            <button className="btn primary" disabled={busy} style={{ justifyContent: "center" }}>{mode === "in" ? "Masuk" : "Daftar"}</button>
            <p className="note" style={{ margin: 0 }}>
              {mode === "in" ? <>Belum punya akun? <a href="#" onClick={e => { e.preventDefault(); setMode("up"); }}>Daftar</a>. Akun baru berperan Viewer sampai dinaikkan Owner.</>
                : <>Sudah punya akun? <a href="#" onClick={e => { e.preventDefault(); setMode("in"); }}>Masuk</a>.</>}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
