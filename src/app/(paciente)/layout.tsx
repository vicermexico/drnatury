import { getServerProfile } from "@/lib/auth";
import { PacienteNav } from "@/components/layout/paciente/PacienteNav";
import { NotificationModal } from "@/components/layout/paciente/NotificationModal";
export default async function PacienteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getServerProfile();
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-400 leading-none">DrNatury</p>
          {profile?.name && (
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{profile.name}</p>
          )}
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="text-sm font-bold text-black hover:text-gray-700 transition px-3 py-1.5 rounded-lg"
          >
            Salir
          </button>
        </form>
      </header>
      <main>{children}</main>
      <PacienteNav />
      <NotificationModal />
    </div>
  );
}
