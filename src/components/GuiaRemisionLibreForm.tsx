"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import SubmitButton from "./SubmitButton";
import { obtenerPedidosPendientesCliente, type PedidoPendienteLibre } from "@/app/(app)/comprobantes-libres/actions";
import { TIPOS_TRANSPORTE, TIPO_TRANSPORTE_LABEL } from "@/lib/reparto-estados";

type Almacen = { id: string; nombre: string };
type Usuario = { id: string; nombre: string | null };

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

export default function GuiaRemisionLibreForm({
  action,
  clienteId,
  almacenes,
  usuarios,
}: {
  action: (formData: FormData) => void;
  clienteId: string;
  almacenes: Almacen[];
  usuarios: Usuario[];
}) {
  const [modo, setModo] = useState<"pedido" | "manual">("pedido");
  const [pedidos, setPedidos] = useState<PedidoPendienteLibre[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [pedidosCargados, setPedidosCargados] = useState(false);
  const [tipoTransporte, setTipoTransporte] = useState("repartidor_propio");

  const elegirModoPedido = async () => {
    setModo("pedido");
    if (pedidosCargados) return;
    setCargandoPedidos(true);
    const data = await obtenerPedidosPendientesCliente(clienteId);
    setPedidos(data);
    setPedidosCargados(true);
    setCargandoPedidos(false);
  };

  return (
    <form action={action} className="space-y-4">
      <div className="flex gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="modo"
            checked={modo === "pedido"}
            onChange={elegirModoPedido}
          />
          Vincular a un pedido
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="modo"
            checked={modo === "manual"}
            onChange={() => setModo("manual")}
          />
          Completar manualmente
        </label>
      </div>

      {modo === "pedido" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Pedido del cliente
          </label>
          <select name="pedido_id" required className={inputClass} disabled={cargandoPedidos}>
            <option value="">
              {cargandoPedidos ? "Cargando pedidos..." : "Selecciona un pedido"}
            </option>
            {pedidos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fecha} — {p.items.length} producto{p.items.length === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          {pedidosCargados && pedidos.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Este cliente no tiene pedidos sin venta todavía. Usa &quot;Completar
              manualmente&quot; en su lugar.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Los productos y el almacén de origen salen directo del pedido — lo que de
            verdad se está trasladando.
          </p>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Almacén de origen
          </label>
          <select name="almacen_id" required className={inputClass}>
            <option value="">Selecciona</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Tipo de transporte
          </label>
          <select
            name="tipo_transporte"
            value={tipoTransporte}
            onChange={(e) => setTipoTransporte(e.target.value)}
            className={inputClass}
          >
            {TIPOS_TRANSPORTE.map((t) => (
              <option key={t} value={t}>
                {TIPO_TRANSPORTE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Placa del vehículo
          </label>
          <input name="placa_numero" placeholder="ABC123" required className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Peso bruto total (kg)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="peso_bruto_total"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">N° de bultos</label>
          <input type="number" step="1" min="1" name="numero_de_bultos" required className={inputClass} />
        </div>
      </div>

      {tipoTransporte === "delivery_subcontratado" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre del delivery / transportista
            </label>
            <input name="transportista_nombre" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              RUC del transportista
            </label>
            <input name="transportista_ruc" maxLength={11} className={inputClass} />
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Repartidor / conductor
          </label>
          <select name="repartidor_id" className={inputClass}>
            <option value="">Selecciona un repartidor</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre ?? u.id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Sus datos (DNI, licencia) se completan en Usuarios.
          </p>
        </div>
      )}

      <SubmitButton
        icon={<Send size={16} />}
        pendingLabel="Generando..."
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Generar guía de remisión
      </SubmitButton>
    </form>
  );
}
