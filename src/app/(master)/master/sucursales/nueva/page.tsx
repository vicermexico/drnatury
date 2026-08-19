import { BranchForm } from "@/components/forms/BranchForm";
import Link from "next/link";

export default function NuevaSucursalPage() {
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/sucursales" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Sucursales
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva sucursal</h1>
      <BranchForm />
    </div>
  );
}
