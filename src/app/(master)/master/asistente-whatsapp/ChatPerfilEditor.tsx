"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Esta pantalla le tiene que salir a Master EXACTAMENTE igual que la
// ve el paciente en /chat (mismo encabezado oscuro tipo WhatsApp,
// misma pantalla de opciones) -- la unica diferencia es que aqui cada
// cosa editable trae su lapiz encima para poder cambiarla, en vez de
// un formulario aparte.

interface Props {
  nombreInicial: string;
  fotoInicial: string | null;
  facebookUrlInicial: string | null;
}

type Status = "idle" | "loading" | "ok" | "error";

async function uploadFile(file: File) {
  const res = await fetch("/api/landing/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name }),
  });
  const data = (await res.json()) as { path?: string; token?: string; publicUrl?: string; message?: string };
  if (!res.ok || !data.path || !data.token || !data.publicUrl) {
    throw new Error(data.message || "No se pudo iniciar la subida");
  }
  const supabase = createClient();
  const { error } = await supabase.storage.from("landing").uploadToSignedUrl(data.path, data.token, file, {
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return data.publicUrl;
}

async function guardarConfig(patch: object) {
  const res = await fetch("/api/landing/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

function Lapiz({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-xs hover:bg-gray-50 shrink-0"
    >
      ✏️
    </button>
  );
}

export function ChatPerfilEditor({ nombreInicial, fotoInicial, facebookUrlInicial }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [foto, setFoto] = useState<string | null>(fotoInicial);
  const [facebookUrl, setFacebookUrl] = useState<string | null>(facebookUrlInicial);

  const [editandoNombre, setEditandoNombre] = useState(false);
  const [borradorNombre, setBorradorNombre] = useState(nombreInicial);
  const [editandoFacebook, setEditandoFacebook] = useState(false);
  const [borradorFacebook, setBorradorFacebook] = useState(facebookUrlInicial ?? "");

  const [statusNombre, setStatusNombre] = useState<Status>("idle");
  const [statusFoto, setStatusFoto] = useState<Status>("idle");
  const [statusFacebook, setStatusFacebook] = useState<Status>("idle");

  const inputFotoRef = useRef<HTMLInputElement>(null);

  async function guardarNombre() {
    const valor = borradorNombre.trim() || "DrNatury";
    setStatusNombre("loading");
    const ok = await guardarConfig({ chat_perfil_nombre: valor });
    if (ok) {
      setNombre(valor);
      setEditandoNombre(false);
      setStatusNombre("ok");
    } else {
      setStatusNombre("error");
    }
  }

  async function guardarFacebook() {
    const valor = borradorFacebook.trim() || null;
    setStatusFacebook("loading");
    const ok = await guardarConfig({ anuncio_facebook_url: valor });
    if (ok) {
      setFacebookUrl(valor);
      setEditandoFacebook(false);
      setStatusFacebook("ok");
    } else {
      setStatusFacebook("error");
    }
  }

  async function cambiarFoto(file: File) {
    setStatusFoto("loading");
    try {
      const url = await uploadFile(file);
      const ok = await guardarConfig({ chat_perfil_foto: url });
      if (ok) {
        setFoto(url);
        setStatusFoto("ok");
      } else {
        setStatusFoto("error");
      }
    } catch {
      setStatusFoto("error");
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden max-w-md">
      <p className="text-xs font-medium text-gray-500 bg-gray-50 px-4 py-2 border-b border-gray-100">
        Así lo ve el paciente en el chat -- dale clic al lápiz de lo que quieras cambiar
      </p>

      {/* Encabezado -- igual al de /chat */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg overflow-hidden">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt={nombre} className="w-full h-full object-cover" />
            ) : (
              "🌿"
            )}
          </div>
          <button
            onClick={() => inputFotoRef.current?.click()}
            disabled={statusFoto === "loading"}
            title="Cambiar foto"
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center text-[10px] disabled:opacity-50"
          >
            {statusFoto === "loading" ? "…" : "✏️"}
          </button>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) cambiarFoto(file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          {!editandoNombre ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{nombre}</p>
              <Lapiz
                title="Cambiar nombre"
                onClick={() => {
                  setBorradorNombre(nombre);
                  setEditandoNombre(true);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                value={borradorNombre}
                onChange={(e) => setBorradorNombre(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-900"
                autoFocus
              />
              <button
                onClick={guardarNombre}
                disabled={statusNombre === "loading"}
                className="text-[11px] font-semibold text-white bg-emerald-600 rounded-md px-2 py-1 disabled:opacity-60"
              >
                OK
              </button>
              <button
                onClick={() => setEditandoNombre(false)}
                className="text-[11px] text-gray-400 px-1"
              >
                ✕
              </button>
            </div>
          )}
          <p className="text-[11px] text-gray-500 leading-tight">en línea</p>
        </div>
      </div>

      {/* Pantalla de opciones -- igual a la del chat (foto de portada
          con el circulo encima, como en WhatsApp) */}
      <div className="flex flex-col items-center bg-white">
        <div className="relative w-full shrink-0">
          <div className="h-24 w-full overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700">
            {foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" aria-hidden="true" className="w-full h-full object-cover scale-125 blur-md opacity-70" />
            )}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 w-16 h-16 rounded-full border-4 border-white bg-emerald-100 flex items-center justify-center text-2xl overflow-hidden shadow-lg">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt={nombre} className="w-full h-full object-cover" />
            ) : (
              "🌿"
            )}
          </div>
          <button
            onClick={() => inputFotoRef.current?.click()}
            disabled={statusFoto === "loading"}
            title="Cambiar foto"
            className="absolute left-1/2 translate-x-3 -bottom-9 w-6 h-6 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center text-xs disabled:opacity-50"
          >
            {statusFoto === "loading" ? "…" : "✏️"}
          </button>
        </div>
        <p className="text-base font-semibold text-gray-900 mt-10">{nombre}</p>

        <div className="w-full mt-4 px-6 pb-6 space-y-2">
          <div className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500">
            🌐 www.drnatury.com <span className="text-[10px] text-gray-400">(fijo, no se edita)</span>
          </div>

          {!editandoFacebook ? (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5">
              <p className="flex-1 min-w-0 text-sm text-gray-800 truncate">
                📘 {facebookUrl || "(sin link de anuncio todavía)"}
              </p>
              <Lapiz
                title="Cambiar link del anuncio de Facebook"
                onClick={() => {
                  setBorradorFacebook(facebookUrl ?? "");
                  setEditandoFacebook(true);
                }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 space-y-2">
              <input
                value={borradorFacebook}
                onChange={(e) => setBorradorFacebook(e.target.value)}
                placeholder="https://www.facebook.com/..."
                className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditandoFacebook(false)} className="text-xs px-2 py-1 text-gray-500">
                  Cancelar
                </button>
                <button
                  onClick={guardarFacebook}
                  disabled={statusFacebook === "loading"}
                  className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                >
                  {statusFacebook === "loading" ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500">
            📲 Escribir por WhatsApp <span className="text-[10px] text-gray-400">(fijo, no se edita aquí)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
