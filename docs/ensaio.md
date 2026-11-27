# Ensaio de ponta a ponta e roteiro do dia 31/12

## A. Ensaio (faça antes de 31/12, com um bolão de teste)
Use um rascunho de teste. **Não congele** o bolão de teste (congelar não tem volta e reserva as combinações no concurso). Marque cada passo.

1. [ ] **Entrar com 2 passos.** Menu **Conta** → ativar a verificação em 2 passos → sair → entrar de novo com o código.
2. [ ] **Regras no banco.** Menu **Regras**: o aviso "ainda não há regras gravadas" não aparece (se aparecer, grave as regras padrão).
3. [ ] **Concursos.** Menu **Concursos** → **Atualizar pela Caixa** (entram os concursos novos). Confira que aparecem "Confirmado" ou "Aguardando confirmação" (confirme).
4. [ ] **Simulador.** 20 cotas × R$ 100 → plano com 7 jogos de 7 dezenas + 10 de 8 dezenas → **Usar este plano no gerador**.
5. [ ] **Gerador.** Gerar jogos → relatório com **329 combinações distintas, 0 repetidas**.
6. [ ] **Rascunho.** **Salvar como rascunho**.
7. [ ] **Participantes e cotas.** Inclua 2 pessoas de teste, com cotas (a soma não pode passar de 20; tente passar para ver a recusa). Marque **Pago** e **Via entregue**. Lance uma entrada e uma saída na **Caixinha**.
8. [ ] **Foto do recibo.** Anexe uma foto qualquer a um recibo (pode ser de teste), veja a foto, troque, remova.
9. [ ] **Link pessoal.** Em **Participantes**, **Gerar link** para a pessoa de teste e abra o link numa **janela anônima**: aparecem só as cotas dela. Clique em **Desligar** e recarregue: o link deixa de funcionar.
10. [ ] **Conferência.** No bolão, em **Conferência**, digite o concurso **3091** (já sorteado): aparece **SIMULAÇÃO**, os acertos e o valor por cota. Digite **3100**: avisa que ainda não existe.
11. [ ] **Chances.** Em **Chances do bolão**, calcule quina e quadra; clique em **Casas decimais** (2 a 5).
12. [ ] **Backup.** Menu **Backup** → baixar o .json e a planilha de pagamentos → conferir:

```powershell
node scripts/conferir-backup.mts "C:\Users\SEU_USUARIO\Downloads\backup-bolao-AAAA-MM-DD-HHMM.json"
```

13. [ ] **Auditoria.** Menu **Auditoria**: aparecem os eventos do ensaio.
14. [ ] **Limpeza.** Apague o rascunho de teste e os participantes de teste (primeiro remova as cotas deles).
15. [ ] **Segurança.** Rode o teste de segurança do banco e confira "tudo passou":

```powershell
$env:NODE_USE_SYSTEM_CA = '1'; node scripts/testar-rls.mts
```

## B. Roteiro do dia real
**Antes de abrir as cotas**
1. [ ] 2 passos ativos; regras gravadas; data limite 31/12/2026 22h confirmada no app da Caixa.
2. [ ] Simular → Gerar → Salvar como rascunho → revisar → **Congelar** (só quando os jogos forem definitivos).
3. [ ] Apostar na Caixa com exatamente os jogos congelados; **anexar a foto de cada recibo**.
4. [ ] Backup.

**Enquanto as cotas estão abertas**
5. [ ] Cadastrar participantes e cotas; marcar pagamentos e vias entregues; mandar o **link pessoal** de cada um.
6. [ ] Backup depois de mudanças grandes.

**Depois do sorteio**
7. [ ] **Concursos → Atualizar pela Caixa** até o concurso da Virada (3100) aparecer; confirmar.
8. [ ] Abrir o bolão → **Conferência** → valor por cota e por participante.
9. [ ] Backup final e guardar os recibos e as fotos.
