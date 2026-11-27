// Gera os ícones do app (PNG simples: fundo verde com uma bola branca). Rode: node scripts/gerar-icones.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function bloco(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo), dados])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([len, corpo, crc])
}
function png(tam, mascarar) {
  const verde = [26, 127, 55], branco = [255, 255, 255]
  const linhas = []
  for (let y = 0; y < tam; y++) {
    const linha = Buffer.alloc(1 + tam * 3)
    for (let x = 0; x < tam; x++) {
      const dx = x + 0.5 - tam / 2, dy = y + 0.5 - tam / 2
      const d = Math.hypot(dx, dy)
      const raio = tam * (mascarar ? 0.2 : 0.28)
      const cor = d < raio ? branco : verde
      linha[1 + x * 3] = cor[0]; linha[2 + x * 3] = cor[1]; linha[3 + x * 3] = cor[2]
    }
    linhas.push(linha)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(Buffer.concat(linhas))), bloco('IEND', Buffer.alloc(0))])
}
writeFileSync('public/icon-192.png', png(192, false))
writeFileSync('public/icon-512.png', png(512, false))
writeFileSync('public/icon-maskable-512.png', png(512, true))
console.log('ícones gerados')
