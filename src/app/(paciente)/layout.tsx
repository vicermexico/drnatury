import { getServerProfile } from "@/lib/auth";
import { PacienteNav } from "@/components/layout/paciente/PacienteNav";

export default async function PacienteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getServerProfile();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-400 leading-none">DrBioescaner</p>
          {profile?.name && (
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{profile.name}</p>
          )}
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded"
          >
            Salir
          </button>
        </form>
      </header>

      <main>{children}</main>

      <PacienteNav />
    </div>
  );
}
