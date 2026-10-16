# Desenho financeiro — sem integração nesta etapa

Decisão do produto: apenas desenhar o financeiro por enquanto. Não contratar provedor, emitir boletos/Pix, chamar APIs financeiras ou movimentar valores. As telas financeiras existentes exibem a base contratada e não constituem faturas.

## Carteiras independentes

| Contexto | Quem cobra | Quem deve | Origem do valor |
| --- | --- | --- | --- |
| Plataforma | Facilita Estudos | Instituição/empresa contratante | Plano/contrato da plataforma |
| Mensalidade acadêmica | Instituição | Aluno cadastrado nela | Mensalidade definida pela instituição |
| Conteúdo pago | Instituição | Aluno cadastrado nela | Oferta de curso da instituição |

O preço por aluno do plano Facilita nunca deve ser usado automaticamente como mensalidade acadêmica. Cursos pagos não substituem as mensalidades regulares. O catálogo atual de cursos usa liberação manual auditada, não confirmação de pagamento.

## Telas planejadas

- Financeiro do Facilita: contratos de instituições, competências, títulos previstos, situação e histórico.
- Financeiro da instituição: valores de mensalidade por aluno/curso, vencimentos, parcelas, descontos e cancelamentos autorizados, além das vendas de conteúdo.
- Portal do aluno: apenas suas mensalidades e solicitações de cursos, sem acesso a dados de colegas.
- Departamentos e acessos: permissões futuras de consulta e gestão financeira, separadas de administração acadêmica e sem privilégios automáticos pelo nome do departamento.

Dados de contratantes, devedores, carteiras e títulos sempre terão proprietário explícito. Funcionário institucional não poderá consultar contratos da plataforma nem outras instituições. Funcionários do financeiro da plataforma precisarão de um perfil próprio: não se deve reutilizar o perfil institucional nem transformar funcionários em superadmin.

## Etapa futura de integração

O ciclo de título deverá distinguir rascunho, aberto, vencido, liquidado e cancelado, com histórico auditável. Estado de pagamento não será derivado de clique, retorno do navegador ou mera solicitação de acesso. Integração futura exigirá provedor escolhido pelo cliente, conta recebedora de cada carteira, idempotência, validação de notificações, conciliação e regras de cancelamento/reembolso.

Nenhuma tabela de cobrança ou estado fictício de pagamento é criada por este desenho. Não há receita simulada, envio de boleto, comprovante gerado nem gateway configurado nesta entrega.
