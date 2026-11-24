import Link from "next/link";
import { ChoferForm } from "@/components/forms/ChoferForm";

export default function NuevoChoferPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm mb-3">
          <Link href="/master/choferes" className="text-gray-400 hover:text-gray-600">Choferes</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700 font-medium">Nuevo</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo chofer</h1>
        <p className="text-sm text-gray-500 mt-1">
          El chofer va a entrar a su panel de entregas con su celular y este PIN.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <ChoferForm />
      </div>
    </div>
  );
}
