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
// Trevo de quatro folhas (quatro círculos) branco sobre verde, com um ponto dourado no centro.
function corDoPonto(px, py, tam, escala) {
  const verde = [37, 120, 74], branco = [255, 255, 255], ouro = [212, 168, 47]
  const dx = px - tam / 2, dy = py - tam / 2
  if (Math.hypot(dx, dy) < tam * 0.045 * escala) return ouro
  const r = tam * 0.17 * escala, c = tam * 0.15 * escala
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) if (Math.hypot(dx - sx * c, dy - sy * c) < r) return branco
  return verde
}

function png(tam, mascarar) {
  const escala = mascarar ? 0.78 : 1
  const linhas = []
  const S = 3 // 3x3 amostras por pixel, para as bordas ficarem suaves
  for (let y = 0; y < tam; y++) {
    const linha = Buffer.alloc(1 + tam * 3)
    for (let x = 0; x < tam; x++) {
      let r = 0, g = 0, b = 0
      for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
        const c = corDoPonto(x + (i + 0.5) / S, y + (j + 0.5) / S, tam, escala)
        r += c[0]; g += c[1]; b += c[2]
      }
      linha[1 + x * 3] = Math.round(r / (S * S)); linha[2 + x * 3] = Math.round(g / (S * S)); linha[3 + x * 3] = Math.round(b / (S * S))
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
