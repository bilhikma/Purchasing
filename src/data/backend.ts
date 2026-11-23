import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Role, TableName, Tables } from "../lib/types";
import { demoSeed } from "./seed";

export interface Backend {
  mode: "supabase" | "demo";
  currentUser(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<string>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;
  list<T extends TableName>(t: T): Promise<Tables[T][]>;
  insert<T extends TableName>(t: T, row: Partial<Tables[T]>): Promise<Tables[T]>;
  update<T extends TableName>(t: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>;
  remove(t: TableName, id: string): Promise<void>;
}

const ORDER: Record<TableName, string> = {
  suppliers: "name", materials: "name", articles: "prefix", purchase_orders: "created_at", profiles: "created_at",
};

// ---------------------------------------------------------------- Supabase
function supabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key);
  const check = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    mode: "supabase",
    async currentUser() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      return (p as Profile) || { id: data.user.id, email: data.user.email || "", name: data.user.email || "", role: "viewer" };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message);
    },
    async signUp(email, password, name) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw new Error(error.message);
      return data.session ? "" : "Akun dibuat. Cek email untuk konfirmasi, lalu masuk.";
    },
    async signOut() { await sb.auth.signOut(); },
    onAuthChange(cb) { const { data } = sb.auth.onAuthStateChange(() => cb()); return () => data.subscription.unsubscribe(); },
    async list(t) {
      return check(await sb.from(t).select("*").order(ORDER[t], { ascending: t !== "purchase_orders" })) as never;
    },
    async insert(t, row) { return check(await sb.from(t).insert(row as never).select().single()) as never; },
    async update(t, id, patch) { return check(await sb.from(t).update(patch as never).eq("id", id).select().single()) as never; },
    async remove(t, id) { check(await sb.from(t).delete().eq("id", id)); },
  };
}

// ---------------------------------------------------------------- Demo (localStorage)
const DB_KEY = "bilhikma-demo-db-v1", USER_KEY = "bilhikma-demo-user";
type DemoDb = { [K in TableName]: Tables[K][] };

function demoBackend(): Backend {
  let mem: DemoDb | null = null;
  const listeners = new Set<() => void>();
  const load = (): DemoDb => {
    if (mem) return mem;
    try { const s = localStorage.getItem(DB_KEY); if (s) mem = JSON.parse(s); } catch { /* storage diblokir */ }
    if (!mem) { mem = demoSeed(); save(); }
    return mem!;
  };
  const save = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(mem)); } catch { /* abaikan */ } };
  const getUserId = () => { try { return localStorage.getItem(USER_KEY); } catch { return sessionUser; } };
  let sessionUser: string | null = null;
  const setUserId = (id: string | null) => {
    sessionUser = id;
    try { if (id) localStorage.setItem(USER_KEY, id); else localStorage.removeItem(USER_KEY); } catch { /* abaikan */ }
    listeners.forEach(f => f());
  };
  const me = () => load().profiles.find(p => p.id === getUserId()) || null;
  const canWrite = (t: TableName) => {
    const r: Role | undefined = me()?.role;
    if (t === "profiles") return r === "owner";
    return r === "owner" || r === "purchasing";
  };
  const deny = () => { throw new Error("Peran Anda tidak punya izin untuk mengubah data ini."); };
  const sortRows = <T,>(t: TableName, rows: T[]) => {
    const k = ORDER[t] as keyof T, dir = t === "purchase_orders" ? -1 : 1;
    return [...rows].sort((a, b) => dir * String(a[k] ?? "").localeCompare(String(b[k] ?? "")));
  };
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

  return {
    mode: "demo",
    async currentUser() { return me(); },
    async signIn(email) {
      const p = load().profiles.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!p) throw new Error("Di mode demo, pilih salah satu akun demo.");
      setUserId(p.id);
    },
    async signUp() { throw new Error("Pendaftaran hanya tersedia setelah Supabase disambungkan."); },
    async signOut() { setUserId(null); },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async list(t) { return clone(sortRows(t, load()[t] as never[])) as never; },
    async insert(t, row) {
      if (!canWrite(t)) deny();
      const db = load();
      if (t === "articles" && (db.articles as { prefix: string }[]).some(a => a.prefix === (row as { prefix?: string }).prefix))
        throw new Error("Prefix SKU sudah dipakai artikel lain.");
      if (t === "purchase_orders" && db.purchase_orders.some(p => p.number === (row as { number?: string }).number))
        throw new Error("Nomor PO sudah dipakai.");
      const now = new Date().toISOString();
      const full = { id: crypto.randomUUID(), created_at: now, ...(t === "purchase_orders" ? { updated_at: now, created_by: getUserId() } : {}), ...row };
      (db[t] as unknown[]).push(full); save();
      return clone(full) as never;
    },
    async update(t, id, patch) {
      if (!canWrite(t)) deny();
      const rows = load()[t] as { id: string }[];
      const i = rows.findIndex(r => r.id === id);
      if (i < 0) throw new Error("Data tidak ditemukan.");
      rows[i] = { ...rows[i], ...patch }; save();
      if (t === "profiles") listeners.forEach(f => f());
      return clone(rows[i]) as never;
    },
    async remove(t, id) {
      if (!canWrite(t)) deny();
      const db = load();
      (db[t] as { id: string }[]) = (db[t] as { id: string }[]).filter(r => r.id !== id) as never;
      // perilaku "on delete set null" seperti di database
      if (t === "suppliers") { db.materials.forEach(m => { if (m.supplier_id === id) m.supplier_id = null; }); db.purchase_orders.forEach(p => { if (p.supplier_id === id) p.supplier_id = null; }); }
      if (t === "materials") db.articles.forEach(a => { if (a.material_id === id) a.material_id = null; });
      save();
    },
  };
}

export function resetDemo() { try { localStorage.removeItem(DB_KEY); } catch { /* abaikan */ } location.reload(); }

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const backend: Backend = URL_ && KEY_ ? supabaseBackend(URL_, KEY_) : demoBackend();
