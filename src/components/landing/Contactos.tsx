import { enlaceCorreo, enlaceMapa, enlaceSeguro, enlaceWhatsapp, formatoTelefono10, sitioCorto } from "@/lib/landing/enlaces";
import { Icono, type NombreIcono } from "./Iconos";
import { Revelar } from "./Revelar";
import { Titulo } from "./Titulo";

export interface ConfigContactos {
  whatsapp_number?: string | null;
  contacto_correo?: string | null;
  contacto_direccion?: string | null;
  contacto_horario?: string | null;
  contacto_sitio_web?: string | null;
}

type Dato = { icono: NombreIcono; etiqueta: string; valor: string; href: string | null };

// Solo entran los campos que el Master lleno; si no hay ninguno, la seccion no aparece.
function datosDe(c: ConfigContactos): Dato[] {
  const datos: Dato[] = [];
  if (c.whatsapp_number) {
    datos.push({
      icono: "whatsapp",
      etiqueta: "WhatsApp",
      valor: formatoTelefono10(c.whatsapp_number),
      href: enlaceWhatsapp(c.whatsapp_number),
    });
  }
  if (c.contacto_correo) datos.push({ icono: "correo", etiqueta: "Correo", valor: c.contacto_correo, href: enlaceCorreo(c.contacto_correo) });
  if (c.contacto_direccion) datos.push({ icono: "direccion", etiqueta: "Direccion", valor: c.contacto_direccion, href: enlaceMapa(c.contacto_direccion) });
  if (c.contacto_horario) datos.push({ icono: "horario", etiqueta: "Horario", valor: c.contacto_horario, href: null });
  const web = enlaceSeguro(c.contacto_sitio_web);
  if (web) datos.push({ icono: "web", etiqueta: "Sitio web", valor: sitioCorto(web), href: web });
  return datos;
}

export function Contactos({ config }: { config: ConfigContactos }) {
  const datos = datosDe(config);
  if (datos.length === 0) return null;

  return (
    <section className="bg-slate-50 px-6 py-16 sm:py-20" aria-label="Nuestros contactos">
      <div className="mx-auto max-w-4xl">
        <Titulo>Nuestros contactos</Titulo>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datos.map((d, n) => {
            const interior = (
              <>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-800 text-amber-400">
                  <Icono nombre={d.icono} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-widest text-emerald-900/60">
                    {d.etiqueta}
                  </span>
                  <span className="block break-words text-base font-medium text-emerald-950 [overflow-wrap:anywhere]">
                    {d.valor}
                  </span>
                </span>
              </>
            );
            const clases = "flex h-full items-center gap-4 rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm";
            return (
              <li key={d.etiqueta}>
                <Revelar retraso={n * 80} className="h-full">
                  {d.href ? (
                    <a
                      href={d.href}
                      target={d.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className={`${clases} transition-colors hover:border-amber-400 hover:shadow-md`}
                    >
                      {interior}
                    </a>
                  ) : (
                    <div className={clases}>{interior}</div>
                  )}
                </Revelar>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
