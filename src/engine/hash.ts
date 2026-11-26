// Hash do conjunto de jogos (SPEC 5): ao congelar o bolão, grava-se o SHA-256 dos jogos, para provar depois
// que ninguém mexeu neles. A forma canônica abaixo precisa ficar IGUAL para sempre: mudar uma vírgula
// muda todos os hashes já gravados.

/** Um jogo em forma canônica: dezenas em ordem crescente, com 2 dígitos, separadas por "-". Ex.: "03-20-35". */
export function jogoCanonico(dezenas: readonly number[]): string {
  return [...dezenas]
    .sort((a, b) => a - b)
    .map((d) => String(d).padStart(2, '0'))
    .join('-')
}

/** O conjunto de jogos em forma canônica: um jogo por linha, em ordem alfabética (a ordem dos jogos não importa). */
export function conjuntoCanonico(jogos: readonly (readonly number[])[]): string {
  return jogos
    .map(jogoCanonico)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join('\n')
}

/** SHA-256 (64 caracteres hexadecimais) do conjunto canônico. Usa o Web Crypto do navegador e do Node. */
export async function hashJogos(jogos: readonly (readonly number[])[]): Promise<string> {
  const bytes = new TextEncoder().encode(conjuntoCanonico(jogos))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
