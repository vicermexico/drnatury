'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegistroBiored() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [celular, setCelular] = useState('')
  const [nip, setNip] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  const handleRegistro = async () => {
    if (!nombre || !celular || !nip) { setError('Todos los campos son obligatorios'); return }
    if (celular.length !== 10) { setError('El celular debe tener 10 digitos'); return }
    if (nip.length !== 4) { setError('El NIP debe ser de 4 digitos'); return }
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/registro-biored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, celular, nip })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al registrar'); setCargando(false); return }
      setExito(true)
    } catch {
      setError('Error de conexion')
    }
    setCargando(false)
  }

  if (exito) {
    return (
      <div className="max-w-md mx-auto space-y-6 text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Registro exitoso!</h2>
        <p className="text-gray-500 text-sm">{nombre} ya puede entrar a DrBioRed con su celular y NIP.</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => { setNombre(''); setCelular(''); setNip(''); setExito(false) }} className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl">
            Registrar otro
          </button>
          <button onClick={() => router.push('/terapeuta/dashboard')} className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl">
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Registrar en DrBioRed</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Nombre completo</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del nuevo miembro" className="border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Celular</label>
          <input type="tel" value={celular} onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) setCelular(v) }} placeholder="10 digitos" maxLength={10} className="border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">NIP (4 digitos)</label>
          <input type="password" value={nip} onChange={e => setNip(e.target.value)} placeholder="El nuevo miembro usara este NIP para entrar" maxLength={4} className="border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400" />
        </div>
      </div>

      <button onClick={handleRegistro} disabled={cargando} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 rounded-xl disabled:opacity-50">
        {cargando ? 'Registrando...' : 'Registrar en DrBioRed'}
      </button>

      <button onClick={() => router.push('/terapeuta/dashboard')} className="w-full text-gray-400 text-sm py-2">
        Cancelar
      </button>
    </div>
  )
}