import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/calendar/google-auth";

// Guarda a los pacientes del link rapido en el Directorio de contactos
// del celular de Master (via Google Contacts -- el mismo celular que
// sincroniza con su cuenta de Google ya los sincroniza solo). Para no
// llenar su directorio de nombres completos, se guardan con un codigo
// consecutivo "P-1334", "P-1335", etc. (empieza en 1334 porque ya tenia
// contactos manuales hasta el P-1333).
//
// Un mismo telefono siempre usa el mismo codigo -- si el paciente ya
// tiene contacto guardado, no se crea uno nuevo.

export interface EnsureContactResult {
  code: string | null;
  error?: string;
}

export async function ensureGoogleContact(phoneDigits: string): Promise<EnsureContactResult> {
  try {
    const admin = createAdminClient();

    const { data: existente } = await admin
      .from("patient_contacts")
      .select("code")
      .eq("phone", phoneDigits)
      .maybeSingle();
    if (existente) return { code: existente.code };

    const accessToken = await getValidAccessToken();
    if (!accessToken) return { code: null, error: "No conectado a Google" };

    const { data: codeData, error: codeError } = await admin.rpc("next_patient_code");
    if (codeError || !codeData) return { code: null, error: codeError?.message ?? "No se pudo generar el codigo" };
    const code = codeData as string;

    const waPhone = phoneDigits.length === 10 ? `+52${phoneDigits}` : `+${phoneDigits}`;

    const res = await fetch("https://people.googleapis.com/v1/people:createContact", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        names: [{ givenName: code }],
        phoneNumbers: [{ value: waPhone }],
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error("Error creando contacto en Google Contacts:", bodyText);
      return { code: null, error: `Google respondio ${res.status}` };
    }
    const data = await res.json() as { resourceName?: string };

    await admin.from("patient_contacts").insert({
      phone: phoneDigits,
      code,
      google_resource_name: data.resourceName ?? null,
    });

    return { code };
  } catch (err) {
    console.error("Error en ensureGoogleContact:", err);
    return { code: null, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
