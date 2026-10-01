"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantById = exports.getTenants = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getTenants = async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany({
            include: { courses: true }
        });
        return res.json(tenants);
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar faculdades' });
    }
};
exports.getTenants = getTenants;
const getTenantById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenant = await prisma.tenant.findUnique({
            where: { id },
            include: { courses: true }
        });
        if (!tenant)
            return res.status(404).json({ error: 'Faculdade não encontrada' });
        return res.json(tenant);
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar faculdade' });
    }
};
exports.getTenantById = getTenantById;
