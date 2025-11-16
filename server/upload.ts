import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import fs from "fs";

const uploadsDir = "uploads";
const productsDir = path.join(uploadsDir, "products");
const chatDir = path.join(uploadsDir, "chat");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir);
}
if (!fs.existsSync(chatDir)) {
  fs.mkdirSync(chatDir);
}

const productImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const chatAttachmentsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, chatDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Недопустимый формат файла. Разрешены только JPEG, PNG, WEBP"));
  }
};

export const productImagesUpload = multer({
  storage: productImagesStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

export const chatAttachmentsUpload = multer({
  storage: chatAttachmentsStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 7,
  },
  fileFilter,
});

export function validateTotalFileSize(maxTotalSize: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.files || !Array.isArray(req.files)) {
      next();
      return;
    }

    const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxTotalSize) {
      res.status(400).json({
        message: `Общий размер файлов превышает ${maxTotalSize / 1024 / 1024} МБ`,
      });
      return;
    }

    next();
  };
}
