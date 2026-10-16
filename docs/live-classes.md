# Aulas ao vivo com LiveKit

## Escopo

O Facilita agenda aulas por instituição, curso e turma. A coordenação escolhe uma turma e a divide em salas de 10 a 50 alunos (30 por padrão). Somente alunos ativos e vinculados ao curso e à turma no momento do agendamento entram no snapshot de salas. A coordenação atribui um professor ou monitor elegível e distinto por sala; uma aula não inicia com salas descobertas. Alunos autorizados entram apenas na sala atribuída, com câmera e microfone desligados inicialmente, mas podem ativá-los. Professores entram somente na sala sob sua responsabilidade; a coordenação pode entrar em qualquer sala. A listagem, o ingresso e o token são verificados pelo backend em cada ação; o nome da sala não contém identificadores em claro. O ingresso em uma sala não comprova presença acadêmica.

O snapshot não se atualiza automaticamente: se novos alunos entrarem na turma, é necessário reagendar a aula. Aulas criadas antes da migração de salas também devem ser reagendadas. Remover um aluno da turma impede novos tokens, mas não encerra imediatamente uma conexão de vídeo já estabelecida; revogação ativa deverá ser implementada antes de tratar remoções durante aulas como instantâneas.

O agendamento pode funcionar sem um servidor de mídia, mas `iniciar` e `entrar` retornam 503 enquanto o LiveKit não estiver configurado. Não oferecer aula como operacional antes de um teste real entre dois dispositivos.

## Piloto na VPS atual

Enquanto não houver clientes que demandem infraestrutura dedicada, `LIVE_PILOT_MODE=true` mantém um limite **global** entre instituições: uma aula por vez, uma sala por aula e até seis alunos na sala. A sala admite mais o responsável e uma pessoa da coordenação (máximo oito conexões). O agendamento impede horários sobrepostos; o início confere novamente a lotação e o uso simultâneo. A API `/live-sessions/capabilities` informa o limite à interface. O limite não comprova capacidade: a VPS tem somente 1 vCPU. Monitorar CPU, memória, tráfego e qualidade durante testes progressivos; interromper o piloto se prejudicar o aplicativo.

O serviço usa `ops/livekit-pilot/`, com imagem fixada por digest, 0,60 vCPU e 768 MiB. A sinalização é publicada via Caddy em `wss://live.facilitaestudos.com.br`; ICE usa TCP 7881 e UDP 7882 diretamente na VPS. A porta 7880 fica apenas na ponte local para o proxy. O piloto **não** oferece TURN/TLS; redes corporativas muito restritivas podem não conectar. Nunca prometer uso geral antes de testar os tipos de rede dos clientes.

Os segredos são gerados na VPS, fora do Git: `/opt/facilita/livekit/config/keys.yaml` e `/opt/facilita/livekit/backend.env`, com permissões `0600`. Este último é lido pelo Compose do aplicativo. `LIVEKIT_ROOM_AUTO_CREATE_DISABLED=true` só pode constar após confirmar `room.auto_create: false` na configuração instalada. O Compose mantém `LIVE_PILOT_MODE=true` por padrão; não desativar até migrar o serviço de mídia e realizar testes de carga. A configuração de Caddy na VPS inclui somente o host de sinalização; o tráfego WebRTC não passa pelo túnel HTTP.

Para reversão rápida do piloto, remover `backend.env` do caminho de leitura do Compose e reimplantar o backend para desativar emissão de tokens; encerrar aulas existentes antes de parar o LiveKit. Não remover a migration nem tabelas com dados. Há backup do banco e do Caddyfile anterior à instalação sob `/opt/facilita/backups/` na VPS; verificar cada backup antes de usá-lo numa restauração.

## Ativação operacional

Para turmas acima de 1.000 participantes, a escolha de produto é dividir a turma em salas menores, cada uma com professor ou monitor. Uma sala não deve reunir todo o curso. A divisão é uma regra de acesso, não uma garantia de capacidade: cada sala LiveKit fica em um único nó, e o conjunto de salas precisa de dimensionamento por carga simultânea. **O piloto na VPS atual não se aplica a essa escala.** A ampliação exige infraestrutura dedicada, ensaio de carga com o número real de salas/publicadores e monitoramento de CPU, memória, pacotes, banda e quedas. Para múltiplos nós LiveKit, Redis compartilhado e balanceamento são necessários; uma VPS dedicada isolada não deve ser prometida como suficiente para mais de 1.000 câmeras. Não contratar nem ativar uma instância apenas com base no número de alunos cadastrados.

1. Escolher servidor LiveKit dedicado ou instância com capacidade medida. **Não presumir** que o host do aplicativo suporta tráfego de vídeo. Planejar capacidade por participantes simultâneos, bitrate e gravação (se futuramente adotada).
2. Provisionar DNS e certificado TLS para um endereço próprio de mídia; `LIVEKIT_URL` deve usar `wss://`. O endpoint de sinalização HTTPS/WSS precisa estar acessível pelos navegadores.
3. Abrir/configurar as portas de mídia WebRTC e TURN conforme a topologia e a [documentação oficial de portas](https://docs.livekit.io/transport/self-hosting/ports-firewall/). Um túnel HTTP sozinho não substitui UDP/ICE. Testar redes móveis e NAT restrito.
4. Configurar `room.auto_create: false` no servidor LiveKit e verificar isso com teste de encerramento: um token emitido antes do fim não pode recriar a sala. Somente após confirmar a configuração no servidor, definir `LIVEKIT_ROOM_AUTO_CREATE_DISABLED=true` no backend. Essa variável é uma confirmação operacional, não uma detecção automática; configurá-la incorretamente reabre o risco.
5. Criar chave e segredo no LiveKit. Guardar `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` apenas como segredos do deploy do backend; nunca no frontend, no Git ou nos logs. Configurar também `LIVEKIT_URL`. O Compose os repassa vazios por padrão, mantendo a transmissão desativada.
6. Aplicar a migration versionada por `prisma migrate deploy` no fluxo existente. Fazer backup verificável do banco antes da implantação e confirmar saúde do backend.
7. Validar: coordenador agenda, divide e atribui todos os responsáveis; aula sem cobertura não inicia; professor sem permissão não gerencia; professor autorizado entra só na sala atribuída; aluno entra só na própria sala e pode ativar câmera/microfone; aluno de outra turma/tenant recebe 403; curso pago sem acesso recebe 403; encerramento desconecta todas as salas e impede novos tokens. Se uma preparação/encerramento for interrompido, a coordenação deve conseguir tentar novamente após um minuto. Testar câmera/microfone, compartilhamento de tela, redes diferentes e tela pequena.

Não há gravação automática, cobrança por chamada, relatório de presença ou moderação avançada nesta etapa. É necessário revisar retenção, privacidade e custos antes de adicionar gravação.

Referências: [self-hosting](https://docs.livekit.io/transport/self-hosting/), [tokens de acesso](https://docs.livekit.io/home/server/generating-tokens/) e [componentes React](https://docs.livekit.io/reference/components/react/installation/).
