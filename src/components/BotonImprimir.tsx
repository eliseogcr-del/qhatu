"use client";

import { Printer } from "lucide-react";

export default function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
    >
      <Printer size={16} />
      Imprimir
    </button>
  );
}
