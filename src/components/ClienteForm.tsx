"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Save, Search, Loader2 } from "lucide-react";
import { geocodeAddress } from "@/lib/geocode";
import { consultarDocumento } from "@/app/(app)/clientes/actions";
import SubmitButton from "./SubmitButton";

const ClienteMapPicker = dynamic(() => import("./ClienteMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-gray-300 text-sm text-gray-400">
      Cargando mapa...
    </div>
  ),
});

export type ClienteInitialValues = {
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  contacto: string | null;
  correo_electronico: string | null;
  telefono: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  direccion: string | null;
  referencia: string | null;
  latitud: number | null;
  longitud: number | null;
  zona: string | null;
  giro_negocio: string | null;
  grupo: string | null;
  linea_credito: number | null;
  codigo_interno: string | null;
  activo: boolean;
};

const emptyValues: ClienteInitialValues = {
  tipo_documento: "DNI",
  numero_documento: "",
  nombre: "",
  contacto: null,
  correo_electronico: null,
  telefono: null,
  departamento: null,
  provincia: null,
  distrito: null,
  direccion: null,
  referencia: null,
  latitud: null,
  longitud: null,
  zona: null,
  giro_negocio: null,
  grupo: null,
  linea_credito: 0,
  codigo_interno: null,
  activo: true,
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

export default function ClienteForm({
  action,
  initialValues,
  error,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  initialValues?: ClienteInitialValues;
  error?: string;
  submitLabel: string;
}) {
  const values = initialValues ?? emptyValues;
  const [lat, setLat] = useState<number | null>(values.latitud);
  const [lng, setLng] = useState<number | null>(values.longitud);

  const tipoDocumentoRef = useRef<HTMLSelectElement>(null);
  const numeroDocumentoRef = useRef<HTMLInputElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const [buscandoDocumento, setBuscandoDocumento] = useState(false);
  const [avisoDocumento, setAvisoDocumento] = useState<string | null>(null);

  const [ubicacion, setUbicacion] = useState({
    departamento: values.departamento ?? "",
    provincia: values.provincia ?? "",
    distrito: values.distrito ?? "",
    direccion: values.direccion ?? "",
  });
  const [ubicacionTocada, setUbicacionTocada] = useState(false);
  const [buscandoMapa, setBuscandoMapa] = useState(false);
  const [avisoMapa, setAvisoMapa] = useState<string | null>(null);

  const direccionCompleta = [
    ubicacion.direccion,
    ubicacion.distrito,
    ubicacion.provincia,
    ubicacion.departamento,
    "Perú",
  ]
    .filter(Boolean)
    .join(", ");

  const buscarEnMapa = async () => {
    if (!direccionCompleta || direccionCompleta === "Perú") return;
    setBuscandoMapa(true);
    setAvisoMapa(null);
    try {
      const resultado = await geocodeAddress(direccionCompleta);
      if (resultado) {
        setLat(resultado.lat);
        setLng(resultado.lng);
      } else {
        setAvisoMapa(
          "No se encontró esa dirección; ubica el punto manualmente en el mapa.",
        );
      }
    } catch {
      setAvisoMapa("No se pudo buscar la dirección. Intenta de nuevo.");
    } finally {
      setBuscandoMapa(false);
    }
  };

  // Auto-busca en el mapa 1s después de que el usuario deja de escribir
  // la ubicación, para no disparar una consulta por cada tecla.
  useEffect(() => {
    if (!ubicacionTocada) return;
    const timeout = setTimeout(buscarEnMapa, 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacion, ubicacionTocada]);

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
      if (resultado.direccion || resultado.departamento || resultado.provincia || resultado.distrito) {
        setUbicacionTocada(true);
        setUbicacion((prev) => ({
          departamento: resultado.departamento || prev.departamento,
          provincia: resultado.provincia || prev.provincia,
          distrito: resultado.distrito || prev.distrito,
          direccion: resultado.direccion || prev.direccion,
        }));
      }
    } catch (err) {
      setAvisoDocumento(
        err instanceof Error ? err.message : "No se pudo consultar el documento.",
      );
    } finally {
      setBuscandoDocumento(false);
    }
  };

  const campoUbicacion = (campo: keyof typeof ubicacion) => ({
    value: ubicacion[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setUbicacionTocada(true);
      setUbicacion((prev) => ({ ...prev, [campo]: e.target.value }));
    },
  });

  return (
    <form action={action} className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos generales
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo de documento">
            <select
              ref={tipoDocumentoRef}
              name="tipo_documento"
              defaultValue={values.tipo_documento}
              className={inputClass}
            >
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
              <option value="CE">Carné de extranjería</option>
              <option value="OTRO">Otro</option>
            </select>
          </Field>
          <Field label="Número de documento">
            <div className="flex gap-2">
              <input
                ref={numeroDocumentoRef}
                name="numero_documento"
                required
                defaultValue={values.numero_documento}
                className={inputClass}
              />
              <button
                type="button"
                onClick={buscarDocumento}
                disabled={buscandoDocumento}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {buscandoDocumento ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                Buscar
              </button>
            </div>
          </Field>
          <Field label="Nombre / Razón social">
            <input
              ref={nombreRef}
              name="nombre"
              required
              defaultValue={values.nombre}
              className={inputClass}
            />
          </Field>
          {avisoDocumento && (
            <p className="-mt-2 text-sm text-amber-600 sm:col-span-2">{avisoDocumento}</p>
          )}
          <Field label="Persona de contacto">
            <input
              name="contacto"
              defaultValue={values.contacto ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Correo electrónico">
            <input
              type="email"
              name="correo_electronico"
              defaultValue={values.correo_electronico ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Teléfono">
            <input
              name="telefono"
              defaultValue={values.telefono ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ubicación
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Departamento">
            <input
              name="departamento"
              {...campoUbicacion("departamento")}
              className={inputClass}
            />
          </Field>
          <Field label="Provincia">
            <input
              name="provincia"
              {...campoUbicacion("provincia")}
              className={inputClass}
            />
          </Field>
          <Field label="Distrito">
            <input
              name="distrito"
              {...campoUbicacion("distrito")}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Dirección">
          <input
            name="direccion"
            {...campoUbicacion("direccion")}
            className={inputClass}
          />
        </Field>
        <Field label="Referencia">
          <input
            name="referencia"
            defaultValue={values.referencia ?? ""}
            className={inputClass}
          />
        </Field>

        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Ubicación en el mapa (clic o arrastra el marcador)
          </label>
          <button
            type="button"
            onClick={buscarEnMapa}
            disabled={buscandoMapa}
            className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
          >
            {buscandoMapa ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Search size={14} />
            )}
            Buscar dirección en el mapa
          </button>
        </div>
        {avisoMapa && (
          <p className="-mt-2 text-sm text-amber-600">{avisoMapa}</p>
        )}
        <ClienteMapPicker
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
        />
        <input type="hidden" name="latitud" value={lat ?? ""} readOnly />
        <input type="hidden" name="longitud" value={lng ?? ""} readOnly />
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
          <p>Latitud: {lat?.toFixed(6) ?? "sin definir"}</p>
          <p>Longitud: {lng?.toFixed(6) ?? "sin definir"}</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Comercial
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Zona">
            <input
              name="zona"
              defaultValue={values.zona ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Giro de negocio">
            <input
              name="giro_negocio"
              defaultValue={values.giro_negocio ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Grupo">
            <input
              name="grupo"
              defaultValue={values.grupo ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Código interno">
            <input
              name="codigo_interno"
              defaultValue={values.codigo_interno ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Línea de crédito">
            <input
              type="number"
              step="0.01"
              name="linea_credito"
              defaultValue={values.linea_credito || ""}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={values.activo}
            className="h-4 w-4 rounded border-gray-300"
          />
          Cliente activo
        </label>
      </section>

      <SubmitButton icon={<Save size={16} />}>{submitLabel}</SubmitButton>
    </form>
  );
}
