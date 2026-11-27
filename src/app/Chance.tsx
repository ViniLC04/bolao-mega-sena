import { formatarPct, formatarUmEm } from './formato'
import { CASAS_MAX, useCasas } from './useCasas'

/** Botão que aumenta as casas decimais (de 2 até 5; no fim volta a 2). */
export function BotaoCasas({ casas, aoClicar }: { casas: number; aoClicar: () => void }) {
  return (
    <button type="button" className="secundario pequeno" onClick={aoClicar} title="Mostrar mais casas decimais nas chances">
      {casas >= CASAS_MAX ? `Casas decimais: ${casas} (voltar a 2)` : `Casas decimais: ${casas} (mostrar mais)`}
    </button>
  )
}

/** Uma chance como "2,58%" e "1 em 39". Com `margem` (fração, 95%) mostra também "± x". */
export function Chance({ p, casas, margem }: { p: number; casas: number; margem?: number }) {
  return (
    <span>
      {formatarPct(p, casas)}
      {margem !== undefined && <span className="muted pequeno"> (± {(margem * 100).toFixed(casas).replace('.', ',')})</span>}
      <br />
      <span className="muted pequeno">{formatarUmEm(p)}</span>
    </span>
  )
}

/** Chance isolada, com o próprio botão de casas decimais. */
export function ChanceExpansivel({ p }: { p: number }) {
  const { casas, maisCasas } = useCasas()
  return (
    <span>
      <strong>{formatarPct(p, casas)}</strong> <span className="muted">({formatarUmEm(p)})</span>{' '}
      <button type="button" className="secundario pequeno" onClick={maisCasas} title="Mostrar mais casas decimais">
        {casas >= CASAS_MAX ? 'menos casas' : '+ casas'}
      </button>
    </span>
  )
}
