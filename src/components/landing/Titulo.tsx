import { Revelar } from "./Revelar";

// Titulo de seccion con la linea verde debajo; entra con Revelar.
export function Titulo({ children, oscuro = false }: { children: string; oscuro?: boolean }) {
  return (
    <div className="mb-10 text-center">
      <Revelar>
        <h2 className={`text-3xl font-extrabold tracking-wide sm:text-4xl ${oscuro ? "text-white" : "text-emerald-900"}`}>
          {children}
        </h2>
      </Revelar>
      <Revelar retraso={150}>
        <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-emerald-500" />
      </Revelar>
    </div>
  );
}
