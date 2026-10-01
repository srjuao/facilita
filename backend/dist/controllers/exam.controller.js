"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExams = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getExams = async (req, res) => {
    try {
        const { courseId } = req.query;
        const exams = await prisma.exam.findMany({
            where: courseId ? { courseId: String(courseId) } : undefined,
            include: { questions: true }
        });
        return res.json(exams.map(e => ({
            ...e,
            questions: e.questions.map(q => ({
                ...q,
                alts: JSON.parse(q.alts || '[]'),
                dist: JSON.parse(q.dist || '[]')
            }))
        })));
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar simulados' });
    }
};
exports.getExams = getExams;
