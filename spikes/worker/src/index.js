// Teste 2 da Fase 0: um Worker da Cloudflare consegue falar com a Caixa?
// GET /?n=3086  -> consulta a Caixa pelo numero do concurso e devolve um resumo + de onde saiu a consulta.
// So aceita numeros de concurso (1 a 99999): nao e um proxy aberto.

const CAIXA = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const n = url.searchParams.get('n') ?? '3086'
    if (!/^\d{1,5}$/.test(n)) {
      return new Response(JSON.stringify({ erro: 'n deve ser um numero de concurso' }), { status: 400, headers: CORS })
    }

    const cf = request.cf ?? {}
    const origem = {
      // data center da Cloudflare que executou este Worker (e de onde saiu a consulta a Caixa)
      colo: cf.colo,
      paisDoDataCenter: cf.country, // pais do visitante; o data center costuma ser proximo
      regiaoDoVisitante: cf.region,
      placement: cf.placement ?? null,
      // preenchido pela Cloudflare quando o Worker foi redirecionado para a regiao pedida (ex.: remote-GRU)
      cfPlacement: request.headers.get('cf-placement'),
    }

    const t0 = Date.now()
    try {
      const resp = await fetch(CAIXA + n, { headers: { Accept: 'application/json' } })
      const texto = await resp.text()
      let resumo = null
      try {
        const j = JSON.parse(texto)
        resumo = j.numero
          ? { numero: j.numero, data: j.dataApuracao, dezenas: j.listaDezenas }
          : { mensagem: String(j.exceptionMessage ?? j.message ?? '').slice(0, 120) }
      } catch {
        resumo = { naoEraJson: texto.slice(0, 160) }
      }
      return new Response(
        JSON.stringify({ caixaStatus: resp.status, ms: Date.now() - t0, origem, resumo }),
        { status: 200, headers: CORS },
      )
    } catch (e) {
      return new Response(
        JSON.stringify({ caixaStatus: null, ms: Date.now() - t0, origem, erro: String(e) }),
        { status: 200, headers: CORS },
      )
    }
  },
}
