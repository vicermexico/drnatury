"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Branch { id: string; name: string; }
interface Product { id: string; name: string; image_url: string | null; min_weekly_quantity: number; }
interface StockEntry {
  warehouse: number;
  branches: Record<string, number>;
  soldToday: number;
  soldTodayByBranch: Record<string, number>;
  soldTodayWarehouse: number;
  soldMonth: number;
  soldMonthByBranch: Record<string, number>;
  soldMonthWarehouse: number;
}

export function InventarioTable({ products, branches, stockByProduct }: {
  products: Product[];
  branches: Branch[];
  stockByProduct: Record<string, StockEntry>;
}) {
  const [filterBranch, setFilterBranch] = useState("all");
  const visibleBranches = filterBranch === "all" ? branches : filterBranch === "warehouse" ? [] : branches.filter(b => b.id === filterBranch);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterBranch("all")}
          className={["rounded-xl px-4 py-2 text-sm font-medium border transition",
            filterBranch === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          ].join(" ")}>
          Todas las sucursales
        </button>
        <button onClick={() => setFilterBranch("warehouse")}
          className={["rounded-xl px-4 py-2 text-sm font-medium border transition",
            filterBranch === "warehouse" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          ].join(" ")}>
          Almacén
        </button>
        {branches.map(b => (
          <button key={b.id} onClick={() => setFilterBranch(b.id)}
            className={["rounded-xl px-4 py-2 text-sm font-medium border transition",
              filterBranch === b.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            ].join(" ")}>
            {b.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Producto</th>
              {filterBranch === "all" && (
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Almacen</th>
              )}
              {filterBranch === "warehouse" && (
                <th className="text-right px-4 py-3 text-xs font-semibold text-orange-500 uppercase tracking-wide">Stock Almacen</th>
              )}
              {visibleBranches.map(b => (
                <th key={b.id} className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {b.name}
                </th>
              ))}
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-blue-600 uppercase tracking-wide whitespace-nowrap">Ventas hoy</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-indigo-600 uppercase tracking-wide whitespace-nowrap">Ventas mes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(p => {
              const stock = stockByProduct[p.id] ?? { warehouse: 0, branches: {}, soldToday: 0, soldTodayByBranch: {}, soldTodayWarehouse: 0, soldMonth: 0, soldMonthByBranch: {}, soldMonthWarehouse: 0 };
              const branchTotal = visibleBranches.reduce((s, b) => s + (stock.branches[b.id] ?? 0), 0);
              const total = filterBranch === "all"
                ? stock.warehouse + Object.values(stock.branches).reduce((s, q) => s + q, 0)
                : filterBranch === "warehouse"
                ? stock.warehouse
                : branchTotal;
              const low = total <= p.min_weekly_quantity;

              const ventasHoy = filterBranch === "all"
                ? stock.soldToday
                : filterBranch === "warehouse"
                ? stock.soldTodayWarehouse
                : (stock.soldTodayByBranch[filterBranch] ?? 0);

              const ventasMes = filterBranch === "all"
                ? stock.soldMonth
                : filterBranch === "warehouse"
                ? stock.soldMonthWarehouse
                : (stock.soldMonthByBranch[filterBranch] ?? 0);

              return (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                          <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-base">📦</div>
                      )}
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  {(filterBranch === "all" || filterBranch === "warehouse") && (
                    <td className="px-4 py-3.5 text-right text-gray-700">{stock.warehouse}</td>
                  )}
                  {visibleBranches.map(b => (
                    <td key={b.id} className="px-4 py-3.5 text-right text-gray-700">
                      {stock.branches[b.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-semibold ${low ? "text-red-600" : "text-gray-900"}`}>{total}</span>
                    {low && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">BAJO</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {ventasHoy > 0 ? <span className="font-semibold text-blue-600">-{ventasHoy}</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {ventasMes > 0 ? <span className="font-semibold text-indigo-600">-{ventasMes}</span> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/master/inventario/${p.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">
                      Editar →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}