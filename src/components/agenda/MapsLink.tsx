"use client";

// Enlace a Google Maps que detiene la propagacion del click.
// Se usa dentro de tarjetas que a su vez estan envueltas en un <Link>
// (por ejemplo la tarjeta de cita de la agenda del terapeuta), para que
// al hacer clic en "Como llegar" no se dispare tambien la navegacion de
// la tarjeta completa. Es un Client Component porque un Server Component
// no puede recibir un onClick (function) como prop.
export function MapsLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className ?? "underline font-semibold text-blue-600"}
    >
      {label}
    </a>
  );
}
