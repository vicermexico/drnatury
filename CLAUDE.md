# DrNatury — Reglas del proyecto para Claude Code

## Resumen del proyecto

Web app responsiva mobile-first (PWA) de gestión de clínica multi-sucursal para DrNatury (Alejandro Cervantes Elizondo). Single-tenant. 4 sucursales iniciales en Monterrey, N.L.

**Stack:** Next.js 15 + TypeScript + Supabase + Vercel  
**Integración core:** WhatsApp — rotación circular de 4 números con whatsapp-web.js + Cloud API como plan de escape  
**PRD de referencia:** `PRD_App_Alejandro_v2_1_1.txt`

---

## Reglas inquebrantables

1. **Soft delete obligatorio** en `patients`, `branches`, `services`, `products`, `users`. Hard delete prohibido.
2. **Nunca commitear `.env*` files.** `.gitignore` configurado para excluirlos.
3. **Nunca usar service role key en código client-side.**
4. **Toda operación que toca `appointments` o `inventory` corre en transacción SQL con `FOR UPDATE`.**
5. **Rate limiting obligatorio** en todos los endpoints públicos.
6. **Audit log obligatorio** en: cancelación de cita, registro de venta, ajuste de inventario, cambio de rol.
7. **WhatsApp templates NUNCA hardcoded** — siempre desde tabla `whatsapp_templates`.
8. **Tests obligatorios** para features que tocan agenda, inventario y auth.
9. **Migrations versionadas en repo.** Nunca cambios de schema directo en el dashboard de Supabase.
10. **Nunca push directo a `main`.** Siempre PR con CI verde.

---

## Arquitectura y datos

- **Tenancy:** single-tenant — no se requiere `organization_id` en las tablas.
- **Roles:** `MASTER`, `TERAPEUTA`, `ASISTENTE`, `ALMACENISTA`, `PACIENTE`.
- **Autenticación:** número de celular + contraseña para staff; solo celular para pacientes.
- **Bloque base de agenda:** 30 minutos. Capacidad simultánea configurable por sucursal.
- **Concurrencia en citas:** `SELECT FOR UPDATE` al confirmar — gana quien confirma primero.
- **Datos de salud encriptados at-rest** (LFPDPPP + NOM-024).

## Cumplimiento legal obligatorio en V1

- `/aviso-privacidad` — aceptado al registrarse.
- `/terminos-de-uso`
- `/derechos-arco`

---

## Flujo de despliegue

1. Todo cambio va a staging (`app-alejandro-dev`) primero.
2. Solo después de validar en staging se publica a producción.
3. Sin publicación directa a producción — nunca.

---

## Primera rebanada vertical (V0)

El primer PR debe cubrir este flujo completo end-to-end:

1. Master se registra y accede a su panel.
2. Master da de alta una sucursal (dirección, horario, capacidad).
3. Master da de alta una terapeuta vinculada a esa sucursal.
4. Master define un servicio (nombre, duración, precio).
5. Master configura el template de WhatsApp de confirmación.
6. Paciente abre la URL, mete su celular, llena formulario, agenda cita.
7. WhatsApp de confirmación llega al paciente.
8. Master ve la cita en la agenda de la terapeuta.

**Si esto funciona end-to-end, la arquitectura es sólida.**
