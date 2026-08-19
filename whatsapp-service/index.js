"use strict";

const express    = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode     = require("qrcode");
const fs         = require("fs");
const path       = require("path");
const { execSync } = require("child_process");

const app = express();
app.use(express.json());

const AUTH_DIR = path.join(__dirname, ".wwebjs_auth");
const PORT = process.env.PORT || 3001;

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const MAX_RECONNECT_RETRIES  = 5;
const RECONNECT_BASE_DELAY_MS = 5_000;   // 5s → 10s → 20s → 40s → 80s
const KEEPALIVE_INTERVAL_MS   = 60_000;
const KEEPALIVE_MAX_FAILURES  = 3;       // fallos consecutivos antes de reconectar

// Razones de desconexión que NO tienen solución automática — el usuario
// debe volver a escanear el QR (se borra el disco para forzarlo).
const NON_RECOVERABLE_REASONS = new Set([
  "LOGOUT",              // usuario cerró sesión desde el teléfono
  "CONFLICT",            // WhatsApp Web abierto en otro navegador
  "DEPRECATED_VERSION",  // versión del cliente demasiado antigua
]);

// Map<phone, SessionState>
// status: LOADING | QR | CONNECTED | DISCONNECTED | RECONNECTING | AUTH_FAILURE
const sessions = new Map();

// Contador de fallos consecutivos del keepalive por número
const keepaliveFailures = new Map();

// ── Utilidades ────────────────────────────────────────────────

function clearSessionData(phone) {
  const sessionDir = path.join(AUTH_DIR, `session-${phone}`);
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`[${phone}] Datos de sesión eliminados del disco`);
    }
  } catch (err) {
    // EPERM / EBUSY = Chrome todavía tiene el directorio abierto.
    // Se liberará cuando Chrome muera; no es fatal.
    if (err.code === "EPERM" || err.code === "EBUSY") {
      console.warn(`[${phone}] Directorio de sesión en uso por Chrome (${err.code}) — se limpiará automáticamente al cerrarse`);
    } else {
      console.error(`[${phone}] Error al eliminar sesión del disco:`, err.message);
    }
  }
}

// Mata todos los procesos chrome.exe iniciados por este servicio.
// Necesario al reiniciar cuando el proceso anterior no cerró limpiamente.
function killOrphanedChrome() {
  try {
    execSync("taskkill /F /IM chrome.exe /T", { stdio: "pipe" });
    console.log("[Service] Procesos Chrome huérfanos eliminados");
  } catch {
    // No había chrome.exe corriendo — está bien
  }
}

// ── Reconexión con backoff exponencial ───────────────────────
async function reconnectWithBackoff(phone, retryCount = 0) {
  if (retryCount >= MAX_RECONNECT_RETRIES) {
    console.error(
      `[${phone}] Máximo de reintentos (${MAX_RECONNECT_RETRIES}) alcanzado.`,
      "El usuario debe escanear el QR manualmente."
    );
    // Marcar como AUTH_FAILURE para que el panel lo muestre en rojo
    const state = sessions.get(phone);
    if (state) state.status = "AUTH_FAILURE";
    return;
  }

  const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, retryCount);
  console.log(
    `[${phone}] Reconectando en ${delay / 1_000}s`,
    `(intento ${retryCount + 1}/${MAX_RECONNECT_RETRIES})…`
  );

  const existing = sessions.get(phone);
  if (existing) existing.status = "RECONNECTING";

  await new Promise((r) => setTimeout(r, delay));

  // Si mientras esperábamos la sesión ya se recuperó (ej: usuario pidió QR),
  // no interrumpir el cliente nuevo.
  const current = sessions.get(phone);
  if (current && !["DISCONNECTED", "RECONNECTING"].includes(current.status)) {
    console.log(`[${phone}] Sesión ya recuperada (${current.status}) — cancelando reintento.`);
    return;
  }

  if (current?.client) {
    try { await current.client.destroy(); } catch { /* ignorar */ }
  }
  sessions.delete(phone);

  try {
    await startSession(phone);
  } catch (err) {
    console.error(`[${phone}] Error en reintento ${retryCount + 1}:`, err.message);
    reconnectWithBackoff(phone, retryCount + 1);
  }
}

// ── Crear / recuperar sesión para un número ───────────────────
async function startSession(phone) {
  if (sessions.has(phone)) return sessions.get(phone);

  const state = { client: null, status: "LOADING", qr: null };
  sessions.set(phone, state);

  console.log(`[${phone}] Iniciando sesión…`);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: phone,
      dataPath: AUTH_DIR,
    }),
    puppeteer: {
      headless: true,
      executablePath: CHROME_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        // Evitar que Chrome reduzca actividad cuando no hay foco de ventana
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        // Estabilidad general en entornos headless de Windows
        "--disable-features=TranslateUI",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-sync",
      ],
    },
  });

  state.client = client;

  client.on("qr", async (rawQr) => {
    try {
      state.qr = await qrcode.toDataURL(rawQr);
      state.status = "QR";
      console.log(`[${phone}] QR generado — esperando escaneo`);
    } catch (err) {
      console.error(`[${phone}] Error generando QR:`, err.message);
    }
  });

  client.on("ready", () => {
    state.status = "CONNECTED";
    state.qr = null;
    keepaliveFailures.delete(phone);
    console.log(`[${phone}] Conectado ✓`);
  });

  // Credenciales inválidas — limpiar disco para que el próximo intento pida QR
  client.on("auth_failure", (msg) => {
    console.warn(`[${phone}] Fallo de autenticación:`, msg);
    state.status = "AUTH_FAILURE";
    state.qr = null;
    clearSessionData(phone);
    sessions.delete(phone);
  });

  client.on("disconnected", async (reason) => {
    state.status = "DISCONNECTED";
    state.qr = null;
    keepaliveFailures.delete(phone);
    console.warn(`[${phone}] Desconectado (razón: ${reason})`);

    if (NON_RECOVERABLE_REASONS.has(reason)) {
      // Sin recuperación automática — borrar disco y pedir QR de nuevo
      console.log(`[${phone}] Razón no recuperable: ${reason}. Limpiando sesión.`);
      state.status = "AUTH_FAILURE";
      try { await client.destroy(); } catch { /* ignorar */ }
      clearSessionData(phone);
      sessions.delete(phone);
      return;
    }

    // Desconexión recuperable — reconectar usando los datos guardados en disco
    reconnectWithBackoff(phone);
  });

  // Error al inicializar (Chrome no disponible, sesión corrompida, proceso huérfano, etc.)
  client.initialize().catch(async (err) => {
    console.error(`[${phone}] Error al inicializar:`, err.message);
    state.status = "DISCONNECTED";
    sessions.delete(phone);

    if (err.message.includes("already running")) {
      // Chrome huérfano del arranque anterior tiene el perfil bloqueado.
      // Matarlo y esperar a que libere los archivos antes de reintentar.
      console.warn(`[${phone}] Chrome huérfano detectado — cerrando procesos bloqueantes…`);
      killOrphanedChrome();
      await new Promise((r) => setTimeout(r, 4_000));
    } else {
      // Otros errores de inicialización — verificar si es corrupción de datos
      const isCorrupt =
        err.message.includes("Session") ||
        err.message.includes("auth") ||
        err.message.includes("Protocol error");
      if (isCorrupt) {
        console.warn(`[${phone}] Posible sesión corrompida — limpiando disco`);
        clearSessionData(phone);
      }
    }

    reconnectWithBackoff(phone);
  });

  return state;
}

// ── GET /api/qr?phone=XXXXXXXXXX ─────────────────────────────
// Inicia la sesión si no existe. Si está DISCONNECTED la reinicia para
// generar QR nuevo; si está RECONNECTING deja que el backoff termine.
app.get("/api/qr", async (req, res) => {
  const phone = String(req.query.phone ?? "").replace(/\D/g, "");
  if (phone.length < 10) {
    return res.status(400).json({ error: "phone inválido (mínimo 10 dígitos)" });
  }

  const existing = sessions.get(phone);
  if (existing && existing.status === "DISCONNECTED") {
    try { await existing.client?.destroy(); } catch { /* ignorar */ }
    sessions.delete(phone);
  }

  const state = await startSession(phone);
  res.json({ status: state.status, ...(state.qr ? { qr: state.qr } : {}) });
});

// ── GET /api/status ───────────────────────────────────────────
app.get("/api/status", (req, res) => {
  const phone = req.query.phone
    ? String(req.query.phone).replace(/\D/g, "")
    : null;

  if (phone) {
    const state = sessions.get(phone);
    return res.json({ phone, status: state?.status ?? "NOT_STARTED" });
  }

  res.json(
    Array.from(sessions.entries()).map(([p, s]) => ({ phone: p, status: s.status }))
  );
});

// ── POST /api/send ────────────────────────────────────────────
app.post("/api/send", async (req, res) => {
  const { from, to, message } = req.body ?? {};

  if (!from || !to || !message) {
    return res.status(400).json({ error: "from, to y message son requeridos" });
  }

  const fromPhone = String(from).replace(/\D/g, "");
  const toPhone   = String(to).replace(/\D/g, "");
  const state = sessions.get(fromPhone);

  if (!state || state.status !== "CONNECTED") {
    return res.status(403).json({
      error: "WhatsApp no conectado para este número",
      status: state?.status ?? "NOT_STARTED",
    });
  }

  const digits = toPhone.startsWith("52") ? toPhone : `52${toPhone}`;
  const chatId  = `${digits}@c.us`;
  console.log(`[${fromPhone}] → enviando a ${chatId} (${message.length} chars)`);

  try {
    await state.client.sendMessage(chatId, message);
    console.log(`[${fromPhone}] ✓ enviado a ${chatId}`);
    res.json({ sent: true });
  } catch (err) {
    console.error(`[${fromPhone}] ✗ sendMessage falló:`, err.message);

    // Si el error delata que el proceso de Puppeteer está muerto, reconectar
    const DEAD_CLIENT_SIGNALS = ["getChat", "Protocol error", "Target closed",
                                  "Session closed", "detached", "destroyed"];
    const isDead = DEAD_CLIENT_SIGNALS.some((s) => err.message.includes(s));

    if (isDead) {
      console.error(`[${fromPhone}] Chrome muerto — forzando reconexión`);
      state.status = "DISCONNECTED";
      reconnectWithBackoff(fromPhone);
    }

    res.status(500).json({ error: err.message, reconnecting: isDead });
  }
});

// ── POST /api/disconnect?phone=XXXXXXXXXX ────────────────────
app.post("/api/disconnect", async (req, res) => {
  const phone = String(req.query.phone ?? "").replace(/\D/g, "");
  const state = sessions.get(phone);

  if (!state) return res.status(404).json({ error: "Sesión no encontrada" });

  try {
    await state.client?.logout();
    await state.client?.destroy();
  } catch { /* ignorar */ }

  clearSessionData(phone);
  sessions.delete(phone);
  res.json({ disconnected: true });
});

// ── Health check ──────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    sessions: Array.from(sessions.entries()).map(([p, s]) => ({
      phone: p, status: s.status,
    })),
  });
});

// ── Arranque ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nWhatsApp service escuchando en :${PORT}`);
  console.log(`Directorio de sesiones: ${AUTH_DIR}\n`);
  autoReconnect();
  startKeepalive();
});

// Al arrancar, reconectar todos los números con sesión guardada en disco
async function autoReconnect() {
  if (!fs.existsSync(AUTH_DIR)) return;

  const dirs = fs.readdirSync(AUTH_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("session-"))
    .map((d) => d.name.replace(/^session-/, ""));

  if (dirs.length === 0) return;

  console.log(`Reconectando ${dirs.length} sesión(es) guardada(s)…`);
  for (const phone of dirs) {
    await startSession(phone);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

// Cada 60s verifica que las sesiones CONNECTED sigan vivas.
// Tolera hasta KEEPALIVE_MAX_FAILURES errores consecutivos antes de reconectar,
// para evitar falsos positivos por picos de carga en Chrome.
function startKeepalive() {
  setInterval(async () => {
    for (const [phone, state] of sessions) {
      if (state.status !== "CONNECTED") {
        keepaliveFailures.delete(phone);
        continue;
      }

      try {
        const wState = await state.client.getState();
        if (wState !== "CONNECTED") {
          console.warn(`[${phone}] Keepalive: estado real=${wState} — reconectando…`);
          keepaliveFailures.delete(phone);
          state.status = "DISCONNECTED";
          reconnectWithBackoff(phone);
        } else {
          keepaliveFailures.delete(phone); // éxito → resetear contador
        }
      } catch (err) {
        const n = (keepaliveFailures.get(phone) ?? 0) + 1;
        keepaliveFailures.set(phone, n);
        console.warn(`[${phone}] Keepalive fallo #${n}/${KEEPALIVE_MAX_FAILURES}:`, err.message);

        if (n >= KEEPALIVE_MAX_FAILURES) {
          console.error(`[${phone}] Keepalive: ${KEEPALIVE_MAX_FAILURES} fallos consecutivos — Chrome posiblemente muerto. Reconectando…`);
          keepaliveFailures.delete(phone);
          state.status = "DISCONNECTED";
          reconnectWithBackoff(phone);
        }
      }
    }
  }, KEEPALIVE_INTERVAL_MS);
}

// ── Cierre limpio ─────────────────────────────────────────────
async function shutdown() {
  console.log("\nCerrando sesiones…");
  for (const [phone, state] of sessions) {
    try {
      await state.client?.destroy();
      console.log(`[${phone}] Cerrado`);
    } catch { /* ignorar */ }
  }
  process.exit(0);
}

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

// Protección contra crashes no capturados.
// Errores fatales de red (puerto ocupado) → salir para que PM2 reinicie limpio.
// Errores de runtime → loguear y seguir corriendo.
process.on("uncaughtException", (err) => {
  console.error("[Service] Error no capturado:", err.message);
  if (err.code === "EADDRINUSE" || err.code === "EACCES") {
    console.error("[Service] Puerto ocupado — saliendo para que PM2 gestione el reinicio");
    process.exit(1);
  }
});
process.on("unhandledRejection", (reason) => {
  console.error("[Service] Promise rechazada sin capturar:", reason);
});
