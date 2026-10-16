import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { login, getMe, changePassword } from './controllers/auth.controller';
import { createTenant, createTenantUser, getPublicTenantBranding, getTenants, getTenantById, getTenantUsers, updateTenantBranding, updateTenantStatus, updateTenantUser } from './controllers/tenant.controller';
import { getCourseDetails } from './controllers/course.controller';
import { createStudent, getStudents, getStudentById } from './controllers/student.controller';
import { getChatHistory, sendMessage } from './controllers/chat.controller';
import { getExams } from './controllers/exam.controller';
import { getLessonsByModule, getLessonById } from './controllers/lesson.controller';
import { createCoordCourse, createCoordTeacher, getCoordCourses } from './controllers/coord.controller';
import { createModule, createLesson } from './controllers/content.controller';
import { brandingUpload, handleBrandingUpload, upload, handleVideoUpload } from './controllers/upload.controller';
import { authenticateToken, authorizeRoles } from './middleware/auth';
import { createPublicLead, getLeads, updateLead } from './controllers/lead.controller';
import { assignPlan, createPlan, getPlans, getSubscriptions, updatePlanStatus, getPublicPricing, getPricingSetting, updatePricingSetting } from './controllers/plan.controller';
import { featureGate } from './controllers/plan-access';
import { streamLessonMedia } from './controllers/media-access';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

// Deliberately minimal endpoint for load balancers and container health checks.
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', version: process.env.npm_package_version || '1.0.0' }));

// Servir arquivos estáticos (uploads de vídeos)
app.use('/uploads/branding', express.static(path.join(__dirname, '../uploads/branding')));
app.use('/api/uploads/branding', express.static(path.join(__dirname, '../uploads/branding')));
app.use(['/uploads', '/api/uploads'], (_req, res) => res.status(403).json({ error: 'Use o acesso autorizado da aula para reproduzir vídeos.' }));
app.get('/api/media/lessons/:id', streamLessonMedia);

// Auth
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getMe);
app.patch('/api/auth/password', authenticateToken, authorizeRoles('superadmin'), changePassword);
app.get('/api/public/tenant-branding', getPublicTenantBranding);
app.post('/api/public/leads', createPublicLead);
app.get('/api/public/pricing', getPublicPricing);
app.get('/api/pricing-setting', authenticateToken, authorizeRoles('superadmin'), getPricingSetting);
app.patch('/api/pricing-setting', authenticateToken, authorizeRoles('superadmin'), updatePricingSetting);
app.get('/api/leads', authenticateToken, authorizeRoles('superadmin'), getLeads);
app.patch('/api/leads/:id', authenticateToken, authorizeRoles('superadmin'), updateLead);
app.get('/api/plans', authenticateToken, authorizeRoles('superadmin'), getPlans);
app.post('/api/plans', authenticateToken, authorizeRoles('superadmin'), createPlan);
app.patch('/api/plans/:id/status', authenticateToken, authorizeRoles('superadmin'), updatePlanStatus);
app.get('/api/subscriptions', authenticateToken, authorizeRoles('superadmin'), getSubscriptions);
app.patch('/api/tenants/:id/plan', authenticateToken, authorizeRoles('superadmin'), assignPlan);

// Uploads
app.post('/api/upload/video', authenticateToken, featureGate('videoAulas'), authorizeRoles('superadmin', 'coord', 'professor'), upload.single('video'), handleVideoUpload);
app.post('/api/tenants/:id/branding/upload', authenticateToken, authorizeRoles('superadmin'), brandingUpload.single('file'), handleBrandingUpload);

// Tenants
app.get('/api/tenants', authenticateToken, authorizeRoles('superadmin', 'coord'), getTenants);
app.get('/api/tenants/:id', authenticateToken, authorizeRoles('superadmin', 'coord'), getTenantById);
app.post('/api/tenants', authenticateToken, authorizeRoles('superadmin'), createTenant);
app.patch('/api/tenants/:id/status', authenticateToken, authorizeRoles('superadmin'), updateTenantStatus);
app.patch('/api/tenants/:id/branding', authenticateToken, authorizeRoles('superadmin'), updateTenantBranding);
app.get('/api/tenants/:id/users', authenticateToken, authorizeRoles('superadmin'), getTenantUsers);
app.patch('/api/tenants/:id/users/:userId', authenticateToken, authorizeRoles('superadmin'), updateTenantUser);
app.post('/api/tenants/:id/users', authenticateToken, authorizeRoles('superadmin'), createTenantUser);

// Gestão da própria unidade pela coordenação.
app.get('/api/coord/courses', authenticateToken, authorizeRoles('coord'), getCoordCourses);
app.post('/api/coord/courses', authenticateToken, authorizeRoles('coord'), createCoordCourse);
app.post('/api/coord/teachers', authenticateToken, authorizeRoles('coord'), createCoordTeacher);

// Courses
app.get('/api/courses/:id', authenticateToken, getCourseDetails);
app.post('/api/modules', authenticateToken, authorizeRoles('coord', 'professor'), createModule);
app.post('/api/modules/:id/lessons', authenticateToken, featureGate('videoAulas'), authorizeRoles('coord', 'professor'), createLesson);

// Lessons
app.get('/api/lessons', authenticateToken, featureGate('videoAulas'), getLessonsByModule);
app.get('/api/lessons/:id', authenticateToken, featureGate('videoAulas'), getLessonById);

// Students
app.get('/api/students', authenticateToken, getStudents);
app.post('/api/students', authenticateToken, authorizeRoles('coord', 'professor'), createStudent);
app.get('/api/students/:id', authenticateToken, getStudentById);

// Chat IA
app.get('/api/chat/history', authenticateToken, featureGate('ia'), getChatHistory);
app.post('/api/chat/send', authenticateToken, featureGate('ia'), sendMessage);

// Exams
app.get('/api/exams', authenticateToken, featureGate('provas'), getExams);

// Avoid Express' default HTML errors for invalid uploads and oversized requests.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Upload inválido ou acima do limite. Para identidade, envie arquivos de até 50 MB.' });
  if (err.message === 'Arquivo de identidade inválido.') return res.status(400).json({ error: 'Formato não permitido. Envie PNG, JPG, WebP ou SVG para logos e ícones; PNG, JPG, WebP ou MP4 para o login.' });
  if (err.message === 'Formato de arquivo inválido. Apenas vídeos são permitidos.') return res.status(400).json({ error: err.message });
  return res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`⚡️ Backend FacilitaEstudos rodando na porta ${PORT}`);
});
