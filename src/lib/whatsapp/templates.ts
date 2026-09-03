// WhatsApp templates are NEVER hardcoded — always fetched from whatsapp_templates table.
// Keys match the template key column in the database.

export type TemplateKey =
  | "appointment_booked"
  | "appointment_reminder"
  | "appointment_cancelled"
  | "appointment_confirmed_notify"
  | "appointment_cancelled_by_patient"
  | "low_stock_alert"
  | "supply_request";

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    body
  );
}
