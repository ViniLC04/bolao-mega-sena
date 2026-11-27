import type { ReactNode } from 'react'

// Leitor mínimo de Markdown só para mostrar o manual do organizador no app: títulos (#, ##, ###), listas
// (- e 1.), parágrafos, **negrito** e `código`. Não executa HTML: tudo vira texto.

function emLinha(texto: string): ReactNode[] {
  const partes: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let ultimo = 0
  let i = 0
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index))
    const t = m[0]
    partes.push(t.startsWith('**') ? <strong key={i++}>{t.slice(2, -2)}</strong> : <code key={i++}>{t.slice(1, -1)}</code>)
    ultimo = m.index + t.length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}

export function Markdown({ texto }: { texto: string }) {
  const linhas = texto.split(/\r?\n/)
  const blocos: ReactNode[] = []
  let k = 0
  let i = 0
  while (i < linhas.length) {
    const l = linhas[i]
    if (l.trim() === '') {
      i++
      continue
    }
    const t = /^(#{1,3})\s+(.*)$/.exec(l)
    if (t) {
      const nivel = t[1].length
      const conteudo = emLinha(t[2])
      blocos.push(nivel === 1 ? <h1 key={k++}>{conteudo}</h1> : nivel === 2 ? <h2 key={k++}>{conteudo}</h2> : <h3 key={k++}>{conteudo}</h3>)
      i++
      continue
    }
    if (/^\s*\d+\.\s+/.test(l) || /^\s*-\s+/.test(l)) {
      const ordenada = /^\s*\d+\.\s+/.test(l)
      const itens: ReactNode[] = []
      while (i < linhas.length && (ordenada ? /^\s*\d+\.\s+/.test(linhas[i]) : /^\s*-\s+/.test(linhas[i]))) {
        itens.push(<li key={itens.length}>{emLinha(linhas[i].replace(/^\s*(\d+\.|-)\s+/, ''))}</li>)
        i++
      }
      blocos.push(ordenada ? <ol key={k++}>{itens}</ol> : <ul key={k++}>{itens}</ul>)
      continue
    }
    const par: string[] = []
    while (i < linhas.length && linhas[i].trim() !== '' && !/^(#{1,3}\s|\s*\d+\.\s|\s*-\s)/.test(linhas[i])) par.push(linhas[i++])
    blocos.push(<p key={k++}>{emLinha(par.join(' '))}</p>)
  }
  return <>{blocos}</>
}
