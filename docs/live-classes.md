# Aulas ao vivo com LiveKit

## Escopo

O Facilita agenda aulas por instituição, curso e turma. A coordenação agenda; a coordenação e professores com a permissão `live.manage` podem iniciar, entrar e encerrar. Alunos autorizados entram como espectadores. A listagem, o ingresso e o token são sempre verificados pelo backend em cada ação; o nome da sala não contém identificadores em claro. O ingresso em uma sala não comprova presença acadêmica.

O agendamento pode funcionar sem um servidor de mídia, mas `iniciar` e `entrar` retornam 503 enquanto o LiveKit não estiver configurado. Não oferecer aula como operacional antes de um teste real entre dois dispositivos.

## Ativação operacional

1. Escolher servidor LiveKit dedicado ou instância com capacidade medida. **Não presumir** que o host do aplicativo suporta tráfego de vídeo. Planejar capacidade por participantes simultâneos, bitrate e gravação (se futuramente adotada).
2. Provisionar DNS e certificado TLS para um endereço próprio de mídia; `LIVEKIT_URL` deve usar `wss://`. O endpoint de sinalização HTTPS/WSS precisa estar acessível pelos navegadores.
3. Abrir/configurar as portas de mídia WebRTC e TURN conforme a topologia e a [documentação oficial de portas](https://docs.livekit.io/transport/self-hosting/ports-firewall/). Um túnel HTTP sozinho não substitui UDP/ICE. Testar redes móveis e NAT restrito.
4. Configurar `room.auto_create: false` no servidor LiveKit e verificar isso com teste de encerramento: um token emitido antes do fim não pode recriar a sala. Somente após confirmar a configuração no servidor, definir `LIVEKIT_ROOM_AUTO_CREATE_DISABLED=true` no backend. Essa variável é uma confirmação operacional, não uma detecção automática; configurá-la incorretamente reabre o risco.
5. Criar chave e segredo no LiveKit. Guardar `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` apenas como segredos do deploy do backend; nunca no frontend, no Git ou nos logs. Configurar também `LIVEKIT_URL`. O Compose os repassa vazios por padrão, mantendo a transmissão desativada.
6. Aplicar a migration versionada por `prisma migrate deploy` no fluxo existente. Fazer backup verificável do banco antes da implantação e confirmar saúde do backend.
7. Validar: coordenador agenda/inicia, professor sem permissão não gerencia, professor autorizado participa, aluno da turma assiste, aluno de outra turma/tenant recebe 403, curso pago sem acesso recebe 403, encerramento desconecta participantes e impede novos tokens. Se uma preparação/encerramento for interrompido, a coordenação deve conseguir tentar novamente após um minuto. Testar câmera/microfone, compartilhamento de tela, redes diferentes e tela pequena.

Não há gravação automática, cobrança por chamada, relatório de presença ou moderação avançada nesta etapa. É necessário revisar retenção, privacidade e custos antes de adicionar gravação.

Referências: [self-hosting](https://docs.livekit.io/transport/self-hosting/), [tokens de acesso](https://docs.livekit.io/home/server/generating-tokens/) e [componentes React](https://docs.livekit.io/reference/components/react/installation/).
