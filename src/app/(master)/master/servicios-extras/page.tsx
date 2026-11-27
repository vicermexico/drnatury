import { CardMenu } from "@/components/ui/CardMenu";

export default function ServiciosExtrasPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Servicios Extras</h1>
        <p className="text-sm text-gray-500 mt-1">Agua energética, revisión de PH e Iris</p>
      </div>
      <CardMenu
        items={[
          { href: "/master/agua-energetica", icono: "💧", titulo: "Agua Energética", descripcion: "Gestiona este servicio extra" },
          { href: "/master/ph-revision", icono: "🧪", titulo: "Revisión de PH", descripcion: "Gestiona este servicio extra" },
          { href: "/master/iris", icono: "👁️", titulo: "Iris", descripcion: "Gestiona este servicio extra" },
        ]}
      />
    </div>
  );
}
