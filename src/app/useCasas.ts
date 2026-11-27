import { useState } from 'react'

export const CASAS_MIN = 2
export const CASAS_MAX = 5

/** Quantas casas decimais mostrar nas chances: começa em 2, cada clique em "mais casas" soma 1 até 5 e volta a 2. */
export function useCasas() {
  const [casas, setCasas] = useState(CASAS_MIN)
  return { casas, maisCasas: () => setCasas((c) => (c >= CASAS_MAX ? CASAS_MIN : c + 1)) }
}
