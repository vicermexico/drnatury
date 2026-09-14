import { createAdminClient } from "@/lib/supabase/admin";
import { AgendarLinkFlow } from "./AgendarLinkFlow";

interface BranchData {
  id: string;
  name: string;
  address: string;
  schedule: unknown;
  branch_services: {
    price: number;
    services: { id: string; name: string; duration_minutes: number } | { id: string; name: string; duration_minutes: number }[] | null;
  }[];
}

async function getBranchesAbiertas(): Promise<BranchData[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("branches")
    .select(`
      id, name, address, schedule,
      branch_services( price, services(id, name, duration_minutes) )
    `)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []) as BranchData[];
}

async function getTherapistBranch(therapistId: string): Promise<{ therapistName: string; branch: BranchData } | null> {
  const admin = createAdminClient();
  const { data: therapist } = await admin
    .from("profiles")
    .select("id, name, branch_id")
    .eq("id", therapistId)
    .contains("roles", ["TERAPEUTA"])
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!therapist?.branch_id) return null;

  const { data: branch } = await admin
    .from("branches")
    .select(`
      id, name, address, schedule,
      branch_services( price, services(id, name, duration_minutes) )
    `)
    .eq("id", therapist.branch_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();
  if (!branch) return null;

  return { therapistName: therapist.name, branch: branch as BranchData };
}

export default async function AgendarLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  if (t) {
    const result = await getTherapistBranch(t);
    if (!result) {
      return (
        <div className="max-w-md mx-auto py-16 px-4 text-center space-y-2">
          <p className="text-4xl">⚠️</p>
          <p className="text-lg font-semibold text-gray-900">Este link ya no es válido</p>
          <p className="text-sm text-gray-500">Pide a tu terapeuta que te mande uno nuevo.</p>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto py-6 px-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Agendar cita</h1>
        <p className="text-sm text-gray-500 mb-6">con {result.therapistName} · DrNatury</p>
        <AgendarLinkFlow
          therapistId={t}
          branches={[result.branch] as Parameters<typeof AgendarLinkFlow>[0]["branches"]}
        />
      </div>
    );
  }

  const branches = await getBranchesAbiertas();
  return (
    <div className="max-w-md mx-auto py-6 px-4">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Agendar cita · DrNatury</h1>
      <AgendarLinkFlow branches={branches as Parameters<typeof AgendarLinkFlow>[0]["branches"]} />
    </div>
  );
}
