import { PublicChatDemo } from "./PublicChatDemo";

// Pagina publica (sin login) para que Vic mande el link a quien
// quiera y pruebe como contesta el Asistente de WhatsApp. El primer
// mensaje viene fijo (el escrito del anuncio) y no se puede editar ni
// borrar nada -- solo mandarlo y platicar normal despues.
export default function DemoWhatsappPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-md space-y-3">
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-900">DrNatury — Asistente de WhatsApp</h1>
          <p className="text-xs text-gray-500 mt-1">Así contesta nuestro asistente automático</p>
        </div>
        <PublicChatDemo />
      </div>
    </div>
  );
}
