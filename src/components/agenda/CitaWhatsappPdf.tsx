"use client";
import { useState, useTransition, useRef } from "react";

interface Props {
  appointmentId: string;
  patientPhone: string;
  patientName: string;
  pdfUrl: string | null;
  templateConPdf: string;
  templateSinPdf: string;
  confirmUrl: string;
}

export function CitaWhatsappPdf({
  appointmentId,
  patientPhone,
  patientName,
  pdfUrl: initialPdfUrl,
  templateConPdf,
  templateSinPdf,
  confirmUrl,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState(initialPdfUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const resultadoLink = `https://drbioescaner.com/resultado/${appointmentId}`;
  const phone = patientPhone.replace(/\D/g, "");
  const waPhone = phone.length === 10 ? `52${phone}` : phone;

  function buildMessage() {
    const template = pdfUrl ? templateConPdf : templateSinPdf;
    const link = pdfUrl ? resultadoLink : confirmUrl;
    return template
      .replace("{nombre}", patientName)
      .replace("{link}", link);
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(buildMessage());
    window.open(`https://wa.me/${waPhone}?text=${msg}`, "_blank");
  }

  async function handleUpload(file: File) {
    setError(""); setSuccess(""); setUploading(true);
    const form = new FormData();
    form.append("pdf", file);
    const res = await fetch(`/api/appointments/${appointmentId}/pdf`, {
      method: "POST",
      body: form,
    });
    const data = await res.json() as { pdf_url?: string; message?: string };
    setUploading(false);
    if (!res.ok) { setError(data.message ?? "Error al subir PDF"); return; }
    setPdfUrl(data.pdf_url ?? null);
    setSuccess("PDF subido correctamente");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleDelete() {
    setError(""); setSuccess("");
    startTransition(async () => {
      await fetch(`/api/appointments/${appointmentId}/pdf`, { method: "DELETE" });
      setPdfUrl(null);
      setSuccess("PDF eliminado");
      setTimeout(() => setSuccess(""), 3000);
    });
  }

  return (
    <div className="space-y-3 pt-2 border-t border-gray-100 mt-3">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
      />

      <div className="flex gap-2">
        {pdfUrl ? (
          <div className="flex gap-2 flex-1">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center rounded-xl bg-blue-50 border border-blue-200 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">
              Ver PDF
            </a>
            <button onClick={handleDelete}
              className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
              Quitar
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 rounded-xl bg-gray-50 border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition disabled:opacity-60"
          >
            {uploading ? "Subiendo..." : "📎 Subir PDF"}
          </button>
        )}

        <button
          onClick={handleWhatsApp}
          className="flex-1 rounded-xl bg-green-500 py-2 text-xs font-semibold text-white hover:bg-green-600 transition"
        >
          💬 WhatsApp
        </button>
      </div>

      {error   && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}
    </div>
  );
}



