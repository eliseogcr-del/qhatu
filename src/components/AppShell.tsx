"use client";

import { useEffect, useState } from "react";
import { Menu, X, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import Logo from "./Logo";
import SidebarNav from "./SidebarNav";
import { ROL_LABEL, type Rol } from "@/lib/roles";

// Los <input type="number"> cambian de valor un "paso" (step) si el mouse
// hace scroll sobre ellos estando enfocados — un gesto pensado para
// scrollear la página, no para editar el campo. Eso causó que un "100"
// terminara guardado como "99.99" sin que nadie lo notara. Blureamos el
// campo apenas se detecta scroll para que el navegador no le aplique ese
// cambio y la página siga scrolleando normal.
function useDeshabilitarScrollEnNumeros() {
  useEffect(() => {
    function handleWheel() {
      const activo = document.activeElement;
      if (activo instanceof HTMLInputElement && activo.type === "number") {
        activo.blur();
      }
    }
    document.addEventListener("wheel", handleWheel, { passive: true });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);
}

function BrandRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Logo className="h-9 w-9" />
      <span className="text-xl font-semibold tracking-tight text-white">
        Qhatu
      </span>
    </div>
  );
}

function UserInfo({
  nombre,
  rol,
  almacenNombre,
}: {
  nombre: string;
  rol: string;
  almacenNombre: string | null;
}) {
  return (
    <div className="border-b border-white/10 px-5 py-4">
      <p className="truncate text-sm font-semibold text-white">
        {nombre || "Sin nombre"}
      </p>
      <p className="mt-0.5 truncate text-xs text-emerald-100/80">
        {ROL_LABEL[rol as Rol] ?? rol}
      </p>
      {almacenNombre && (
        <p className="mt-0.5 truncate text-xs text-emerald-100/70">
          {almacenNombre}
        </p>
      )}
    </div>
  );
}

function SignOutForm({
  signOutAction,
  userEmail,
}: {
  signOutAction: (formData: FormData) => void;
  userEmail: string;
}) {
  return (
    <div className="border-t border-white/10 p-4">
      <p className="mb-2 truncate px-1 text-xs text-emerald-100/70">{userEmail}</p>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

export default function AppShell({
  nombre,
  rol,
  almacenNombre,
  almacenEsDigital,
  userEmail,
  signOutAction,
  children,
}: {
  nombre: string;
  rol: string;
  almacenNombre: string | null;
  almacenEsDigital: boolean;
  userEmail: string;
  signOutAction: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Menú lateral de escritorio: se puede ocultar para ganar espacio de
  // pantalla. La preferencia se guarda en localStorage (por navegador, no
  // por servidor) para que se mantenga al navegar entre pantallas — arranca
  // visible por defecto y recién en el cliente se ajusta según lo guardado,
  // para no depender de cookies solo por esto.
  const [sidebarVisible, setSidebarVisible] = useState(true);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem("qhatu-sidebar-visible");
      // No hay forma de leer localStorage antes de este efecto (no existe
      // en el servidor), así que ajustar el estado inicial acá es
      // inevitable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (guardado !== null) setSidebarVisible(guardado === "1");
    } catch {
      // Almacenamiento no disponible (modo privado, etc.) — se queda visible.
    }
  }, []);

  function alternarSidebar() {
    setSidebarVisible((v) => {
      const next = !v;
      try {
        localStorage.setItem("qhatu-sidebar-visible", next ? "1" : "0");
      } catch {
        // Sin persistencia disponible, igual cambia para esta sesión.
      }
      return next;
    });
  }

  useDeshabilitarScrollEnNumeros();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Barra superior — solo en móvil */}
      <div className="no-imprimir fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/10 bg-emerald-800 px-4 py-3 md:hidden">
        <BrandRow />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="rounded-lg p-2 text-white hover:bg-emerald-700"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Drawer — solo en móvil */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-emerald-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
              <BrandRow />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-1 text-white/70 hover:bg-emerald-700"
              >
                <X size={20} />
              </button>
            </div>
            <UserInfo nombre={nombre} rol={rol} almacenNombre={almacenNombre} />
            <SidebarNav
              rol={rol}
              almacenEsDigital={almacenEsDigital}
              onNavigate={() => setOpen(false)}
            />
            <SignOutForm signOutAction={signOutAction} userEmail={userEmail} />
          </aside>
        </div>
      )}

      {/* Sidebar fijo — solo en desktop, se puede ocultar */}
      {sidebarVisible && (
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-emerald-800 md:flex">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <BrandRow />
            <button
              type="button"
              onClick={alternarSidebar}
              aria-label="Ocultar menú"
              title="Ocultar menú"
              className="rounded-lg p-1 text-white/70 hover:bg-emerald-700"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          <UserInfo nombre={nombre} rol={rol} almacenNombre={almacenNombre} />
          <SidebarNav rol={rol} almacenEsDigital={almacenEsDigital} />
          <SignOutForm signOutAction={signOutAction} userEmail={userEmail} />
        </aside>
      )}
      {!sidebarVisible && (
        <button
          type="button"
          onClick={alternarSidebar}
          aria-label="Mostrar menú"
          title="Mostrar menú"
          className="no-imprimir fixed left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-r-lg bg-emerald-800 p-2 text-white shadow-md hover:bg-emerald-700 md:block"
        >
          <ChevronRight size={18} />
        </button>
      )}

      <main className="min-w-0 flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
