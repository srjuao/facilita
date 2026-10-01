"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLessonById = exports.getLessonsByModule = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getLessonsByModule = async (req, res) => {
    try {
        const { moduleId } = req.query;
        const lessons = await prisma.lesson.findMany({
            where: moduleId ? { moduleId: String(moduleId) } : undefined,
            include: { module: true }
        });
        return res.json(lessons);
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar aulas' });
    }
};
exports.getLessonsByModule = getLessonsByModule;
const getLessonById = async (req, res) => {
    try {
        const { id } = req.params;
        const lesson = await prisma.lesson.findUnique({
            where: { id },
            include: { module: { include: { lessons: true } } }
        });
        if (!lesson)
            return res.status(404).json({ error: 'Aula não encontrada' });
        return res.json(lesson);
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar detalhes da aula' });
    }
};
exports.getLessonById = getLessonById;
