export default function ResultadosCount({ count }: { count: number }) {
  return (
    <p className="mb-3 text-sm text-gray-500">
      {count} {count === 1 ? "registro encontrado" : "registros encontrados"}
    </p>
  );
}
