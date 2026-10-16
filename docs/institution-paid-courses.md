# Cursos pagos da instituição

## Escopo da primeira entrega

A instituição pode classificar cursos como incluídos ou pagos e definir preços em BRL. O catálogo exige autenticação: não existe vitrine pública nem venda para visitantes. Somente alunos cadastrados na mesma instituição podem solicitar acesso. Professores não configuram preços nem liberam acessos.

Esta entrega contempla cursos completos, não a venda avulsa de aulas/materiais. Não há gateway, checkout, boleto, captura de valor ou confirmação automática de pagamento. A solicitação registra interesse e o preço vigente naquele momento; não cria dívida, recibo ou pagamento.

## Ofertas e acesso

A coordenação utiliza **Cursos pagos e liberações**. Ofertas têm controle de versão: uma edição com versão antiga retorna conflito, preservando alterações de outro administrador. Transformar um curso incluído em pago requer confirmação explícita na interface e pode bloquear alunos sem liberação. Alterar preço não revoga liberações existentes.

Alunos utilizam **Cursos da instituição**, que apresenta cursos pagos da unidade, seu curso principal e cursos adicionais com acesso liberado. A liberação manual permite estudar um curso adicional sem mudar o vínculo acadêmico principal. Conteúdos incluídos do curso principal não exigem liberação e não podem ser bloqueados pela revogação de uma liberação manual; é preciso gerir o vínculo acadêmico para isso.

A coordenação libera ou revoga acesso com justificativa obrigatória. Cada alteração gera evento auditável com ator, aluno, curso, ação e data. Liberação não significa pagamento confirmado. O histórico não é exibido como receita ou mensalidade.

## Proteção no servidor

`/api/institution-commerce` exige sessão atual e instituição ativa. Pedidos e liberações validam os vínculos atuais dos atores no banco, inclusive dentro da transação. Não se aceita tenant informado pelo formulário como autorização.

O controle de conteúdo é aplicado a detalhes do curso, listas e detalhes de aulas, avaliações e reprodução de vídeos locais. Links de vídeo previamente assinados são revalidados a cada requisição; revogar acesso bloqueia novas requisições mesmo antes de expirar a assinatura. Isso não recupera arquivos já baixados nem substitui proteção do provedor de vídeos externos.

Permissões de conteúdo pago não substituem as funcionalidades do plano contratado pela instituição: vídeo/avaliações continuam sujeitos ao plano. Alunos não recebem dados de outros alunos ao abrir cursos adicionais.

## Migração e separação financeira

`20261016050000_paid_course_access` é aditiva. Cursos existentes continuam incluídos e com preço zero por padrão; não são gerados exemplos, cobranças ou liberações automáticas. Executar a migração antes da API nova.

Quando houver integração de pagamentos, a venda será receita da instituição e deverá usar a sua carteira recebedora. Ela não se confunde com o contrato que a instituição paga ao Facilita nem com a mensalidade acadêmica regular do aluno. Provedor, conciliação, cancelamentos e reembolsos serão definidos na etapa financeira própria.
