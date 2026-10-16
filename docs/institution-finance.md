# Financeiro da instituição

Este módulo registra mensalidades que a instituição cobra de seus alunos. É independente dos contratos em que o Facilita cobra da instituição e das liberações de cursos pagos avulsos. Nenhuma mensalidade é copiada automaticamente do preço por aluno do plano Facilita.

## Configuração

A instituição escolhe um dos modelos:

- **Mensalidade da escola:** valor padrão para os alunos, independentemente do curso.
- **Mensalidade por curso:** tabela própria, por exemplo um preço para Medicina e outro para Direito. O curso considerado é o vínculo principal atual da conta do aluno; acesso a cursos pagos adicionais não cria outra mensalidade regular.

Valores são armazenados em centavos. A configuração inclui competência inicial, dia de vencimento de 1 a 28 e dados do emitente para o documento. Alterar a tabela ou o modelo afeta somente emissões futuras. Um curso sem preço configurado não recebe automaticamente valor zero.

## Alunos, descontos e bolsas

Somente contas de alunos da própria instituição são consultadas. A emissão usa contas ativas. Um desconto individual em reais é limitado ao valor bruto da mensalidade e nunca produz valor negativo; esse desconto fixo não se reajusta automaticamente com o curso. Há também uma opção explícita de bolsa integral, que cobre 100% do valor bruto mesmo se a tabela mudar. A competência inicial individual, quando definida, complementa o início geral: não se emite antes de nenhum desses limites.

Uma mensalidade totalmente coberta pelo desconto fica isenta. Isenção não representa dinheiro recebido nem confirmação bancária. A criação de instituição ou aluno não gera cobranças automaticamente e não adiciona dados de demonstração.

## Cobranças

A emissão é uma ação manual para aluno e competência. O servidor calcula valor bruto, desconto e total usando os dados atuais e grava uma fotografia do nome do aluno, curso, emitente, instruções e valores. Existe uma única cobrança por instituição, aluno e mês, inclusive após cancelamento. Trocas posteriores de curso, nome ou tabela não recalculam o histórico.

Faturas abertas podem receber baixa manual ou cancelamento com referência/justificativa, identificação do operador e data. A baixa pressupõe conferência externa do recebimento. Não há conciliação, boleto bancário, Pix automático, estorno, juros, multa, envio de mensagens ou emissão agendada nesta etapa. O documento imprimível é uma fatura interna, não um boleto pagável.

## Acesso e isolamento

- Coordenação: configura valores e administra as cobranças da própria instituição.
- Funcionário: somente com a permissão explícita `finance.manage`, concedida na gestão de funcionários. O nome do departamento não concede acesso.
- Professor: não recebe acesso financeiro por permissões acadêmicas.
- Aluno: consulta apenas suas próprias mensalidades e documentos; não altera valores nem situação e não recebe justificativas internas dos operadores.

Cada requisição verifica o usuário atual, a conta ativa, o vínculo e a instituição ativa. Mutações repetem a verificação dentro da transação. Versões protegem alterações concorrentes; unicidade protege contra duplicação de dívidas. O superadmin continua usando o financeiro da plataforma, sem transformar seu perfil global em um funcionário de instituição.
