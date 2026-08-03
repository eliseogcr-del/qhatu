import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Panel Qhatu
        </h1>
        <p className="text-sm text-gray-500">
          Sesión iniciada como{" "}
          <span className="font-medium">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
