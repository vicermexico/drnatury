import { notFound } from "next/navigation";
import { verifyQuickSecret } from "@/lib/quick-link/secret";
import { QuickBookingFlow } from "./QuickBookingFlow";

// Pagina sin login del link rapido de Master. El "secret" en la URL hace
// las veces de contraseña — si no coincide, se muestra 404 normal (no se
// revela que esta pagina existe).

export default async function AgendarRapidoPage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (!verifyQuickSecret(secret)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Agendado rapido</h1>
        <p className="text-sm text-gray-500 mb-6">Solo tu tienes este link. No se guarda en ningun historial de pantalla.</p>
        <QuickBookingFlow secret={secret} />
      </div>
    </div>
  );
}
