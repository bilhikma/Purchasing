import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { backend } from "./backend";
import { parseRows } from "../lib/ginee";
import { SAMPLE, SAMPLE_NAME } from "../lib/sample";
import type { Article, Material, Profile, SalesRow, Supplier } from "../lib/types";

interface Sales { raw: unknown[][]; file: string; isSample: boolean }

interface Store {
  user: Profile | null; authReady: boolean; canEdit: boolean; isOwner: boolean;
  suppliers: Supplier[]; materials: Material[]; articles: Article[];
  supplierById: Map<string, Supplier>; materialById: Map<string, Material>; articleByPrefix: Map<string, Article>;
  reloadMaster(): Promise<void>;
  sales: Sales; rows: SalesRow[]; setSales(raw: unknown[][], file: string): void;
  toast(msg: string): void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

const SALES_KEY = "bilhikma-sales-last";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [toastMsg, setToastMsg] = useState<{ m: string; k: number } | null>(null);
  const [sales, setSalesState] = useState<Sales>(() => {
    try { const s = localStorage.getItem(SALES_KEY); if (s) return JSON.parse(s); } catch { /* abaikan */ }
    return { raw: SAMPLE, file: SAMPLE_NAME, isSample: true };
  });

  const toast = useCallback((m: string) => setToastMsg({ m, k: Date.now() }), []);
  useEffect(() => { if (!toastMsg) return; const h = setTimeout(() => setToastMsg(null), 3200); return () => clearTimeout(h); }, [toastMsg]);

  useEffect(() => {
    const refresh = () => backend.currentUser().then(u => { setUser(u); setAuthReady(true); }).catch(() => setAuthReady(true));
    refresh();
    return backend.onAuthChange(refresh);
  }, []);

  const reloadMaster = useCallback(async () => {
    try {
      const [s, m, a] = await Promise.all([backend.list("suppliers"), backend.list("materials"), backend.list("articles")]);
      setSuppliers(s); setMaterials(m); setArticles(a);
    } catch (e) { toast((e as Error).message); }
  }, [toast]);
  useEffect(() => { if (user) reloadMaster(); }, [user, reloadMaster]);

  const setSales = useCallback((raw: unknown[][], file: string) => {
    const s = { raw, file, isSample: false };
    setSalesState(s);
    try { localStorage.setItem(SALES_KEY, JSON.stringify(s)); } catch { /* file terlalu besar untuk disimpan — tetap dipakai di sesi ini */ }
  }, []);

  const value = useMemo<Store>(() => {
    const names = Object.fromEntries(articles.map(a => [a.prefix, a.name]));
    let rows: SalesRow[] = [];
    try { rows = parseRows(sales.raw, names); } catch { rows = []; }
    return {
      user, authReady,
      canEdit: user?.role === "owner" || user?.role === "purchasing",
      isOwner: user?.role === "owner",
      suppliers, materials, articles,
      supplierById: new Map(suppliers.map(s => [s.id, s])),
      materialById: new Map(materials.map(m => [m.id, m])),
      articleByPrefix: new Map(articles.map(a => [a.prefix, a])),
      reloadMaster, sales, rows, setSales, toast,
    };
  }, [user, authReady, suppliers, materials, articles, reloadMaster, sales, setSales, toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div id="toast" style={{ opacity: toastMsg ? 1 : 0 }}>{toastMsg?.m}</div>
    </Ctx.Provider>
  );
}
