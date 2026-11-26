export function EmConstrucao({ titulo, etapa }: { titulo: string; etapa: string }) {
  return (
    <>
      <h1>{titulo}</h1>
      <p className="card muted">Esta tela será construída na {etapa} da Fase 2.</p>
    </>
  )
}
