import { NextResponse } from 'next/server'

const VICTOR_ID = '4f8321e1-53ea-4b00-a6d0-311640bc2002'
const BIORED_URL = 'https://www.drbiored.com'

export async function POST(request: Request) {
  try {
    const { nombre, celular, nip } = await request.json()
    const res = await fetch(BIORED_URL + '/api/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, celular, nip, ref: VICTOR_ID })
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Error al registrar' }, { status: res.status })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Error de conexion con DrBioRed' }, { status: 500 })
  }
}