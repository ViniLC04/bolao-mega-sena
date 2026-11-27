import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Os mesmos cabeçalhos de segurança de public/_headers (valem em produção na Cloudflare) também valem no
// `vite preview`, para testar a política de segurança (CSP) localmente antes de publicar.
function cabecalhosDoSite(): Record<string, string> {
  const h: Record<string, string> = {}
  let bloco = ''
  for (const linha of readFileSync('public/_headers', 'utf8').split(/\r?\n/)) {
    if (/^\S/.test(linha)) bloco = linha.trim()
    else if (bloco === '/*') {
      const m = /^\s+([\w-]+):\s*(.+)$/.exec(linha)
      if (m) h[m[1]] = m[2].trim()
    }
  }
  return h
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: { headers: cabecalhosDoSite() },
})
