import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { conjuntoCanonico, hashJogos, jogoCanonico } from '../../src/engine/hash'
import {
  atrasos,
  contarFaixasHistorico,
  filtrarPeriodo,
  frequencias,
  maisSorteadas,
  mascarasDe,
  percentil,
  somasDosSorteios,
  sugestaoSoma,
  type ConcursoHist,
} from '../../src/engine/historico'
import { mascaraBits } from '../../src/engine/combinatoria'
import { validarSenha } from '../../src/engine/validacoes'

const C = (numero: number, data: string, dezenas: number[]): ConcursoHist => ({ numero, data, dezenas })
const concursos: ConcursoHist[] = [
  C(1, '2020-03-10', [1, 2, 3, 4, 5, 6]),
  C(2, '2020-12-31', [1, 2, 3, 10, 20, 30]),
  C(3, '2021-12-31', [1, 2, 40, 41, 42, 43]),
  C(4, '2022-06-01', [60, 59, 58, 57, 56, 55]),
  C(5, '2024-12-31', [1, 10, 20, 30, 40, 50]),
]

describe('historico: filtro de período livre', () => {
  it('tudo, datas, concursos', () => {
    expect(filtrarPeriodo(concursos, { tipo: 'tudo' }).length).toBe(5)
    expect(filtrarPeriodo(concursos, { tipo: 'datas', de: '2020-12-31', ate: '2021-12-31' }).map((c) => c.numero)).toEqual([2, 3])
    expect(filtrarPeriodo(concursos, { tipo: 'datas', de: '2022-01-01' }).map((c) => c.numero)).toEqual([4, 5])
    expect(filtrarPeriodo(concursos, { tipo: 'concursos', de: 2, ate: 4 }).map((c) => c.numero)).toEqual([2, 3, 4])
  })
  it('"dezembro de qualquer ano"', () => {
    expect(filtrarPeriodo(concursos, { tipo: 'mes', mes: 12 }).map((c) => c.numero)).toEqual([2, 3, 5])
  })
  it('só Viradas (lista editável)', () => {
    expect(filtrarPeriodo(concursos, { tipo: 'viradas', numeros: [2, 5] }).map((c) => c.numero)).toEqual([2, 5])
  })
  it('últimos N anos até a data de referência', () => {
    expect(filtrarPeriodo(concursos, { tipo: 'ultimos_anos', anos: 2, referencia: '2024-12-31' }).map((c) => c.numero)).toEqual([5])
    expect(filtrarPeriodo(concursos, { tipo: 'ultimos_anos', anos: 3, referencia: '2024-12-31' }).map((c) => c.numero)).toEqual([4, 5])
  })
})

describe('historico: frequência, atraso e soma', () => {
  it('frequências e as X mais sorteadas (empate: dezena menor primeiro)', () => {
    const f = frequencias(concursos)
    expect(f[1]).toBe(4)
    expect(f[2]).toBe(3)
    expect(f[7]).toBe(0)
    expect(maisSorteadas(concursos, 3)).toEqual([1, 2, 3]) // 3, 10, 20, 30 e 40 empatam em 2: vence a menor
    expect(maisSorteadas(concursos, 5)).toEqual([1, 2, 3, 10, 20])
    expect(maisSorteadas(concursos, 0)).toEqual([])
  })
  it('atraso: 0 = saiu no último concurso; nunca saiu = todos os concursos', () => {
    const a = atrasos(concursos)
    expect(a[1]).toBe(0)
    expect(a[55]).toBe(1)
    expect(a[7]).toBe(5)
  })
  it('percentil por interpolação linear', () => {
    expect(percentil([10, 20, 30, 40, 50], 0)).toBe(10)
    expect(percentil([10, 20, 30, 40, 50], 50)).toBe(30)
    expect(percentil([10, 20, 30, 40, 50], 100)).toBe(50)
    expect(percentil([10, 20, 30, 40, 50], 25)).toBe(20)
    expect(percentil([10, 20, 30, 40, 50], 10)).toBeCloseTo(14, 10)
    expect(() => percentil([], 50)).toThrow(/sorteios/)
  })
  it('sugestão de soma P10–P90 escalada por k/6', () => {
    const somas = somasDosSorteios(concursos)
    expect(somas).toEqual([21, 66, 169, 345, 151])
    const s6 = sugestaoSoma(concursos, 6)
    const s12 = sugestaoSoma(concursos, 12)
    expect(s12.min).toBe(Math.floor(percentil(somas, 10) * 2))
    expect(s12.max).toBe(Math.ceil(percentil(somas, 90) * 2))
    expect(s12.max).toBeGreaterThan(s6.max)
  })
})

describe('historico: quinas e quadras que um jogo já teria feito', () => {
  it('confere com contagem direta', () => {
    const m = mascarasDe(concursos)
    const jogo = [1, 2, 3, 4, 5, 10, 20] // vs concurso 1: 5 acertos; vs 2: 1,2,3,10,20 = 5; vs 5: 1,10,20 = 3
    const [lo, hi] = mascaraBits(jogo)
    const direto = concursos.map((c) => c.dezenas.filter((d) => jogo.includes(d)).length)
    expect(contarFaixasHistorico(lo, hi, m)).toEqual({
      quinas: direto.filter((h) => h >= 5).length,
      quadras: direto.filter((h) => h >= 4).length,
    })
    expect(contarFaixasHistorico(lo, hi, m).quinas).toBe(2)
  })
})

describe('hash do conjunto de jogos (SHA-256)', () => {
  it('forma canônica: dezenas em ordem, 2 dígitos; jogos em ordem alfabética', () => {
    expect(jogoCanonico([35, 3, 20])).toBe('03-20-35')
    expect(conjuntoCanonico([[10, 2, 33], [1, 5, 9]])).toBe('01-05-09\n02-10-33')
  })

  it('bate com o SHA-256 calculado por outra ferramenta (node:crypto)', async () => {
    const jogos = [[3, 20, 35, 38, 43, 46], [1, 2, 3, 4, 5, 6, 7]]
    const esperado = createHash('sha256').update('01-02-03-04-05-06-07\n03-20-35-38-43-46').digest('hex')
    expect(await hashJogos(jogos)).toBe(esperado)
    expect(esperado).toHaveLength(64)
  })

  it('a ordem dos jogos e das dezenas não muda o hash; trocar uma dezena muda', async () => {
    const a = await hashJogos([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]])
    const b = await hashJogos([[12, 11, 10, 9, 8, 7], [6, 5, 4, 3, 2, 1]])
    const c = await hashJogos([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 13]])
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('validarSenha (SPEC 11)', () => {
  it('aceita senha forte', () => {
    expect(validarSenha('Abcdef1!xyz')).toEqual([])
    expect(validarSenha('Zz9_zzzz')).toEqual([])
  })
  it.each([
    ['abc', 4],
    ['12345678', 3],
    ['abcdefgh', 3],
    ['Abcdefgh', 2],
    ['Abcdefg1', 1], // as 5 que o servidor do Supabase recusou na Fase 0
  ])('recusa "%s" com %i problema(s)', (senha, quantos) => {
    expect(validarSenha(senha).length).toBeGreaterThanOrEqual(1)
    expect(validarSenha(senha).length).toBe(quantos)
  })
  it('mínimo de 8 caracteres', () => {
    expect(validarSenha('Ab1!xyz').join(' ')).toMatch(/8 caracteres/)
  })
})
