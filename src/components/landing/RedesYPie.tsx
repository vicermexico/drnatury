import { enlaceSeguro, enlaceWhatsapp } from "@/lib/landing/enlaces";
import { Icono } from "./Iconos";
import { Revelar } from "./Revelar";
import { Titulo } from "./Titulo";

export interface ConfigPie {
  red_facebook?: string | null;
  red_instagram?: string | null;
  dev_nombre?: string | null;
  dev_whatsapp?: string | null;
}

// Redes sociales (solo las que tienen enlace) y pie de pagina con el credito del
// desarrollador. Sin redes no sale "Siguenos"; sin nombre del desarrollador no sale
// el credito; sin su WhatsApp el credito sale sin el boton. Replica de appvlc.
export function RedesYPie({ config }: { config: ConfigPie }) {
  const redes = [
    { red: "facebook" as const, nombre: "Facebook", href: enlaceSeguro(config.red_facebook) },
    { red: "instagram" as const, nombre: "Instagram", href: enlaceSeguro(config.red_instagram) },
  ].filter((r): r is { red: "facebook" | "instagram"; nombre: string; href: string } => !!r.href);

  const devNombre = config.dev_nombre?.trim() || null;
  const devEnlace = enlaceWhatsapp(
    config.dev_whatsapp,
    devNombre ? `Hola ${devNombre}, vi su credito en la plataforma y quiero mas informacion.` : undefined
  );

  if (redes.length === 0 && !devNombre) return null;

  return (
    <footer className="bg-emerald-950 px-6 pb-12 pt-16 text-white">
      <div className="mx-auto max-w-4xl">
        {redes.length > 0 && (
          <div>
            <Titulo oscuro>Síguenos</Titulo>
            <Revelar>
              <ul className="flex flex-wrap justify-center gap-4">
                {redes.map((r) => (
                  <li key={r.red}>
                    <a
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${r.nombre} (se abre en una pestaña nueva)`}
                      title={r.nombre}
                      className="grid h-14 w-14 place-items-center rounded-full bg-amber-400 text-emerald-950 shadow-lg transition-transform hover:-translate-y-1 hover:bg-amber-300"
                    >
                      <Icono nombre={r.red} className="h-7 w-7" />
                    </a>
                  </li>
                ))}
              </ul>
            </Revelar>
          </div>
        )}

        {devNombre && (
          <Revelar className={redes.length > 0 ? "mt-14 border-t border-white/20 pt-8" : ""}>
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-white/80">
                <strong className="font-bold text-white">{devNombre}</strong> — desarrollador de esta plataforma
              </p>
              {devEnlace && (
                <a
                  href={devEnlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center rounded-xl bg-amber-400 px-6 text-sm font-bold text-emerald-950 shadow transition-colors hover:bg-amber-300"
                >
                  Contáctanos
                </a>
              )}
            </div>
          </Revelar>
        )}
      </div>
    </footer>
  );
}
