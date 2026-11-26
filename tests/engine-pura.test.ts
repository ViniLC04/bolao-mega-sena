// O motor de regras precisa ser PURO (CLAUDE.md): sem rede, sem banco, sem tela, sem arquivos,
// e sem regra oficial fixa no código. Este teste lê os arquivos de src/engine/ e confere isso.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PASTA = 'src/engine'
const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

// Devolve o código sem comentários de linha e de bloco, para não confundir explicações com código.
function semComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('motor de regras puro (src/engine)', () => {
  it('há arquivos para conferir', () => {
    expect(arquivos.length).toBeGreaterThanOrEqual(9)
  })

  it.each(arquivos)('%s: não importa rede, arquivo, tela, banco nem navegador', (arq) => {
    const codigo = semComentarios(readFileSync(`${PASTA}/${arq}`, 'utf8'))
    const importacoes = [...codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const origem of importacoes) {
      // só pode importar outros arquivos do próprio motor
      expect(origem, `${arq} importa "${origem}"`).toMatch(/^\.\//)
    }
    const proibidos = [
      /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bwindow\b/, /\bdocument\./, /\blocalStorage\b/,
      /\bsessionStorage\b/, /\bnavigator\b/, /\bprocess\./, /\brequire\s*\(/, /\bsupabase\b/i, /\breact\b/i,
    ]
    for (const re of proibidos) expect(codigo, `${arq} usa ${re}`).not.toMatch(re)
  })

  it.each(arquivos)('%s: nenhuma regra oficial fixa no código (preço, mínimos, percentuais, totais)', (arq) => {
    const codigo = semComentarios(readFileSync(`${PASTA}/${arq}`, 'utf8'))
    // 600 (preço), 1800 (valor mínimo), 700 (cota mínima), 4379 (43,79%), 3000 (IR), 4200/8400/1260 (totais conhecidos)
    expect(codigo).not.toMatch(/(?<![\w.])(600|1800|700|4379|3000|4200|8400|1260)(?![\w.])/)
  })
})
