import { useEffect, type ReactNode } from "react";

const P: Record<string, string> = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  po: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6",
  hpp: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  truck: "M2 6h12v10H2zM14 10h4l4 4v2h-8M6 19a2 2 0 1 0 0-.01M18 19a2 2 0 1 0 0-.01",
  roll: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3zM4 6c0 1.7 3.6 3 8 3s8-1.3 8-3",
  shirt: "M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c0 2-2 3-4 3S8 5 8 3z",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 3a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.6",
  upload: "M12 16V4M6 10l6-6 6 6M4 20h16",
  download: "M12 4v12M6 10l6 6 6-6M4 20h16",
  plus: "M12 5v14M5 12h14",
  menu: "M3 6h18M3 12h18M3 18h18",
  print: "M6 9V2h12v7M6 18H4v-7h16v7h-2M6 14h12v8H6z",
  logout: "M9 21H4V3h5M16 17l5-5-5-5M21 12H9",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15",
};
export function Icon({ name }: { name: keyof typeof P | string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={P[name]} /></svg>;
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose(): void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", h); return () => removeEventListener("keydown", h); }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: ReactNode }) {
  return <label className={"field" + (full ? " full" : "")}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Kpis({ items }: { items: [string, ReactNode, ReactNode?][] }) {
  return <div className="kpis">{items.map(([k, v, s], i) => (
    <div className="kpi" key={i}><div className="k">{k}</div><div className="v" style={String(v).length > 14 ? { fontSize: 17 } : undefined}>{v}</div>{s && <div className="s">{s}</div>}</div>
  ))}</div>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [NoInfer<T>, string][]; onChange(v: NoInfer<T>): void }) {
  return <div className="seg">{options.map(([v, l]) => <button key={v} type="button" className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
