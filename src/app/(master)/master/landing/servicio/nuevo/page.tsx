import { ServicioForm } from "@/components/landing/ServicioForm";

export default function NuevoServicioPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo servicio</h1>
        <p className="text-sm text-gray-500 mt-1">Agrega un servicio a la página de inicio</p>
      </div>
      <ServicioForm />
    </div>
  );
}
