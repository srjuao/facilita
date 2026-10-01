"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_controller_1 = require("./controllers/auth.controller");
const tenant_controller_1 = require("./controllers/tenant.controller");
const course_controller_1 = require("./controllers/course.controller");
const student_controller_1 = require("./controllers/student.controller");
const chat_controller_1 = require("./controllers/chat.controller");
const exam_controller_1 = require("./controllers/exam.controller");
const lesson_controller_1 = require("./controllers/lesson.controller");
const upload_controller_1 = require("./controllers/upload.controller");
const auth_1 = require("./middleware/auth");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Servir arquivos estáticos (uploads de vídeos)
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Auth
app.post('/api/auth/login', auth_controller_1.login);
app.get('/api/auth/me', auth_1.authenticateToken, auth_controller_1.getMe);
// Uploads
app.post('/api/upload/video', upload_controller_1.upload.single('video'), upload_controller_1.handleVideoUpload);
// Tenants
app.get('/api/tenants', tenant_controller_1.getTenants);
app.get('/api/tenants/:id', tenant_controller_1.getTenantById);
// Courses
app.get('/api/courses/:id', course_controller_1.getCourseDetails);
// Lessons
app.get('/api/lessons', lesson_controller_1.getLessonsByModule);
app.get('/api/lessons/:id', lesson_controller_1.getLessonById);
// Students
app.get('/api/students', student_controller_1.getStudents);
app.get('/api/students/:id', student_controller_1.getStudentById);
// Chat IA
app.get('/api/chat/history', auth_1.authenticateToken, chat_controller_1.getChatHistory);
app.post('/api/chat/send', auth_1.authenticateToken, chat_controller_1.sendMessage);
// Exams
app.get('/api/exams', exam_controller_1.getExams);
app.listen(PORT, () => {
    console.log(`⚡️ Backend FacilitaEstudos rodando na porta ${PORT}`);
});
