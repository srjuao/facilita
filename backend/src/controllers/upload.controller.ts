import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';

// Diretorio de uploads
const uploadDir = path.join(__dirname, '../../uploads/videos');
const brandingDir = path.join(__dirname, '../../uploads/branding');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

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
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
    const allowedExtensions = /\.(mp4|webm|mov)$/i;
    if (allowedMimeTypes.has(file.mimetype) && allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo inválido. Apenas vídeos são permitidos.'));
    }
  }
});

export const handleVideoUpload = (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo de vídeo foi enviado.' });
  }

  // A relative URL follows the public origin/proxy and never leaks an internal host.
  const videoUrl = `/uploads/videos/${req.file.filename}`;
  return res.json({
    message: 'Upload de vídeo concluído com sucesso!',
    videoUrl,
    filename: req.file.filename,
    size: req.file.size
  });
};

const brandingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, brandingDir),
  filename: (_req, file, cb) => cb(null, `brand-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
});

export const brandingUpload = multer({
  storage: brandingStorage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const type = String(req.body.assetType || '');
    const image = /^image\/(png|jpeg|webp|svg\+xml)$/.test(file.mimetype);
    const loginMedia = image || file.mimetype === 'video/mp4';
    if ((['logo', 'favicon'].includes(type) && image) || (type === 'loginMedia' && loginMedia)) return cb(null, true);
    cb(new Error('Arquivo de identidade inválido.'));
  }
});

export const handleBrandingUpload = (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Selecione um arquivo.' });
  return res.status(201).json({ url: `/api/uploads/branding/${req.file.filename}`, mediaType: req.file.mimetype });
};
