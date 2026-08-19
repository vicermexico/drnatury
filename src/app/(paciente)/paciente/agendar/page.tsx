import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { BookingFlow } from "@/components/agenda/BookingFlow";

async function getBranches() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select(`
      id, name, address, schedule,
      branch_services(
        price,
        services(id, name, duration_minutes)
      )
    `)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}

export default async function AgendarPage() {
  await requireAuth();
  const branches = await getBranches();

  return (
    <div className="max-w-md mx-auto py-6 px-4">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Agendar cita</h1>
      <BookingFlow branches={branches as Parameters<typeof BookingFlow>[0]["branches"]} />
    </div>
  );
}
