import { CardMenu } from "@/components/ui/CardMenu";

export default function EmpleadosPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
        <p className="text-sm text-gray-500 mt-1">Todo el personal: asistentes, terapeutas y almacenistas</p>
      </div>
      <CardMenu
        items={[
          { href: "/master/asistentes", icono: "🤝", titulo: "Asistentes", descripcion: "Alta y datos de las asistentes" },
          { href: "/master/terapeutas", icono: "🧑‍⚕️", titulo: "Terapeutas", descripcion: "Alta y datos de las terapeutas" },
          { href: "/master/almacenistas", icono: "👷", titulo: "Almacenistas", descripcion: "Alta y datos del personal de almacén" },
          { href: "/master/comisiones", icono: "💰", titulo: "Comisiones", descripcion: "Montos de comisión por producto" },
          { href: "/master/cortes", icono: "✂️", titulo: "Cortes", descripcion: "Genera y gestiona cortes de comisiones" },
        ]}
      />
    </div>
  );
}
