"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVideoUpload = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Diretorio de uploads
const uploadDir = path_1.default.join(__dirname, '../../uploads/videos');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, `video-${uniqueSuffix}${ext || '.mp4'}`);
    }
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('application/octet-stream') || file.originalname.match(/\.(mp4|webm|mkv|mov|avi)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error('Formato de arquivo inválido. Apenas vídeos são permitidos.'));
        }
    }
});
const handleVideoUpload = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo de vídeo foi enviado.' });
    }
    const videoUrl = `http://localhost:3001/uploads/videos/${req.file.filename}`;
    return res.json({
        message: 'Upload de vídeo concluído com sucesso!',
        videoUrl,
        filename: req.file.filename,
        size: req.file.size
    });
};
exports.handleVideoUpload = handleVideoUpload;
