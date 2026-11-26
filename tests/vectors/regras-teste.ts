// Ajuda dos testes: lê o rules.json REAL do projeto (não uma cópia), como o app fará.
import { readFileSync } from 'node:fs'
import { regrasVigentes, type ArquivoRegras } from '../../src/engine/rules'

export const ARQUIVO_REGRAS = JSON.parse(readFileSync('rules.json', 'utf8')) as ArquivoRegras
export const REGRAS = regrasVigentes(ARQUIVO_REGRAS, '2026-11-26')
