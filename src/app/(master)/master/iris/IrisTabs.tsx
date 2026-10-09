"use client";

import { useState, type ReactNode } from "react";

export function IrisTabs({ banco, manual }: { banco: ReactNode; manual: ReactNode }) {
  const [tab, setTab] = useState<"banco" | "manual">("banco");

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setTab("banco")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "banco" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Banco de imagenes
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Manual
        </button>
      </div>

      {tab === "banco" ? banco : manual}
    </div>
  );
}
