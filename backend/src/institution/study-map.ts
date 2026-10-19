import { Router, Response } from 'express';
import { InstitutionRequest, institutionDb as db, requireInstitutionSession } from './policy';

export const studyMapRouter = Router();
studyMapRouter.use(requireInstitutionSession);

type Node = { id: string; title: string; description: string; parentId: string | null; x: number; y: number; color: string };
const validNode = (node: unknown): node is Node => {
  if (!node || typeof node !== 'object') return false;
  const item = node as Partial<Node>;
  return typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id)
    && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 100
    && typeof item.description === 'string' && item.description.length <= 500
    && (item.parentId === null || typeof item.parentId === 'string')
    && typeof item.x === 'number' && Number.isFinite(item.x) && item.x >= 0 && item.x <= 2400
    && typeof item.y === 'number' && Number.isFinite(item.y) && item.y >= 0 && item.y <= 1800
    && typeof item.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.color);
};
const validTree = (nodes: Node[]) => {
  const byId = new Map(nodes.map(node => [node.id, node]));
  if (byId.size !== nodes.length) return false;
  return nodes.every(node => {
    if (node.parentId && !byId.has(node.parentId)) return false;
    let current: Node | undefined = node;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current.id)) return false;
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return true;
  });
};
const resolveCourse = async (req: InstitutionRequest, res: Response, editing: boolean) => {
  const actor = req.institution;
  if (!actor?.tenantId || !['coord', 'professor', 'aluno'].includes(actor.role)) {
    res.status(403).json({ error: 'Acesso não autorizado.' }); return null;
  }
  if (editing && actor.role !== 'coord' && (actor.role !== 'professor' || !actor.permissions.includes('content.manage'))) {
    res.status(403).json({ error: 'A coordenação precisa liberar a gestão de conteúdo para este professor.' }); return null;
  }
  const courseId = req.params.courseId;
  if (actor.role !== 'coord' && actor.courseId !== courseId) {
    res.status(403).json({ error: 'Este curso não está vinculado à sua conta.' }); return null;
  }
  const course = await db.course.findFirst({ where: { id: courseId, tenantId: actor.tenantId }, select: { id: true, nome: true } });
  if (!course) res.status(404).json({ error: 'Curso não encontrado nesta instituição.' });
  return course;
};

studyMapRouter.get('/courses/:courseId', async (req: InstitutionRequest, res) => {
  try {
    const course = await resolveCourse(req, res, false); if (!course) return;
    const map = await db.studyMap.findUnique({ where: { courseId: course.id } });
    const canEdit = req.institution!.role === 'coord' || (req.institution!.role === 'professor' && req.institution!.permissions.includes('content.manage'));
    res.json({ course, canEdit, map: map && (canEdit || map.published) ? map : null });
  } catch { res.status(500).json({ error: 'Não foi possível carregar o mapa.' }); }
});

studyMapRouter.put('/courses/:courseId', async (req: InstitutionRequest, res) => {
  try {
    const course = await resolveCourse(req, res, true); if (!course) return;
    const { title, description, nodes, theme, backgroundColor, cardShape, connectorStyle, published, version } = req.body;
    if (typeof title !== 'string' || title.trim().length < 1 || title.length > 120
      || typeof description !== 'string' || description.length > 1000
      || typeof published !== 'boolean' || !Number.isInteger(version) || version < 0
      || !['classic', 'playful'].includes(theme)
      || typeof backgroundColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(backgroundColor)
      || !['rounded', 'soft', 'square'].includes(cardShape)
      || !['solid', 'dashed'].includes(connectorStyle)
      || !Array.isArray(nodes) || nodes.length > 100 || (published && nodes.length === 0) || !nodes.every(validNode) || !validTree(nodes)) {
      return res.status(400).json({ error: 'Revise o título, os tópicos e as conexões do mapa.' });
    }
    const map = await db.$transaction(async tx => {
      const current = await tx.studyMap.findUnique({ where: { courseId: course.id } });
      if ((current?.version || 0) !== version) return null;
      if (current) {
        const updated = await tx.studyMap.updateMany({ where: { courseId: course.id, version }, data: { title: title.trim(), description: description.trim(), nodes, theme, backgroundColor, cardShape, connectorStyle, published, version: { increment: 1 } } });
        if (!updated.count) return null;
      } else await tx.studyMap.create({ data: { courseId: course.id, title: title.trim(), description: description.trim(), nodes, theme, backgroundColor, cardShape, connectorStyle, published } });
      return tx.studyMap.findUnique({ where: { courseId: course.id } });
    });
    if (!map) return res.status(409).json({ error: 'Outra pessoa alterou este mapa. Atualize a página antes de salvar.' });
    res.json(map);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Outra pessoa criou este mapa. Atualize a página.' });
    res.status(500).json({ error: 'Não foi possível salvar o mapa.' });
  }
});
