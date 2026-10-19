# Administração e atendimento da plataforma

O domínio `app.facilitaestudos.com.br` é a administração geral do Facilita, separada dos subdomínios das instituições. A conta `superadmin` é a proprietária e pode operar todas as áreas, criar outras contas de administrador geral e conceder acesso à equipe. Contas `platform_staff` podem ter uma ou mais áreas: suporte (`platform.support`), comercial (`platform.sales`) e financeiro (`platform.finance`). Permissões são verificadas no banco em cada operação, não apenas no menu nem no token salvo.

## Equipe

O administrador geral cria contas com nome, e-mail único, senha e áreas autorizadas. A senha exige ao menos 8 caracteres com letra, número e caractere especial (máximo de 72 bytes para bcrypt). É possível alterar áreas, redefinir a senha e desativar ou reativar contas. A própria conta não pode ser desativada; a última conta ativa de administrador geral também não pode. Contas da equipe Facilita não devem ser vinculadas a um tenant.

## Suporte às instituições

A coordenação ou um funcionário da instituição com `support.manage` pode abrir chamados, ver os chamados de sua própria instituição e responder. A equipe de suporte do Facilita vê chamados de todas as instituições, responde e altera situação (`OPEN`, `IN_PROGRESS`, `WAITING_INSTITUTION`, `RESOLVED`) e prioridade (`LOW`, `NORMAL`, `HIGH`). Todas as mensagens ficam vinculadas ao chamado; uma resposta da instituição o reabre. O acesso é filtrado pelo `tenantId` atual no banco.

## Comercial e financeiro

A equipe comercial acessa o quadro de leads recebidos pelo site. A equipe financeira acessa contratos, faturas internas e o panorama de assinaturas, mas não recebe permissão de editar o catálogo de planos, o cadastro de instituições ou usuários. O financeiro da instituição é outra área e não dá acesso ao financeiro do Facilita.

## Auditoria

O painel registra ações HTTP de escrita feitas por administradores gerais e equipe Facilita, com pessoa, perfil, método, caminho, resultado e data. Não registra senha, corpo da requisição, conteúdo de mensagens nem parâmetros da URL. Os 200 registros recentes ficam disponíveis somente ao administrador geral. Falhas também são registradas; uma indisponibilidade do mecanismo de auditoria não interrompe a resposta da operação, devendo ser monitorada operacionalmente.
