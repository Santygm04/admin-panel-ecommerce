import axios from "axios";
import { API_URL, authHeaders } from "./api";
import { normalizeImageUrl } from "./image";
import { cloudinaryErrorMessage, uploadCloudinaryImage } from "./cloudinary";

// La migración se activa explícitamente en el despliegue del panel, después de
// configurar y verificar R2. Hasta entonces sigue funcionando Cloudinary.
const useR2 = import.meta.env.VITE_IMAGE_STORAGE === "r2";
const MAX_ACTIVE = 3;
let active = 0;
const waiting = [];

async function withUploadSlot(action) {
  if (active >= MAX_ACTIVE) await new Promise((resolve) => waiting.push(resolve));
  else active += 1;
  try {
    return await action();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

export async function uploadImage(file, { folder = "productos" } = {}) {
  if (!useR2) return uploadCloudinaryImage(file, { folder });
  if (!["productos", "banners"].includes(folder)) throw new Error("Destino de imagen inválido");

  return withUploadSlot(async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await axios.post(`${API_URL}/api/media/${folder}`, formData, {
          headers: authHeaders(),
          timeout: 120000,
        });
        if (!data?.url || !String(data.url).startsWith("https://")) {
          throw new Error("El servidor no devolvió una URL segura");
        }
        return normalizeImageUrl(data.url);
      } catch (error) {
        if (error?.response?.status !== 429 || attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
    throw new Error("No se pudo subir la imagen");
  });
}

export function imageUploadErrorMessage(error) {
  if (!useR2) return cloudinaryErrorMessage(error);
  if (error?.response?.data?.message) return String(error.response.data.message);
  if (!error?.response && /network|timeout|failed to fetch/i.test(error?.message || "")) {
    return "No se pudo conectar con el servidor de imágenes. Verificá la conexión e intentá nuevamente.";
  }
  return String(error?.message || "No se pudo subir la imagen");
}
