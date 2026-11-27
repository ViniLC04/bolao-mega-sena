import manual from '../../../docs/manual-adm.md?raw'
import { Markdown } from '../Markdown'

/** Mostra o manual do organizador (docs/manual-adm.md) dentro do app, para ter à mão no celular. */
export function Ajuda() {
  return (
    <div style={{ maxWidth: 760 }}>
      <Markdown texto={manual} />
    </div>
  )
}
