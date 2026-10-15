import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { login, getMe } from './controllers/auth.controller';
import { createTenant, createTenantUser, getPublicTenantBranding, getTenants, getTenantById, getTenantUsers, updateTenantBranding, updateTenantStatus } from './controllers/tenant.controller';
import { getCourseDetails } from './controllers/course.controller';
import { getStudents, getStudentById } from './controllers/student.controller';
import { getChatHistory, sendMessage } from './controllers/chat.controller';
import { getExams } from './controllers/exam.controller';
import { getLessonsByModule, getLessonById } from './controllers/lesson.controller';
import { brandingUpload, handleBrandingUpload, upload, handleVideoUpload } from './controllers/upload.controller';
import { authenticateToken, authorizeRoles } from './middleware/auth';
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Auth
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getMe);
app.get('/api/public/tenant-branding', getPublicTenantBranding);

// Uploads
app.post('/api/upload/video', authenticateToken, authorizeRoles('superadmin', 'coord'), upload.single('video'), handleVideoUpload);
app.post('/api/tenants/:id/branding/upload', authenticateToken, authorizeRoles('superadmin'), brandingUpload.single('file'), handleBrandingUpload);

// Tenants
app.get('/api/tenants', authenticateToken, authorizeRoles('superadmin', 'coord'), getTenants);
app.get('/api/tenants/:id', authenticateToken, authorizeRoles('superadmin', 'coord'), getTenantById);
app.post('/api/tenants', authenticateToken, authorizeRoles('superadmin'), createTenant);
app.patch('/api/tenants/:id/status', authenticateToken, authorizeRoles('superadmin'), updateTenantStatus);
app.patch('/api/tenants/:id/branding', authenticateToken, authorizeRoles('superadmin'), updateTenantBranding);
app.get('/api/tenants/:id/users', authenticateToken, authorizeRoles('superadmin'), getTenantUsers);
app.post('/api/tenants/:id/users', authenticateToken, authorizeRoles('superadmin'), createTenantUser);

// Courses
app.get('/api/courses/:id', authenticateToken, getCourseDetails);

// Lessons
app.get('/api/lessons', authenticateToken, getLessonsByModule);
app.get('/api/lessons/:id', authenticateToken, getLessonById);

// Students
app.get('/api/students', authenticateToken, getStudents);
app.get('/api/students/:id', authenticateToken, getStudentById);

// Chat IA
app.get('/api/chat/history', authenticateToken, getChatHistory);
app.post('/api/chat/send', authenticateToken, sendMessage);

// Exams
app.get('/api/exams', authenticateToken, getExams);

// Avoid Express' default HTML errors for invalid uploads and oversized requests.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Upload inválido ou maior que 100 MB.' });
  if (err.message === 'Formato de arquivo inválido. Apenas vídeos são permitidos.') return res.status(400).json({ error: err.message });
  return res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`⚡️ Backend FacilitaEstudos rodando na porta ${PORT}`);
});
