import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { StoreProvider, useStore } from "./data/store";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analisa from "./pages/Analisa";
import PoList from "./pages/PoList";
import PoDetail from "./pages/PoDetail";
import Hpp from "./pages/Hpp";
import Suppliers from "./pages/Suppliers";
import Materials from "./pages/Materials";
import Articles from "./pages/Articles";
import Users from "./pages/Users";

function Gate() {
  const { user, authReady } = useStore();
  if (!authReady) return <div className="login muted">Memuat…</div>;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="analisa" element={<Analisa />} />
        <Route path="po" element={<PoList />} />
        <Route path="po/:id" element={<PoDetail />} />
        <Route path="hpp" element={<Hpp />} />
        <Route path="master/supplier" element={<Suppliers />} />
        <Route path="master/bahan" element={<Materials />} />
        <Route path="master/artikel" element={<Articles />} />
        <Route path="pengguna" element={<Users />} />
        <Route path="*" element={<p className="empty">Halaman tidak ditemukan.</p>} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><HashRouter><StoreProvider><Gate /></StoreProvider></HashRouter></StrictMode>,
);
