-- ============================================================
-- Migration 006 — WhatsApp: templates, números y configuración
-- CLAUDE.md regla 7: templates NUNCA hardcoded, siempre desde
-- esta tabla.
-- PRD §18: rotación circular de hasta 4 números (Modo A).
-- ============================================================

-- Templates de mensajes — Alejandro los edita desde el Master
CREATE TABLE whatsapp_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clave única que identifica el mensaje en el código
  key         TEXT        UNIQUE NOT NULL,
  body        TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hasta 4 números para rotación circular (PRD §18)
-- display_order determina el orden de rotación (0, 1, 2, 3)
CREATE TABLE whatsapp_numbers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT        UNIQUE NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_numbers_active
  ON whatsapp_numbers(display_order)
  WHERE is_active = TRUE;

-- Configuración global de la aplicación (clave-valor)
CREATE TABLE settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valores iniciales
INSERT INTO settings (key, value) VALUES
  -- Modo activo de WhatsApp: WAWEB = whatsapp-web.js (Modo A)
  --                          CLOUD_API = WhatsApp Cloud API oficial (Modo B)
  ('whatsapp_mode',            'WAWEB'),
  -- Índice del último número usado en la rotación circular
  ('whatsapp_rotation_index',  '0');
