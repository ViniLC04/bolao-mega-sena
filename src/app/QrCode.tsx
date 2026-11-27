import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/**
 * QR code como imagem SVG desenhada aqui (sem HTML solto, compatível com a política de segurança do site).
 * Sempre preto no branco, também no modo escuro, para o celular conseguir ler.
 */
export function QrCode({ texto, tamanho = 220, rotulo }: { texto: string; tamanho?: number; rotulo: string }) {
  const { n, caminho } = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(texto)
    q.make()
    const total = q.getModuleCount()
    const margem = 4
    let d = ''
    for (let r = 0; r < total; r++) {
      for (let c = 0; c < total; c++) {
        if (q.isDark(r, c)) d += `M${c + margem} ${r + margem}h1v1h-1z`
      }
    }
    return { n: total + margem * 2, caminho: d }
  }, [texto])

  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={tamanho} height={tamanho} role="img" aria-label={rotulo} shapeRendering="crispEdges" style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--borda)' }}>
      <rect width={n} height={n} fill="#fff" />
      <path d={caminho} fill="#000" />
    </svg>
  )
}
