import axios from "axios";

const configuredCloudName = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();
// Evita volver al cloud antiguo que quedó deshabilitado en despliegues sin variables.
const CLOUD_NAME = configuredCloudName && configuredCloudName !== "dl2vebaou"
  ? configuredCloudName
  : "deejrf2ub";
const UPLOAD_PRESET = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "aesthetic").trim();

export const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
export const CLOUDINARY_UPLOAD_PRESET = UPLOAD_PRESET;

export async function uploadCloudinaryImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "productos");

  const { data } = await axios.post(CLOUDINARY_UPLOAD_URL, formData);
  if (!data?.secure_url) throw new Error("Cloudinary no devolvió una URL segura para la imagen.");
  return data.secure_url;
}

export function cloudinaryErrorMessage(error) {
  const message = String(
    error?.response?.data?.error?.message || error?.message || "Error desconocido"
  ).trim();

  if (/cloud_name is disabled/i.test(message)) {
    return "La cuenta de Cloudinary está deshabilitada para este panel.";
  }
  if (/preset|upload preset|not authorized|unauthorized/i.test(message)) {
    return `El preset "${UPLOAD_PRESET}" no está habilitado para subir imágenes.`;
  }
  if (/invalid image|unsupported image|format/i.test(message)) {
    return "El archivo no es una imagen válida o tiene un formato no compatible.";
  }
  if (/too large|file size|maximum/i.test(message)) {
    return "La imagen supera el tamaño máximo permitido.";
  }

  return message.length > 140 ? `${message.slice(0, 137)}...` : message;
}
