// Placeholder del panel del chofer -- aqui va a ir, en la siguiente
// parte de la Fase 3, la lista de entregas del dia (ruta asignada por
// Master) con el mapa y el boton de "entregado"/"no entregado" por
// cada pedido. Por ahora solo confirma que el chofer ya puede entrar.
export default function ChoferDashboard() {
  return (
    <div className="max-w-md mx-auto text-center pt-12 space-y-3">
      <p className="text-4xl">🚚</p>
      <h1 className="text-lg font-bold text-gray-900">Panel de entregas</h1>
      <p className="text-sm text-gray-500">
        Todavía no tienes ninguna ruta asignada. En cuanto Master te asigne entregas, van a aparecer aquí.
      </p>
    </div>
  );
}
