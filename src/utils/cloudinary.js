import axios from "axios";
import { normalizeImageUrl } from "./image";

const CLOUD_NAME = "deejrf2ub";
const UPLOAD_PRESET = "aesthetic";
const CLOUDINARY_FOLDER = "productos";

export const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
export const CLOUDINARY_UPLOAD_PRESET = UPLOAD_PRESET;

export async function uploadCloudinaryImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_FOLDER);

  const { data } = await axios.post(CLOUDINARY_UPLOAD_URL, formData);
  if (!data?.secure_url) throw new Error("Cloudinary no devolvió una URL segura para la imagen.");
  // Cloudinary can keep HEIC originals; f_auto delivers JPG/WebP to browsers.
  return normalizeImageUrl(data.secure_url);
}

export function cloudinaryErrorMessage(error) {
  const responseError = error?.response?.data?.error;
  const responseMessage = typeof responseError === "string"
    ? responseError
    : responseError?.message || error?.response?.data?.message;
  const message = String(
    responseMessage || error?.message || "Error desconocido"
  ).trim();
  const detail = `Mensaje de Cloudinary: ${message}`;

  if (/cloud_name is disabled/i.test(message)) {
    return `Cloudinary deshabilitó el cloud configurado. ${detail}`;
  }
  if (/preset|upload preset|not authorized|unauthorized/i.test(message)) {
    return `Cloudinary rechazó el preset configurado "${UPLOAD_PRESET}". ${detail}`;
  }
  if (/invalid (image|file)|unsupported|format|file type/i.test(message)) {
    return `El archivo no es una imagen válida o tiene un formato no compatible. ${detail}`;
  }
  if (/too large|file size|maximum|exceeds/i.test(message)) {
    return `La imagen supera el tamaño máximo permitido. ${detail}`;
  }
  if (/network error|failed to fetch|network request failed/i.test(message) && !error?.response) {
    return "No se pudo conectar con Cloudinary. Verificá tu conexión o la política de seguridad del dominio. " + detail;
  }

  return detail;
}
