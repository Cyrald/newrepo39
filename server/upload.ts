import multer from "multer";

const memoryStorage = multer.memoryStorage();

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Недопустимый формат файла. Разрешены только JPEG, PNG, WEBP"));
  }
};

export const productImagesUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

export const chatAttachmentsUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 7,
  },
  fileFilter,
});
