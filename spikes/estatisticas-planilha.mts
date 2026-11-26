import { readFileSync } from 'node:fs'
import { lerPlanilhaXlsx } from '../src/data/planilha.ts'
const t0 = performance.now()
const c = lerPlanilhaXlsx(readFileSync('Dados/Mega-Sena.xlsx'))
console.log('tempo leitura (ms):', Math.round(performance.now() - t0))
console.log('primeira data:', c[0].data, '| ultima data:', c[c.length-1].data)
console.log('com ganhador sena:', c.filter(x => x.ganhadoresSena > 0).length)
console.log('com acumulado Virada > 0:', c.filter(x => x.acumuladoViradaCent > 0).length)
console.log('com observacao:', c.filter(x => x.observacao).length, '| exemplos:', JSON.stringify(c.filter(x => x.observacao).slice(0,3).map(x => [x.numero, x.observacao])))
console.log('arrecadacao zero:', c.filter(x => x.arrecadacaoCent === 0).length, '(primeiro com valor:', c.find(x => x.arrecadacaoCent>0)?.numero + ')')
console.log('Viradas (31/12 ou 01/01):', c.filter(x => /-(12-31|01-01)$/.test(x.data)).map(x => x.numero + '@' + x.data).join(' '))
