import { createAdminClient } from "@/lib/supabase/admin";
import { IrisBancoPanel } from "./IrisBancoPanel";

async function getReferenceImages() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("iris_reference_images")
    .select("id, label, meaning, zone, image_path, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage
        .from("iris-reference")
        .createSignedUrl(row.image_path, 3600);
      return { ...row, image_url: signed?.signedUrl ?? null };
    })
  );
  return withUrls;
}

export default async function MasterIrisPage() {
  const references = await getReferenceImages();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Iris</h1>
        <p className="text-sm text-gray-500 mt-1">
          Banco de referencia de iridologia — solo tu lo ves y lo administras.
        </p>
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800">
          ⚠️ La iridologia no esta comprobada cientificamente. Esta
          herramienta es unicamente para tu estudio y orientacion personal —
          nunca debe usarse para diagnosticar, tratar pacientes, ni
          sustituir atencion medica profesional.
        </p>
      </div>

      <IrisBancoPanel initialReferences={references} />
    </div>
  );
}
