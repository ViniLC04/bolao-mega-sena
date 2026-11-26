// Espera crescente depois de senhas erradas (SPEC 11, "bloqueio após tentativas erradas").
// PARCIAL: o Supabase já limita as tentativas por IP; esta espera na tela desencoraja chute em série, mas
// quem chama a API direto não passa por ela. Bloqueio de conta de verdade fica para a Fase 5.

/** Segundos de espera depois de `falhas` tentativas erradas seguidas: 0 nas 2 primeiras, depois 2, 4, 8… até 60. */
export function esperaAposFalhas(falhas: number): number {
  if (falhas < 3) return 0
  return Math.min(60, 2 ** (falhas - 2))
}
