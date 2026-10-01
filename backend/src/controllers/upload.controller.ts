import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Diretorio de uploads
const uploadDir = path.join(__dirname, '../../uploads/videos');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `video-${uniqueSuffix}${ext || '.mp4'}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('application/octet-stream') || file.originalname.match(/\.(mp4|webm|mkv|mov|avi)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo inválido. Apenas vídeos são permitidos.'));
    }
  }
});

export const handleVideoUpload = (req: Request, res: Response) => {
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
