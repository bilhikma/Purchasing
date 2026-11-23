import { useEffect, useState } from "react";
import { backend } from "../data/backend";
import { useStore } from "../data/store";
import type { Profile, Role } from "../lib/types";

const ROLES: [Role, string, string][] = [
  ["owner", "Owner", "Semua akses, termasuk mengatur peran pengguna"],
  ["purchasing", "Purchasing", "Mengelola master data dan PO"],
  ["viewer", "Viewer", "Hanya melihat (mis. tim gudang)"],
];

export default function Users() {
  const { isOwner, user, toast, ask } = useStore();
  const [list, setList] = useState<Profile[]>([]);
  useEffect(() => { backend.list("profiles").then(setList).catch(e => toast(e.message)); }, [toast]);
  if (!isOwner) return <div className="card empty">Halaman ini hanya untuk Owner.</div>;

  async function setRole(p: Profile, role: Role) {
    if (p.id === user?.id && role !== "owner" && !await ask("Anda akan melepas peran Owner sendiri. Lanjutkan?")) return;
    try { const u = await backend.update("profiles", p.id, { role }); setList(list.map(x => (x.id === p.id ? u : x))); toast("Peran diperbarui"); }
    catch (e) { toast((e as Error).message); }
  }

  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Admin</div><h1>Pengguna</h1>
        <div className="sub">{backend.mode === "demo" ? "Mode demo memakai 3 akun contoh." : "Anggota tim mendaftar sendiri lewat halaman masuk (perannya Viewer), lalu Owner menaikkan perannya di sini."}</div></div></div>
      <div className="card"><div className="tbl-wrap">
        <table className="dt">
          <thead><tr><th>Nama</th><th>Email</th><th>Peran</th></tr></thead>
          <tbody>{list.map(p => (
            <tr key={p.id}><td><b>{p.name}</b>{p.id === user?.id && <span className="muted"> (Anda)</span>}</td><td>{p.email}</td>
              <td><select value={p.role} onChange={e => setRole(p, e.target.value as Role)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td></tr>))}
          </tbody>
        </table>
      </div></div>
      <div className="card"><h2>Hak akses peran</h2>
        <ul>{ROLES.map(([, l, d]) => <li key={l}><b>{l}</b> — {d}</li>)}</ul>
      </div>
    </>
  );
}
