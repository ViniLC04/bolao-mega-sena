import { describe, expect, it } from 'vitest'
import { celulaCsv, conferirBackup, csvPagamentos, paraCsv, TABELAS_DO_BACKUP, type Backup } from '../src/app/backup'

function backupVazio(): Backup {
  const tabelas: Backup['tabelas'] = {}
  const contagens: Backup['contagens'] = {}
  for (const t of TABELAS_DO_BACKUP) {
    tabelas[t] = []
    contagens[t] = 0
  }
  return { versao: 1, gerado_em: '2026-11-27T00:00:00Z', tabelas, contagens }
}

describe('planilha CSV de pagamentos', () => {
  it('escapa ponto e vírgula, aspas e quebra de linha', () => {
    expect(celulaCsv('a;b')).toBe('"a;b"')
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""')
    expect(celulaCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"')
    expect(celulaCsv(null)).toBe('')
    expect(celulaCsv(5)).toBe('5')
  })
  it('começa com BOM e usa ponto e vírgula', () => {
    const csv = paraCsv([['a', 'b'], ['c', 'd']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿a;b\r\nc;d\r\n')
  })
  it('formata o valor em reais com vírgula e marca pago/via', () => {
    const csv = csvPagamentos([{ participante: 'Ana', contato: null, bolao: 'Virada', concurso: 3100, qtd: 2, valorDevidoCent: 20_050, pago: true, viaEntregue: false }])
    const linhas = csv.replace('﻿', '').trim().split('\r\n')
    expect(linhas[0]).toBe('Participante;Contato;Bolão;Concurso;Cotas;Valor devido (R$);Pago;Via entregue')
    expect(linhas[1]).toBe('Ana;;Virada;3100;2;200,50;sim;não')
  })
})

describe('conferência do arquivo de backup', () => {
  it('um backup vazio e bem formado passa', () => {
    expect(conferirBackup(backupVazio())).toEqual([])
  })
  it('detecta formato errado e contagem que não bate', () => {
    expect(conferirBackup(null)).not.toEqual([])
    expect(conferirBackup({ versao: 2 })).not.toEqual([])
    const b = backupVazio()
    b.contagens.cotas = 3
    expect(conferirBackup(b).join(' ')).toMatch(/cotas/)
  })
  it('detecta ligações quebradas (cota de participante ou bolão que não está no backup)', () => {
    const b = backupVazio()
    b.tabelas.cotas = [{ id: 'c1', participante_id: 'p?', bolao_id: 'b?' }]
    b.contagens.cotas = 1
    const e = conferirBackup(b).join(' ')
    expect(e).toMatch(/participante/)
    expect(e).toMatch(/bolão/)
  })
  it('ligações certas passam', () => {
    const b = backupVazio()
    b.tabelas.participantes = [{ id: 'p1' }]
    b.contagens.participantes = 1
    b.tabelas.bolaos = [{ id: 'b1' }]
    b.contagens.bolaos = 1
    b.tabelas.cotas = [{ id: 'c1', participante_id: 'p1', bolao_id: 'b1' }]
    b.contagens.cotas = 1
    expect(conferirBackup(b)).toEqual([])
  })
})
