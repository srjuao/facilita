"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = exports.getChatHistory = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getChatHistory = async (req, res) => {
    try {
        const studentId = req.user?.studentId;
        if (!studentId) {
            return res.status(400).json({ error: 'Estudante não identificado.' });
        }
        const messages = await prisma.chatMessage.findMany({
            where: { studentId },
            orderBy: { createdAt: 'asc' }
        });
        return res.json(messages);
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar histórico do chat.' });
    }
};
exports.getChatHistory = getChatHistory;
const sendMessage = async (req, res) => {
    try {
        const studentId = req.user?.studentId;
        const { content } = req.body;
        if (!studentId)
            return res.status(400).json({ error: 'Estudante não identificado.' });
        if (!content)
            return res.status(400).json({ error: 'Mensagem não pode estar vazia.' });
        // Salva a mensagem do usuário
        const userMsg = await prisma.chatMessage.create({
            data: {
                role: 'me',
                content,
                studentId
            }
        });
        // Simulação de resposta inteligente baseada no contexto do curso
        const lower = content.toLowerCase();
        let aiResponse = '';
        if (lower.includes('resumo') || lower.includes('explique')) {
            aiResponse = `<b>Fisiologia Humana / Semiologia</b> é um ponto central no seu período. Em resumo: comece pelos conceitos essenciais e pratique a aplicação nos casos clínicos recomendados nas aulas.`;
        }
        else if (lower.includes('caso') || lower.includes('prático')) {
            aiResponse = `<b>Caso Clínico Exemplo:</b> Paciente apresenta sintomas típicos de alteração metabólica. Qual seria a sua conduta inicial de diagnóstico e quais exames solicitaria?`;
        }
        else {
            aiResponse = `Entendi a sua dúvida sobre "${content}". Esse conteúdo é abordado detalhadamente na <b>Aula 2 (min 08:15)</b> do seu módulo. Gostaria de um resumo direcionado para prova?`;
        }
        const aiMsg = await prisma.chatMessage.create({
            data: {
                role: 'ai',
                content: aiResponse,
                studentId
            }
        });
        return res.json({ userMessage: userMsg, aiMessage: aiMsg });
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao processar mensagem do chat.' });
    }
};
exports.sendMessage = sendMessage;
