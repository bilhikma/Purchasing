import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { backend, resetDemo } from "../data/backend";
import { useStore } from "../data/store";
import { Icon } from "./ui";
import { IS_ARTIFACT } from "../lib/env";

const ROLE_LABEL = { owner: "Owner", purchasing: "Purchasing", viewer: "Viewer" };

export default function Layout() {
  const { user, isOwner, ask } = useStore();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const L = (to: string, icon: string, label: string) => (
    <NavLink to={to} end={to === "/"} onClick={() => setOpen(false)}><Icon name={icon} />{label}</NavLink>
  );
  return (
    <>
      {backend.mode === "demo" && (
        <div className="demo-bar no-print">
          {IS_ARTIFACT ? "Versi demo — data hanya tersimpan di perangkat ini." : "Mode demo — data hanya tersimpan di browser ini. Sambungkan Supabase agar bisa dipakai bersama tim (lihat README)."}
          <button onClick={async () => (await ask("Hapus semua data demo dan kembalikan ke contoh awal?", "Reset")) && resetDemo()}>Reset data demo</button>
        </div>
      )}
      <div className="app">
        <aside className={"side" + (open ? " open" : "")}>
          <div className="brand"><b>Bilhikma</b><span>Purchasing &amp; Restok</span></div>
          <nav className="nav">
            {L("/", "home", "Ringkasan")}
            {L("/analisa", "chart", "Analisa Restok")}
            {L("/po", "po", "Purchase Order")}
            {L("/hpp", "hpp", "HPP & Margin")}
            <div className="nav-sec">Master Data</div>
            {L("/master/artikel", "shirt", "Artikel")}
            {L("/master/bahan", "roll", "Bahan")}
            {L("/master/supplier", "truck", "Supplier")}
            {isOwner && <><div className="nav-sec">Admin</div>{L("/pengguna", "users", "Pengguna")}</>}
          </nav>
          <div className="me">
            <b>{user?.name}</b>
            <div className="muted">{user?.email} · {user ? ROLE_LABEL[user.role] : ""}</div>
            <button className="btn sm ghost" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => backend.signOut()}><Icon name="logout" />Keluar</button>
          </div>
        </aside>
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <div className="main">
          <div className="topbar"><button className="icon-btn" aria-label="Menu" onClick={() => setOpen(true)}><Icon name="menu" /></button><b>Bilhikma</b></div>
          <div className="wrap" key={loc.pathname}><Outlet /></div>
        </div>
      </div>
    </>
  );
}
