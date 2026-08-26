"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, X } from "lucide-react";
import { createClienteRapido, consultarDocumento } from "@/app/(app)/clientes/actions";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

export default function ClienteRapidoModal({
  nombreInicial,
  onClose,
  onCreated,
}: {
  nombreInicial: string;
  onClose: () => void;
  onCreated: (cliente: { id: string; nombre: string }) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tipoDocumentoRef = useRef<HTMLSelectElement>(null);
  const numeroDocumentoRef = useRef<HTMLInputElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const [buscandoDocumento, setBuscandoDocumento] = useState(false);
  const [avisoDocumento, setAvisoDocumento] = useState<string | null>(null);

  const buscarDocumento = async () => {
    const tipo = tipoDocumentoRef.current?.value ?? "";
    const numero = numeroDocumentoRef.current?.value.trim() ?? "";
    if (!numero) {
      setAvisoDocumento("Ingresa el número de documento primero.");
      return;
    }
    setBuscandoDocumento(true);
    setAvisoDocumento(null);
    try {
      const resultado = await consultarDocumento(tipo, numero);
      if ("error" in resultado) {
        setAvisoDocumento(resultado.error);
        return;
      }
      if (nombreRef.current) nombreRef.current.value = resultado.nombre;
    } catch (err) {
      setAvisoDocumento(
        err instanceof Error ? err.message : "No se pudo consultar el documento.",
      );
    } finally {
      setBuscandoDocumento(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const resultado = await createClienteRapido(formData);
        if ("error" in resultado) {
          setError(resultado.error);
          return;
        }
        onCreated(resultado);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo registrar el cliente. Intenta de nuevo.",
        );
      }
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Nuevo cliente</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="activo" value="on" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo de documento
              </label>
              <select
                ref={tipoDocumentoRef}
                name="tipo_documento"
                defaultValue="DNI"
                className={inputClass}
              >
                <option value="DNI">DNI</option>
                <option value="RUC">RUC</option>
                <option value="CE">Carné de extranjería</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Número de documento
              </label>
              <div className="flex gap-2">
                <input
                  ref={numeroDocumentoRef}
                  name="numero_documento"
                  required
                  autoFocus
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={buscarDocumento}
                  disabled={buscandoDocumento}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {buscandoDocumento ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                </button>
              </div>
            </div>
          </div>
          {avisoDocumento && <p className="text-sm text-amber-600">{avisoDocumento}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre / Razón social
            </label>
            <input
              ref={nombreRef}
              name="nombre"
              required
              defaultValue={nombreInicial}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input name="telefono" className={inputClass} />
          </div>

          <p className="text-xs text-gray-400">
            Puedes completar dirección, mapa y demás datos más tarde desde el módulo de Clientes.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
