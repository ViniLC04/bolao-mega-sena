import type { ReactNode } from 'react'

// Símbolos de sorte desenhados à mão para este app (ilustrações ORIGINAIS, em traço fino). As cores vêm das
// variáveis do tema (classes .s-* em index.css), então valem para o modo claro e o escuro.

export type NomeSimbolo = 'trevo' | 'ferradura' | 'figa' | 'neko' | 'sapo' | 'bagua' | 'buda' | 'muruga'

const ROTULOS_SIMBOLOS: Record<NomeSimbolo, string> = {
  trevo: 'Trevo de quatro folhas',
  ferradura: 'Ferradura',
  figa: 'Figa',
  neko: 'Gato Maneki-Neko',
  sapo: 'Sapo da fortuna',
  bagua: 'Ba-gua',
  buda: 'Buda sorridente',
  muruga: 'Muruga: a lança vel, o pavão e o lótus',
}

function Moldura({ nome, tamanho, children }: { nome: NomeSimbolo; tamanho?: number; children: ReactNode }) {
  return (
    <svg className="simbolo" viewBox="0 0 64 64" width={tamanho} height={tamanho} aria-hidden="true" focusable="false" data-simbolo={nome}>
      {children}
    </svg>
  )
}

function Trevo({ tamanho }: { tamanho?: number }) {
  return (
    <Moldura nome="trevo" tamanho={tamanho}>
      <path className="s-linha" d="M32 34 C33 44 38 52 47 59" />
      <g transform="translate(32 32)">
        {[0, 90, 180, 270].map((a) => (
          <path key={a} className="s-folha" transform={`rotate(${a})`} d="M0 -3 C-11 -8 -13 -22 -6 -25 C-3 -26 0 -24 0 -21 C0 -24 3 -26 6 -25 C13 -22 11 -8 0 -3 Z" />
        ))}
      </g>
      <circle className="s-solido-ouro" cx="32" cy="32" r="2.4" />
    </Moldura>
  )
}

function Ferradura({ tamanho }: { tamanho?: number }) {
  const furos: [number, number][] = [
    [18, 21], [18, 28],
    [44.1, 41], [39, 46.1], [32, 48], [25, 46.1], [19.9, 41],
    [46, 21], [46, 28],
  ]
  return (
    <Moldura nome="ferradura" tamanho={tamanho}>
      <path className="s-ferradura-borda" d="M18 12 V34 A14 14 0 0 0 46 34 V12" />
      <path className="s-ferradura" d="M18 12 V34 A14 14 0 0 0 46 34 V12" />
      <path className="s-ferradura-brilho" d="M14.6 14 V34 A17.4 17.4 0 0 0 49.4 34 V14" />
      {furos.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="s-furo" cx={x} cy={y} r="1.7" />
      ))}
    </Moldura>
  )
}

function Figa({ tamanho }: { tamanho?: number }) {
  return (
    <Moldura nome="figa" tamanho={tamanho}>
      <rect className="s-ouro" x="22" y="51" width="22" height="8" rx="2.5" />
      <rect className="s-ouro" x="15" y="25" width="34" height="29" rx="11" />
      <path className="s-linha s-fino" d="M24 25 V34 M33 25 V33 M41.5 25 V34" />
      <rect className="s-ouro" x="22" y="14" width="9.5" height="22" rx="4.75" transform="rotate(-8 27 25)" />
      <path className="s-linha s-fino" d="M24.2 19.5 Q26.6 17 29 19.5" />
    </Moldura>
  )
}

function Neko({ tamanho }: { tamanho?: number }) {
  return (
    <Moldura nome="neko" tamanho={tamanho}>
      <path className="s-creme" d="M17 59 C12 44 18 34 32 34 C46 34 52 44 47 59 Z" />
      <rect className="s-creme" x="43" y="8" width="9" height="22" rx="4.5" transform="rotate(14 47.5 19)" />
      <circle className="s-solido-ouro" cx="50" cy="12.5" r="1.7" />
      <path className="s-creme" d="M19.5 20 L21 6 L31 13.5 Z" />
      <path className="s-creme" d="M44.5 20 L43 6 L33 13.5 Z" />
      <path className="s-folha s-fino" d="M22.5 14.5 L22.8 10.5 L26.5 13.4 Z" />
      <ellipse className="s-creme" cx="32" cy="24" rx="14" ry="12" />
      <path className="s-linha s-fino" d="M24.5 23.5 q2 -2.2 4 0 M35.5 23.5 q2 -2.2 4 0" />
      <circle className="s-solido-ouro" cx="32" cy="27.5" r="1.5" />
      <path className="s-linha s-fino" d="M29 30.5 q3 2.4 6 0 M18.5 26 L25 27 M18.5 30 L25 29.5 M45.5 26 L39 27 M45.5 30 L39 29.5" />
      <path className="s-ouro" d="M20 36 Q32 42 44 36 L43 40 Q32 46 21 40 Z" />
      <circle className="s-ouro" cx="32" cy="46" r="3.2" />
      <ellipse className="s-ouro" cx="23" cy="52" rx="5" ry="6.5" transform="rotate(-8 23 52)" />
      <path className="s-linha s-fino s-ouro-traco" d="M21 49 V55" />
    </Moldura>
  )
}

function Sapo({ tamanho }: { tamanho?: number }) {
  return (
    <Moldura nome="sapo" tamanho={tamanho}>
      <ellipse className="s-ouro" cx="32" cy="57" rx="23" ry="4.5" />
      <path className="s-linha" d="M16 46 Q11 55 21 55 M48 46 Q53 55 43 55" />
      <ellipse className="s-folha" cx="32" cy="43" rx="20" ry="13" />
      <circle className="s-solido-ouro" cx="22" cy="44" r="1.6" />
      <circle className="s-solido-ouro" cx="42" cy="44" r="1.6" />
      <circle className="s-solido-ouro" cx="32" cy="48" r="1.6" />
      <ellipse className="s-folha" cx="32" cy="30" rx="16" ry="10.5" />
      <circle className="s-folha" cx="22.5" cy="21.5" r="5.4" />
      <circle className="s-folha" cx="41.5" cy="21.5" r="5.4" />
      <circle className="s-solido" cx="22.5" cy="22" r="1.9" />
      <circle className="s-solido" cx="41.5" cy="22" r="1.9" />
      <path className="s-linha s-fino" d="M19 32 Q32 41 45 32" />
      <circle className="s-ouro" cx="32" cy="37" r="4.2" />
      <rect className="s-linha s-fino" x="30.4" y="35.4" width="3.2" height="3.2" />
    </Moldura>
  )
}

function Bagua({ tamanho }: { tamanho?: number }) {
  // Oito trigramas (de baixo para cima; 1 = linha inteira, 0 = linha partida).
  const trigramas = ['111', '110', '101', '100', '011', '010', '001', '000']
  const vertices = Array.from({ length: 8 }, (_, k) => {
    const a = ((22.5 + k * 45) * Math.PI) / 180
    return `${(32 + 29.5 * Math.cos(a)).toFixed(2)},${(32 + 29.5 * Math.sin(a)).toFixed(2)}`
  }).join(' ')
  return (
    <Moldura nome="bagua" tamanho={tamanho}>
      <polygon className="s-ouro" points={vertices} />
      {trigramas.map((t, k) => (
        <g key={k} transform={`translate(32 32) rotate(${k * 45 + 90})`}>
          {t.split('').map((linha, i) => {
            const y = -(26 - i * 4)
            return linha === '1' ? (
              <path key={i} className="s-linha" d="M-5.5 0 H5.5" transform={`translate(0 ${y})`} />
            ) : (
              <path key={i} className="s-linha" d="M-5.5 0 H-1.2 M1.2 0 H5.5" transform={`translate(0 ${y})`} />
            )
          })}
        </g>
      ))}
      <circle className="s-creme" cx="32" cy="32" r="10" />
      <path className="s-solido" d="M32 22 A10 10 0 0 1 32 42 A5 5 0 0 1 32 32 A5 5 0 0 0 32 22 Z" />
      <circle className="s-solido-claro" cx="32" cy="27" r="1.7" />
      <circle className="s-solido" cx="32" cy="37" r="1.7" />
    </Moldura>
  )
}

function Buda({ tamanho }: { tamanho?: number }) {
  return (
    <Moldura nome="buda" tamanho={tamanho}>
      <ellipse className="s-folha" cx="32" cy="59" rx="20" ry="3.4" />
      <ellipse className="s-ouro" cx="32" cy="43" rx="19" ry="16" />
      <path className="s-linha s-fino" d="M25 28 Q32 35 39 28" />
      <circle className="s-solido" cx="32" cy="46" r="1.3" />
      <circle className="s-solido-ouro" cx="32" cy="6.6" r="2.4" />
      <ellipse className="s-creme" cx="22.4" cy="19" rx="2.3" ry="5.4" />
      <ellipse className="s-creme" cx="41.6" cy="19" rx="2.3" ry="5.4" />
      <circle className="s-creme" cx="32" cy="17" r="9.4" />
      <path className="s-linha s-fino" d="M27.3 16.5 q1.8 -2.2 3.6 0 M33.1 16.5 q1.8 -2.2 3.6 0 M27.6 20.6 q4.4 4.6 8.8 0" />
      <path className="s-ouro" d="M43 31 Q51 26 59 31 L57 37 Q51 40 45 37 Z" />
      <circle className="s-creme" cx="45" cy="38" r="3.2" />
    </Moldura>
  )
}

function Muruga({ tamanho }: { tamanho?: number }) {
  const pena = (
    <g>
      <path className="s-linha" d="M31 55 C14 51 11 37 15 25" />
      <ellipse className="s-folha" cx="15" cy="21" rx="5.6" ry="7.6" transform="rotate(-12 15 21)" />
      <ellipse className="s-ouro" cx="15" cy="21.5" rx="2.9" ry="4.3" transform="rotate(-12 15 21.5)" />
      <circle className="s-solido" cx="15" cy="22" r="1.3" />
    </g>
  )
  return (
    <Moldura nome="muruga" tamanho={tamanho}>
      {pena}
      <g transform="translate(64 0) scale(-1 1)">{pena}</g>
      <path className="s-folha" transform="rotate(-42 32 62)" d="M32 62 C26 56 27 50 32 46 C37 50 38 56 32 62 Z" />
      <path className="s-folha" transform="rotate(42 32 62)" d="M32 62 C26 56 27 50 32 46 C37 50 38 56 32 62 Z" />
      <path className="s-ouro" d="M32 62 C26 56 27 50 32 46 C37 50 38 56 32 62 Z" />
      <path className="s-ouro-linha" d="M32 33 V50" />
      <path className="s-ouro" d="M32 3.5 C39.5 12 39.5 24 32 33 C24.5 24 24.5 12 32 3.5 Z" />
      <path className="s-linha s-fino" d="M32 10 V26" />
    </Moldura>
  )
}

const FIGURAS: Record<NomeSimbolo, (p: { tamanho?: number }) => ReactNode> = {
  trevo: Trevo,
  ferradura: Ferradura,
  figa: Figa,
  neko: Neko,
  sapo: Sapo,
  bagua: Bagua,
  buda: Buda,
  muruga: Muruga,
}

/** Um símbolo de sorte. `tamanho` em pixels (padrão: o que o CSS do lugar definir). */
export function Simbolo({ nome, tamanho }: { nome: NomeSimbolo; tamanho?: number }) {
  const Figura = FIGURAS[nome]
  return <Figura tamanho={tamanho} />
}

/** Fileira de medalhas com os símbolos (usada na capa). */
export function Friso({ nomes = ['trevo', 'ferradura', 'figa', 'neko', 'sapo', 'bagua', 'buda', 'muruga'] as NomeSimbolo[] }: { nomes?: NomeSimbolo[] }) {
  return (
    <div className="friso" role="img" aria-label={`Símbolos de sorte: ${nomes.map((n) => ROTULOS_SIMBOLOS[n]).join(', ')}`}>
      {nomes.map((n) => (
        <span key={n} className="medalha" title={ROTULOS_SIMBOLOS[n]}>
          <Simbolo nome={n} />
        </span>
      ))}
    </div>
  )
}
