# Manual do organizador

Este manual explica, passo a passo, tudo o que você faz no app. Você não precisa saber programar. O app só funciona direito se você seguir a ordem da seção "O caminho completo".

## O caminho completo (resumo)

1. Entre no app e ative a verificação em 2 passos.
2. Grave as regras no banco (uma vez).
3. Atualize a lista de concursos.
4. Simule o bolão (quantas cotas, quanto gastar).
5. Gere os jogos.
6. Salve como rascunho, confira e congele.
7. Faça as apostas na Caixa com exatamente esses jogos e anexe a foto de cada recibo.
8. Cadastre os participantes, as cotas e os pagamentos.
9. Mande o link pessoal para cada participante.
10. Depois do sorteio, atualize os concursos e confira o resultado.
11. Faça o backup.

## 1. Entrar

1. Abra o endereço do app no navegador (computador ou celular).
2. Se estiver na página pública, clique em "Sou o organizador" no rodapé.
3. Digite o seu usuário (sem o @example.com) e a senha.
4. Se a verificação em 2 passos estiver ativa, abra o aplicativo autenticador no celular e digite o código de 6 números.

## 2. Ativar a verificação em 2 passos (faça já)

1. No menu, abra **Conta**.
2. No quadro "Verificação em 2 passos", clique em **Ativar**.
3. No celular, instale o Google Authenticator ou o Microsoft Authenticator.
4. No aplicativo, escolha adicionar conta e aponte a câmera para o quadrado que aparece na tela.
5. Digite o código de 6 números que o aplicativo mostrar e clique em **Confirmar e ativar**.
6. Daqui em diante o app pede o código toda vez que você entrar.

**Se você perder o celular:** abra o painel do Supabase, vá em Authentication, depois Users, clique no seu usuário e remova o fator. Entre só com a senha e ative de novo no celular novo.

## 3. Gravar as regras no banco (uma vez)

1. No menu, abra **Regras**.
2. Se aparecer o aviso amarelo "Ainda não há regras gravadas no banco", clique em **Gravar as regras padrão no banco**.
3. Confira a **data limite das apostas** (31/12/2026 às 22h). Se a Caixa mudar o horário, crie uma nova versão com a data nova.

## 3b. Bolão aberto (quando você ainda não sabe quantas cotas serão)

Use este caminho se você só tem o **valor da cota** e vai cadastrando as pessoas conforme elas confirmam. O número de cotas e os jogos só são definidos **depois** de fechar as inscrições.

1. Em **Bolões**, clique em **+ Novo bolão aberto**. Preencha o nome, o **valor da cota** (por exemplo 100,00), até quando as inscrições ficam abertas (por exemplo 20/12) e o concurso. Clique em **Criar bolão aberto**.
2. No bolão, em **Cotas e pagamentos**, cadastre as pessoas conforme confirmam. Não há limite de cotas enquanto estiver aberto. Depois da data de inscrição o app recusa cotas novas; você pode **mudar a data** no quadro "Inscrições abertas".
3. Mande o **link público do bolão** para o grupo (seção 10b): ele mostra quem entrou e quantas cotas, sem o número total de cotas por enquanto.
4. Quando passar a data, confira os pagamentos e clique em **Fechar inscrições e gerar os jogos**. O app mostra antes o orçamento (cotas × valor da cota) e se ele alcança o menor recibo possível. O número de cotas passa a ser o total cadastrado.
5. O **Simulador abre já preenchido** (número de cotas e valor da cota do bolão). Clique em **Usar este plano e gerar os jogos do bolão**, gere os jogos e clique em **Salvar os jogos no bolão**. A sobra do orçamento vai para a caixinha.
6. Daí em diante é como nos outros bolões: revisar, **congelar**, apostar na Caixa e anexar as fotos.

Se você fechou cedo demais, clique em **Reabrir as inscrições** (só enquanto os jogos ainda não foram salvos).

## 4. Concursos

1. No menu, abra **Concursos**.
2. Clique em **Atualizar pela Caixa**. O app busca os concursos novos. Como você é o organizador, se a segunda fonte confere, eles já entram "Confirmados".
3. Concursos que um visitante atualizou aparecem como "Aguardando confirmação". Confira as dezenas com o resultado oficial e clique em **Confirmar** (ou em **Rejeitar**, só para o último, se estiver errado).
4. Em "Concursos da Mega da Virada", clique em **Sugerir: sorteios de 31/12**, confira a lista e clique em **Gravar lista**.

## 4b. Mudar o título do bolão

Abra o bolão em **Bolões** e clique em **Mudar título**. Funciona também com o bolão congelado: só o título muda (jogos, recibos e a impressão digital continuam iguais) e a troca fica registrada na **Auditoria** (“título antigo” → “título novo”). Antes de usar, rode uma vez o SQL `supabase/migrations/011_renomear_bolao.sql`.

## 4c. Descrição e convite por WhatsApp

1. **Descrição:** ao criar o bolão aberto há o campo "Descrição" (até 500 letras). Depois, na tela do bolão, use **Editar descrição** (funciona também com o bolão congelado; a troca fica na Auditoria). Ela aparece para quem tem o link do bolão e na lista "Bolões disponíveis" dos apostadores. **Não coloque dados pessoais.**
2. **Convite:** no cartão "Link público do bolão" (com o link ligado), a seção **Convite por WhatsApp** já traz título, descrição, concurso, valor da cota, prazo e o link. Ajuste o texto se quiser e clique em **Enviar pelo WhatsApp** (escolha o contato ou o grupo) ou **Copiar mensagem**.
3. Antes de usar, rode uma vez o SQL `supabase/migrations/012_descricao_bolao.sql`.

## 5. Simulador

1. No menu, abra **Simulador**.
2. Escolha como pensar: **Tabela por cota** (você digita o valor da cota, ex.: 56,00, e vê de uma vez 2 a 100 cotas: arrecadado, máximo em jogos e sobra; dá para baixar em CSV e clicar em **Ver** numa linha), **Por valor** (quanto cada cota custa), **Por nº de cotas** ou **Inverso** (orçamento total). Atenção: o máximo em jogos nem sempre é o arrecadado "arredondado para R$ 6", porque cada recibo precisa de pelo menos R$ 7 por cota (ex.: 20 cotas de R$ 56 = R$ 1.120 → máximo R$ 1.092, sobra R$ 28).
3. Digite os números e veja os recibos, o valor de cada cota, a sobra para a caixinha e as chances.
4. Clique em **Usar este plano no gerador de jogos**.

## 6. Gerador de jogos

1. Na tela **Gerador**, deixe as premissas como estão (o padrão evita repetir combinações) ou marque as que quiser.
2. Clique em **Gerar jogos**.
3. Confira o relatório: "Repetidas" precisa ser 0.
4. Você pode **travar** um jogo de que gostou e clicar em **Gerar de novo**, ou **Trocar este jogo**.
5. A **semente** é o número que permite repetir exatamente a mesma geração. Guarde-a se quiser comprovar depois.

## 7. Salvar e congelar o bolão

1. Em **Salvar o bolão**, dê um nome e clique em **Salvar como rascunho**.
2. O rascunho pode ser apagado quando quiser (botão **Apagar rascunho**).
3. Quando os jogos estiverem aprovados, marque "Conferi os jogos e quero congelar" e clique em **Congelar bolão**.
4. **Congelar não tem volta.** Depois disso, os jogos não mudam nem são apagados, e as combinações ficam reservadas no concurso.

## 8. Apostar na Caixa e anexar a foto do recibo

1. Faça as apostas na lotérica ou no app da Caixa com exatamente os jogos congelados.
2. Tire uma foto nítida de cada recibo.
3. Na tela do bolão, em cada recibo, clique em **Anexar foto** e escolha a foto. Só você vê essas fotos.

## 9. Participantes, cotas e pagamentos

1. No menu, abra **Participantes** e inclua cada pessoa (nome e, se quiser, um contato).
2. Na tela do bolão, em **Cotas e pagamentos**, escolha o participante e a quantidade de cotas, e clique em **Incluir cotas**.
3. Quando a pessoa pagar, marque **Pago**. Quando entregar a via do recibo, marque **Via entregue**.
4. O app não deixa vender mais cotas do que o bolão tem, nem depois da data limite.

## 10. Link pessoal de cada participante

1. Em **Participantes**, na linha da pessoa, clique em **Gerar link**. O link é copiado.
2. Cole no WhatsApp e mande só para aquela pessoa.
3. Ela vê apenas as cotas, o valor e o bolão em que participa. Não vê ninguém mais.
4. **Novo** troca o link por outro (o antigo para de funcionar). **Desligar** apaga o acesso.

## 10b. Link público do bolão (para o grupo)

1. Abra o bolão em **Bolões** e vá ao quadro **Link público do bolão**.
2. Clique em **Gerar link público**. O link é copiado: cole no grupo do bolão.
3. Quem abrir vê o nome do bolão, o prazo, quantas cotas foram vendidas, o total arrecadado, **quem está no bolão (só o primeiro nome) e quantas cotas cada um tem**, e os jogos depois de congelados.
4. Não aparecem sobrenome, contato nem quem já pagou. Se dois participantes tiverem o mesmo primeiro nome, aparecem como "Ana (1)" e "Ana (2)".
5. **Gerar link novo** troca o endereço (o antigo para de funcionar). **Desligar** tira o acesso. Mande o link só para quem participa.

## 10e. Resumo para explicar no grupo (como apostar)
1. Abra o site e clique em **Apostar** (no topo ou na capa). Primeira vez: **Criar conta** (nome completo, WhatsApp, e-mail, senha).
2. Em **Bolões disponíveis** (Minha área), escolha o bolão → **Ver e participar** → cotas → pague pelo PIX e envie o comprovante.
3. O organizador confirma o pagamento; a pessoa acompanha em **Minha área**.
4. Quem recebeu um link (do bolão ou pessoal) abre com a conta aberta. Quem só quer olhar usa **Acompanhar os bolões** (sem conta).
Para um bolão aparecer em "Bolões disponíveis", marque **Listar para apostadores cadastrados** no cartão do link (seção 10d, item 5).

## 10d. Conta do apostador (histórico das cotas)

1. No menu do site, **Sou apostador** → **Criar conta** (nome completo, WhatsApp, e-mail e senha forte; nome e WhatsApp já vêm preenchidos nas inscrições). Não há confirmação nem recuperação de senha por e-mail.
2. Com a conta aberta, quem se inscreve em **Quero participar** já tem a inscrição ligada à conta. Quem já tinha um link pessoal abre esse link com a conta aberta e ele é ligado automaticamente. Em **Minha área** a pessoa vê todos os bolões, cotas, pagamento, PIX e jogos.
3. Um link pessoal só fica com **uma** conta (a primeira que o abriu logada).
4. **Perdeu o link pessoal?** Em **Participantes** copie o link dela e reenvie. **Esqueceu a senha?** No Supabase: Authentication → Users → clique nos três pontinhos do e-mail → **Send password recovery** não funciona sem e-mail configurado; use **Update user** e defina uma senha nova (passe para a pessoa por WhatsApp).
5. **Listar um bolão para quem tem conta (sem precisar do link):** abra o bolão, no cartão "Link público do bolão" marque **Listar para apostadores cadastrados**. O bolão aparece em **Minha área → Bolões abertos para participar** (só enquanto aberto e com o link ligado). Quem abre vê o mesmo que o link mostra: primeiro nome e cotas. Como qualquer pessoa pode criar conta, liste só quando isso for aceitável. Para esconder, desmarque a caixa.

## 10c. Inscrição pelo link, PIX e confirmação de pagamento

Com o bolão **aberto**, cada pessoa pode se inscrever sozinha, só para si mesma.

**Preparar (uma vez):**
1. Em **Conta → Recebimento por PIX**, cadastre sua chave, o nome, a cidade e o seu WhatsApp. Aparece um QR de exemplo (R$ 1,00): **leia com o app do seu banco (sem pagar)** e confira se o nome e a chave estão certos.
2. No bolão aberto, em **Link público do bolão**, gere o link e marque **Aceitar inscrições pelo link**. Escolha o máximo de cotas por pessoa (padrão 10).
3. Mande o link no grupo.

**O que a pessoa faz:** abre o link, clica em **Quero participar** (nome completo, WhatsApp, quantidade de cotas), cai na página pessoal dela com o **QR code e o PIX copia e cola já com o valor**, paga no banco e **envia o comprovante** (anexando no app ou pelo WhatsApp, com a mensagem pronta). Ela pode **aumentar** as cotas depois, nunca diminuir (só você diminui, em "Cotas e pagamentos → Alterar").

**O que você faz:**
1. Em **Cotas e pagamentos** aparecem os inscritos com a etiqueta "pelo link" e "0 de N pagas". Se enviou comprovante, há o botão **Ver**.
2. Confira no **seu banco** que o dinheiro caiu e clique em **Confirmar pagamento**. (O app não sabe sozinho se o PIX caiu: pessoa física não tem confirmação automática grátis.)
3. Quem não pagou fica **pendente** e **não entra** no bolão nem aparece na lista pública.

**Fechar as inscrições:** só as cotas com pagamento confirmado contam para o número de cotas. O app lista as pendências; marque **Descartar essas cotas ao fechar** para continuar (as pessoas ficam de fora; isso não volta). Depois siga para o Simulador como de costume.

**Cuidados:** o link do bolão é semi-público (quem o tem pode se cadastrar). Por isso há limites (uma inscrição por WhatsApp, 10 cotas, tentativas por hora) e nada vale até você confirmar o PIX. Se alguém aparecer com nome falso, simplesmente não confirme e descarte no fechamento.

## 11. Caixinha

Em **Caixinha**, dentro do bolão, o app mostra a sobra do arredondamento da cota. Lance entradas e saídas à parte com o motivo.

## 12. Depois do sorteio

1. Em **Concursos**, clique em **Atualizar pela Caixa** até o concurso da Virada aparecer.
2. Confirme o concurso, se estiver "Aguardando confirmação".
3. Abra o bolão e veja a **Conferência**: acertos de cada jogo, prêmio bruto, imposto, valor líquido por cota e o valor de cada participante.
4. Os valores usam sempre o **rateio oficial da Caixa**. Se o rateio ainda não saiu, o app avisa e não inventa valor.
5. Para ensaiar antes, digite outro concurso já sorteado (por exemplo 2955): aparece "SIMULAÇÃO".

## 13. Backup

1. No menu, abra **Backup** e clique em **Baixar backup (.json)**.
2. Guarde o arquivo numa pasta **privada** (ele tem nomes). Nunca no GitHub nem em grupo.
3. Faça backup depois de congelar, depois de registrar pagamentos e na véspera de 31/12.

## 14. Auditoria

Em **Auditoria** você vê quem criou, alterou ou apagou o quê, e quando. Serve para tirar dúvidas e conferir.

## 15. Problemas comuns

- **A Caixa não responde ao atualizar:** tente de novo mais tarde. O app não grava nada pela metade.
- **"Cotas demais":** o bolão já vendeu todas as cotas.
- **"A data limite já passou":** crie uma nova versão das regras com outra data limite.
- **Esqueci a senha:** painel do Supabase, Authentication, Users, e troque a senha do seu usuário.
- **O projeto parou (Supabase gratuito):** abra o painel do Supabase e reative o projeto. Abra o app ao menos uma vez por semana para ele não pausar.
- **Dúvida sobre segurança:** veja `docs/seguranca.md`.

## Lembretes importantes

- O prazo das apostas é 31/12/2026 às 22h (horário de Brasília). Confira o horário final no app da Caixa.
- **Estatísticas de sorteios passados não aumentam a chance de acerto.** Todo conjunto de 6 dezenas tem a mesma probabilidade.
- O valor do prêmio vem sempre do rateio oficial da Caixa. Qualquer estimativa é rotulada como tal.
