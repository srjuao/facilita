import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { login, getMe } from './controllers/auth.controller';
import { getTenants, getTenantById } from './controllers/tenant.controller';
import { getCourseDetails } from './controllers/course.controller';
import { getStudents, getStudentById } from './controllers/student.controller';
import { getChatHistory, sendMessage } from './controllers/chat.controller';
import { getExams } from './controllers/exam.controller';
import { getLessonsByModule, getLessonById } from './controllers/lesson.controller';
import { upload, handleVideoUpload } from './controllers/upload.controller';
import { authenticateToken } from './middleware/auth';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos (uploads de vídeos)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Auth
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getMe);

// Uploads
app.post('/api/upload/video', upload.single('video'), handleVideoUpload);

// Tenants
app.get('/api/tenants', getTenants);
app.get('/api/tenants/:id', getTenantById);

// Courses
app.get('/api/courses/:id', getCourseDetails);

// Lessons
app.get('/api/lessons', getLessonsByModule);
app.get('/api/lessons/:id', getLessonById);

// Students
app.get('/api/students', getStudents);
app.get('/api/students/:id', getStudentById);

// Chat IA
app.get('/api/chat/history', authenticateToken, getChatHistory);
app.post('/api/chat/send', authenticateToken, sendMessage);

// Exams
app.get('/api/exams', getExams);

app.listen(PORT, () => {
  console.log(`⚡️ Backend FacilitaEstudos rodando na porta ${PORT}`);
});
