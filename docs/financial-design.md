# Financeiro da plataforma — cobrança interna sem gateway

Decisão atual do produto: implementar contratos e faturas internas no superadmin, mantendo a integração bancária para outra etapa. Não contratar provedor, emitir boletos bancários/Pix, chamar APIs financeiras ou movimentar valores. O documento imprimível é uma fatura de cobrança, sem código de barras ou linha digitável fictícios.

## Contrato e apuração mensal

Cada instituição pode ter um contrato financeiro com mínimo de alunos, preço por aluno em centavos, dia de vencimento (1 a 28), dados do contratante e do emitente e instruções de pagamento em texto. O contrato financeiro não altera automaticamente os recursos ou limites de acesso do plano vinculado.

A quantidade faturável é `max(mínimo contratado, contas de alunos ativas na emissão)`. Contam somente contas com perfil `aluno`, vinculadas à instituição e não desativadas; professores, coordenação, funcionários e registros acadêmicos legados sem conta não entram na apuração. A apuração é uma fotografia no momento da emissão, não o maior uso do mês nem uma média diária.

Exemplo de contrato definido pelo operador: mínimo de 1.000 alunos a R$ 4,30 por aluno. Com 800 ou 1.000 contas ativas, a cobrança é R$ 4.300,00; com 1.100, R$ 4.730,00. Esses valores não são criados automaticamente como contratos ou cobranças de clientes.

O superadmin escolhe a competência mensal para emitir. O vencimento usa o dia contratado dentro daquele mês. Não há agendador, envio automático de e-mail ou geração em lote. A fatura mantém os dados e preços da emissão, mesmo após alterações no contrato; repetir a emissão para a mesma instituição e competência não cria outra dívida.

## Operação e permissões

Somente uma conta superadmin atual e ativa pode consultar ou alterar o financeiro da plataforma. Coordenadores e funcionários de instituições não recebem acesso por pertencer a um departamento chamado Financeiro.

As faturas começam abertas. O atraso é calculado pelo vencimento; não representa uma confirmação de inadimplência bancária. A baixa manual exige referência/justificativa e registra o operador, assim como o cancelamento. Baixa manual é uma declaração do operador após conferência externa, não confirmação automática de um banco. Não há estorno bancário, juros, multa, rateio diário ou alteração retroativa do valor emitido.

Contrato e fatura têm controle de versão para evitar sobrescrita concorrente. Alterações de situação preservam histórico. Faturas canceladas permanecem no histórico e reservam a competência; não são apagadas para gerar cobranças duplicadas.

## Carteiras independentes

| Contexto | Quem cobra | Quem deve | Origem do valor |
| --- | --- | --- | --- |
| Plataforma | Facilita Estudos | Instituição/empresa contratante | Plano/contrato da plataforma |
| Mensalidade acadêmica | Instituição | Aluno cadastrado nela | Mensalidade definida pela instituição |
| Conteúdo pago | Instituição | Aluno cadastrado nela | Oferta de curso da instituição |

O preço por aluno do plano Facilita nunca deve ser usado automaticamente como mensalidade acadêmica. Cursos pagos não substituem as mensalidades regulares. O catálogo atual de cursos usa liberação manual auditada, não confirmação de pagamento.

## Telas e próximas etapas

- Financeiro do Facilita: contratos de instituições, competências, faturas, situação, impressão e histórico de baixas/cancelamentos manuais.
- Financeiro da instituição: valores de mensalidade por aluno/curso, vencimentos, parcelas, descontos e cancelamentos autorizados, além das vendas de conteúdo.
- Portal do aluno: apenas suas mensalidades e solicitações de cursos, sem acesso a dados de colegas.
- Departamentos e acessos: permissões futuras de consulta e gestão financeira, separadas de administração acadêmica e sem privilégios automáticos pelo nome do departamento.

Dados de contratantes, devedores, carteiras e títulos sempre terão proprietário explícito. Funcionário institucional não poderá consultar contratos da plataforma nem outras instituições. Funcionários do financeiro da plataforma precisarão de um perfil próprio: não se deve reutilizar o perfil institucional nem transformar funcionários em superadmin.

## Etapa futura de integração

Integração futura exigirá provedor escolhido pelo cliente, conta recebedora de cada carteira, idempotência, validação de notificações, conciliação e regras de cancelamento/reembolso. A confirmação do provedor deverá ser distinguida das baixas manuais existentes; retorno do navegador ou mera solicitação de acesso nunca confirmam pagamento.

Não há receita simulada, envio de boleto, comprovante bancário gerado nem gateway configurado. Financeiro acadêmico da instituição e portal de mensalidades dos alunos continuam planejados, separados destas faturas da plataforma.
