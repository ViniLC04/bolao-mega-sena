// Gerador de jogos (SPEC 5) e cruzamento entre bolões (SPEC 6).
import { describe, expect, it } from 'vitest'
import { combinacoes } from '../../src/engine/combinatoria'
import {
  gerarJogos,
  gerarRelatorio,
  regerarJogo,
  type JogoGerado,
  type Premissas,
  type ReciboAlvo,
} from '../../src/engine/gerador'
import { contarFaixasHistorico, mascarasDe, type ConcursoHist } from '../../src/engine/historico'
import { combinacoesDistintas } from '../../src/engine/probabilidades'
import { criarRng, sortearDezenas } from '../../src/engine/random'
import { simularPorValor } from '../../src/engine/simulador'
import { validarJogo } from '../../src/engine/validacoes'
import { REGRAS } from './regras-teste'

const dezenasDe = (jogos: JogoGerado[]) => jogos.map((j) => j.dezenas)
const maiorSeq = (d: number[]) => {
  let m = 1
  let a = 1
  for (let i = 1; i < d.length; i++) {
    a = d[i] === d[i - 1] + 1 ? a + 1 : 1
    m = Math.max(m, a)
  }
  return m
}
const chaveCombos = (jogos: number[][]) => combinacoesDistintas(jogos)

describe('vetor de aceite da Fase 2: bolão de 20 cotas × R$ 100', () => {
  const linha = simularPorValor({ n: 20, cotaBaseCent: 10_000, perfil: 'menos_recibos' }, REGRAS)!
  const recibos: ReciboAlvo[] = linha.recibos.map(({ k, g }) => ({ k, g }))
  const premissas: Premissas = { maxIguais: { nMax: 5, escopo: 'concurso' } }

  it('o simulador entrega 7×7dez + 10×8dez, R$ 1.974 e 329 apostas', () => {
    expect(linha.gastoCent).toBe(197_400)
    expect(linha.apostasEquivalentes).toBe(329)
    expect(recibos.map((r) => `${r.g}x${r.k}`).sort()).toEqual(['10x8', '7x7'])
  })

  it('gera 17 jogos válidos, com 329 combinações distintas e 0 repetidas, em 20 sementes diferentes', () => {
    for (let semente = 1; semente <= 20; semente++) {
      const r = gerarJogos(recibos, premissas, {}, { semente })
      expect(r.ok).toBe(true)
      expect(r.jogos.length).toBe(17)
      for (const j of r.jogos) expect(validarJogo(j.dezenas, REGRAS)).toEqual([])
      const rel = r.relatorio!
      expect(rel.combinacoesEsperadas).toBe(329)
      expect(rel.combinacoesDistintas).toBe(329)
      expect(rel.repetidas).toBe(0)
      expect(rel.sobreposicaoMaxima).toBeLessThanOrEqual(5)
      expect(rel.senaUmEm).toBe(152_170)
      // cada recibo recebeu a quantidade certa de jogos, com o tamanho certo
      recibos.forEach((rc, i) => {
        const doRecibo = r.jogos.filter((j) => j.recibo === i)
        expect(doRecibo.length).toBe(rc.g)
        for (const j of doRecibo) expect(j.dezenas.length).toBe(rc.k)
      })
    }
  })

  it('sem premissa nenhuma (aleatório) também nunca repete combinação', () => {
    for (let semente = 1; semente <= 5; semente++) {
      const r = gerarJogos(recibos, {}, {}, { semente })
      expect(r.ok).toBe(true)
      expect(r.relatorio!.repetidas).toBe(0)
    }
  })

  it('o segundo bolão do mesmo concurso nunca repete combinação do primeiro', () => {
    const a = gerarJogos(recibos, premissas, {}, { semente: 100 })
    const b = gerarJogos(recibos, premissas, { jogosOutrosBoloes: dezenasDe(a.jogos) }, { semente: 200 })
    expect(b.ok).toBe(true)
    expect(b.relatorio!.repetidasComOutrosBoloes).toBe(0)
    expect(b.relatorio!.sobreposicaoMaximaComOutros).toBeLessThanOrEqual(5)
    expect(chaveCombos([...dezenasDe(a.jogos), ...dezenasDe(b.jogos)])).toBe(329 * 2)
  })

  it('mesmo sem a premissa de sobreposição, o mapa de combinações já cobertas exclui o primeiro bolão', () => {
    const a = gerarJogos(recibos, {}, {}, { semente: 7 })
    const b = gerarJogos(recibos, {}, { jogosOutrosBoloes: dezenasDe(a.jogos) }, { semente: 8 })
    expect(b.ok).toBe(true)
    expect(b.relatorio!.repetidasComOutrosBoloes).toBe(0)
    expect(chaveCombos([...dezenasDe(a.jogos), ...dezenasDe(b.jogos)])).toBe(a.relatorio!.combinacoesDistintas + b.relatorio!.combinacoesDistintas)
  })

  it('com a mesma semente dá o mesmo resultado; com outra, muda', () => {
    const x = gerarJogos(recibos, premissas, {}, { semente: 5 })
    const y = gerarJogos(recibos, premissas, {}, { semente: 5 })
    const z = gerarJogos(recibos, premissas, {}, { semente: 6 })
    expect(dezenasDe(x.jogos)).toEqual(dezenasDe(y.jogos))
    expect(dezenasDe(x.jogos)).not.toEqual(dezenasDe(z.jogos))
  })

  it('informa o progresso de 0 a 1 sem andar para trás', () => {
    const marcas: number[] = []
    gerarJogos(recibos, premissas, {}, { semente: 3, onProgresso: (f) => marcas.push(f) })
    expect(marcas.length).toBeGreaterThan(0)
    expect(marcas[marcas.length - 1]).toBe(1)
    expect([...marcas].sort((a, b) => a - b)).toEqual(marcas)
  })
})

describe('cada premissa, uma a uma', () => {
  const recibos: ReciboAlvo[] = [{ k: 7, g: 10 }, { k: 8, g: 5 }]
  const gerar = (p: Premissas, ctx = {}, rec = recibos, semente = 11) => {
    const r = gerarJogos(rec, p, ctx, { semente })
    expect(r.ok, r.motivo).toBe(true)
    return r
  }

  it('máx. consecutivos', () => {
    const r = gerar({ maxConsecutivos: { max: 1 } })
    for (const j of r.jogos) expect(maiorSeq(j.dezenas)).toBeLessThanOrEqual(1)
  })

  it('faixa de pares', () => {
    const r = gerar({ paresImpares: { minPares: 2, maxPares: 4 } })
    for (const j of r.jogos) {
      const pares = j.dezenas.filter((n) => n % 2 === 0).length
      expect(pares).toBeGreaterThanOrEqual(2)
      expect(pares).toBeLessThanOrEqual(4)
    }
  })

  it('soma mínima e máxima', () => {
    const r = gerar({ soma: { min: 150, max: 250 } })
    for (const j of r.jogos) {
      const s = j.dezenas.reduce((a, n) => a + n, 0)
      expect(s).toBeGreaterThanOrEqual(150)
      expect(s).toBeLessThanOrEqual(250)
    }
  })

  it('máx. por linha do volante (6 linhas de 10)', () => {
    const r = gerar({ linhas: { maxPorLinha: 2 } })
    for (const j of r.jogos) {
      const linhas = [0, 0, 0, 0, 0, 0]
      for (const n of j.dezenas) linhas[Math.floor((n - 1) / 10)]++
      expect(Math.max(...linhas)).toBeLessThanOrEqual(2)
    }
  })

  it('proibidos nunca aparecem', () => {
    const proibidos = Array.from({ length: 10 }, (_, i) => i + 1)
    const r = gerar({ proibidos: { dezenas: proibidos } })
    for (const j of r.jogos) for (const n of j.dezenas) expect(proibidos).not.toContain(n)
  })

  it('obrigatórios em todos os jogos', () => {
    const r = gerar({ obrigatorios: { dezenas: [5, 17], minJogos: 'todos' } })
    for (const j of r.jogos) {
      expect(j.dezenas).toContain(5)
      expect(j.dezenas).toContain(17)
    }
  })

  it('obrigatórios em pelo menos M jogos', () => {
    const r = gerar({ obrigatorios: { dezenas: [5, 17, 33], minJogos: 4 } })
    for (const d of [5, 17, 33]) {
      expect(r.jogos.filter((j) => j.dezenas.includes(d)).length).toBeGreaterThanOrEqual(4)
    }
    expect(r.relatorio!.avisos).toEqual([])
  })

  it('mais frequentes: restringir só usa as dezenas escolhidas', () => {
    const f = Array.from({ length: 20 }, (_, i) => i + 1)
    const r = gerar({ frequentes: { dezenas: f, modo: 'restringir' } })
    for (const j of r.jogos) for (const n of j.dezenas) expect(f).toContain(n)
    expect(r.relatorio!.avisos.join(' ')).toMatch(/reduz o número de combinações distintas/)
  })

  it('mais frequentes: ponderar favorece as dezenas escolhidas sem proibir as outras', () => {
    const f = Array.from({ length: 10 }, (_, i) => i + 1)
    const r = gerarJogos([{ k: 7, g: 10 }], { frequentes: { dezenas: f, modo: 'ponderar', peso: 8 } }, {}, { semente: 3 })
    expect(r.ok).toBe(true)
    const total = r.jogos.reduce((s, j) => s + j.dezenas.length, 0)
    const dentro = r.jogos.reduce((s, j) => s + j.dezenas.filter((n) => f.includes(n)).length, 0)
    expect(dentro / total).toBeGreaterThan(0.35) // sem peso seria ≈ 10/60 = 0,17
    expect(dentro).toBeLessThan(total) // as outras dezenas não foram proibidas
  })

  it('histórico: respeita o máximo de quinas e de quadras que o jogo já teria feito', () => {
    const rng = criarRng(99)
    const concursos: ConcursoHist[] = Array.from({ length: 800 }, (_, i) => ({ numero: i + 1, data: '2020-01-01', dezenas: sortearDezenas(rng, 6) }))
    const historico = mascarasDe(concursos)
    const r = gerar({ historico: { maxQuinas: 0, maxQuadras: 0 } }, { historico })
    for (const j of r.jogos) {
      const lo = j.dezenas.filter((n) => n <= 30).reduce((m, n) => m | (1 << (n - 1)), 0)
      const hi = j.dezenas.filter((n) => n > 30).reduce((m, n) => m | (1 << (n - 31)), 0)
      expect(contarFaixasHistorico(lo, hi, historico)).toEqual({ quinas: 0, quadras: 0 })
    }
  })

  it('máx. de números iguais dentro do recibo e entre os recibos do bolão', () => {
    const dentro = gerar({ maxIguais: { nMax: 4, escopo: 'recibo' } })
    for (const rc of [0, 1]) {
      const js = dentro.jogos.filter((j) => j.recibo === rc)
      for (let a = 0; a < js.length; a++)
        for (let b = a + 1; b < js.length; b++) expect(js[a].dezenas.filter((n) => js[b].dezenas.includes(n)).length).toBeLessThanOrEqual(4)
    }
    const bolao = gerar({ maxIguais: { nMax: 4, escopo: 'bolao' } })
    expect(bolao.relatorio!.sobreposicaoMaxima).toBeLessThanOrEqual(4)
  })

  it('todas as premissas juntas ainda geram', () => {
    const r = gerar({
      maxIguais: { nMax: 5, escopo: 'concurso' },
      maxConsecutivos: { max: 2 },
      paresImpares: { minPares: 2, maxPares: 5 },
      soma: { min: 120, max: 280 },
      linhas: { maxPorLinha: 3 },
      proibidos: { dezenas: [13, 14] },
    })
    for (const j of r.relatorio!.porJogo) for (const p of j.premissas) expect(p.ok, `${p.nome}`).toBe(true)
  })
})

describe('inviabilidade: o gerador diz qual premissa trava', () => {
  it('dezenas proibidas demais deixam o sorteio sem números', () => {
    const r = gerarJogos([{ k: 7, g: 3 }], { proibidos: { dezenas: Array.from({ length: 55 }, (_, i) => i + 1) } }, {}, { semente: 1 })
    expect(r.ok).toBe(false)
    expect(r.diagnostico!.culpadas).toContain('proibidos')
    expect(r.motivo).toMatch(/dezenas possíveis/)
  })

  it('obrigatórios que se sobrepõem aos proibidos', () => {
    const r = gerarJogos([{ k: 7, g: 3 }], { obrigatorios: { dezenas: [5], minJogos: 'todos' }, proibidos: { dezenas: [5] } })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/obrigatórios.*proibidos|proibidos.*obrigatórios/)
  })

  it('mais obrigatórios em todos os jogos do que dezenas no jogo', () => {
    const r = gerarJogos([{ k: 6, g: 2 }], { obrigatorios: { dezenas: [1, 2, 3, 4, 5, 6, 7], minJogos: 'todos' } })
    expect(r.ok).toBe(false)
    expect(r.diagnostico!.culpadas).toContain('obrigatorios')
  })

  it('premissa de consecutivos quase impossível para 20 dezenas: aponta "Máx. de números consecutivos"', () => {
    const r = gerarJogos([{ k: 20, g: 1 }], { maxConsecutivos: { max: 1 } }, {}, { semente: 4, tentativasPorJogo: 300, reinicios: 1 })
    expect(r.ok).toBe(false)
    expect(r.diagnostico!.culpadas).toEqual(['maxConsecutivos'])
    expect(r.motivo).toMatch(/Máx\. de números consecutivos/)
    const taxa = r.diagnostico!.taxas.find((t) => t.chave === 'maxConsecutivos')!
    expect(taxa.taxaAceitacao!).toBeLessThan(0.001)
    expect(taxa.viavelSemEla).toBe(true)
    expect(r.diagnostico!.aviso).toMatch(/reduz o número de combinações distintas/)
  })

  it('17 jogos de 7 dezenas sem NENHUMA dezena repetida não cabem em 60 números: aponta "Máx. de números iguais"', () => {
    const r = gerarJogos([{ k: 7, g: 17 }], { maxIguais: { nMax: 0, escopo: 'bolao' } }, {}, { semente: 2, tentativasPorJogo: 1000, reinicios: 3 })
    expect(r.ok).toBe(false)
    expect(r.diagnostico!.culpadas).toContain('maxIguais')
    expect(r.motivo).toMatch(/Máx\. de números iguais/)
  })

  it('combinação de premissas restritiva demais sem culpada única', () => {
    const p: Premissas = { paresImpares: { minPares: 7, maxPares: 7 }, soma: { min: 400, max: 410 } }
    const r = gerarJogos([{ k: 7, g: 2 }], p, {}, { semente: 1, tentativasPorJogo: 200, reinicios: 1 })
    expect(r.ok).toBe(false)
    expect(r.diagnostico!.culpadas.length).toBeGreaterThan(0)
  })
})

describe('travar e regerar', () => {
  const recibos: ReciboAlvo[] = [{ k: 7, g: 10 }]
  const premissas: Premissas = { maxIguais: { nMax: 5, escopo: 'concurso' } }

  it('jogos fixos (travados) ficam exatamente como estão', () => {
    const base = gerarJogos(recibos, premissas, {}, { semente: 1 })
    const travado: JogoGerado = { ...base.jogos[3], travado: true }
    const r = gerarJogos(recibos, premissas, {}, { semente: 2, fixos: [travado] })
    expect(r.ok).toBe(true)
    expect(r.jogos.length).toBe(10)
    expect(r.jogos.filter((j) => j.travado).map((j) => j.dezenas)).toEqual([travado.dezenas])
    expect(r.relatorio!.repetidas).toBe(0)
  })

  it('regerar troca só o jogo escolhido, mantém os outros e continua sem repetição', () => {
    const base = gerarJogos(recibos, premissas, {}, { semente: 1 })
    const r = regerarJogo(recibos, base.jogos, 4, premissas, {}, { semente: 77 })
    expect(r.ok).toBe(true)
    r.jogos.forEach((j, i) => {
      if (i !== 4) expect(j.dezenas).toEqual(base.jogos[i].dezenas)
    })
    expect(r.jogos[4].dezenas).not.toEqual(base.jogos[4].dezenas)
    expect(validarJogo(r.jogos[4].dezenas, REGRAS)).toEqual([])
    expect(r.relatorio!.repetidas).toBe(0)
    expect(r.relatorio!.sobreposicaoMaxima).toBeLessThanOrEqual(5)
  })

  it('jogo fixo que não combina com o recibo é recusado', () => {
    expect(() => gerarJogos(recibos, {}, {}, { fixos: [{ recibo: 0, dezenas: [1, 2, 3, 4, 5, 6], travado: true }] })).toThrow()
  })
})

describe('relatório', () => {
  it('mostra por jogo quais premissas foram atendidas e acusa repetição e sobreposição', () => {
    const jogos: JogoGerado[] = [
      { recibo: 0, dezenas: [1, 2, 3, 4, 5, 6, 7], travado: false },
      { recibo: 0, dezenas: [1, 2, 3, 4, 5, 6, 9], travado: false }, // divide 6 dezenas com o primeiro
      { recibo: 0, dezenas: [10, 20, 30, 40, 50, 60, 15], travado: false },
    ]
    const rel = gerarRelatorio(jogos, [{ k: 7, g: 3 }], { maxConsecutivos: { max: 2 }, maxIguais: { nMax: 5, escopo: 'bolao' } })
    expect(rel.sobreposicaoMaxima).toBe(6)
    expect(rel.parSobreposicao).toEqual([0, 1])
    expect(rel.combinacoesEsperadas).toBe(21)
    expect(rel.combinacoesDistintas).toBe(20) // {1..6} repete
    expect(rel.repetidas).toBe(1)
    const ok = (i: number, chave: string) => rel.porJogo[i].premissas.find((p) => p.chave === chave)!.ok
    expect(ok(0, 'maxConsecutivos')).toBe(false) // 1-2-3-4-5-6-7
    expect(ok(2, 'maxConsecutivos')).toBe(true)
    expect(ok(0, 'maxIguais')).toBe(false)
    expect(ok(2, 'maxIguais')).toBe(true)
    expect(rel.senaUmEm).toBe(Math.round(50_063_860 / 20))
  })

  it('combinações esperadas = Σ C(k,6)', () => {
    const jogos: JogoGerado[] = [{ recibo: 0, dezenas: [1, 2, 3, 4, 5, 6, 7, 8], travado: false }]
    expect(gerarRelatorio(jogos, [{ k: 8, g: 1 }]).combinacoesEsperadas).toBe(combinacoes(8, 6))
  })
})
