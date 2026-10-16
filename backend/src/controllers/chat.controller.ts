import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getChatHistory = async (req: AuthRequest, res: Response) => {
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
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar histórico do chat.' });
  }
};

export const sendMessage = async (_req: AuthRequest, res: Response) => {
  // Entitlements alone do not configure an AI provider. Never fabricate an answer
  // or persist a message as successfully sent while integration is unavailable.
  return res.status(503).json({ error: 'O provedor de IA ainda não foi configurado. Nenhuma mensagem foi enviada.' });
};
