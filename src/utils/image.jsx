import { API_URL } from "./api";

const CLOUDINARY_UPLOAD_MARKER = "/image/upload/";

const toImageValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value.secure_url || value.secureUrl || value.url || value.path || "").trim();
  }
  return "";
};

export const normalizeImageUrl = (value) => {
  const raw = toImageValue(value);
  if (!raw) return "";

  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${API_URL}${raw}`;

  try {
    const url = new URL(raw, API_URL);
    if (url.hostname === "res.cloudinary.com" && url.pathname.includes(CLOUDINARY_UPLOAD_MARKER)) {
      const markerIndex = url.pathname.indexOf(CLOUDINARY_UPLOAD_MARKER) + CLOUDINARY_UPLOAD_MARKER.length;
      const beforeTransform = url.pathname.slice(0, markerIndex);
      const afterTransform = url.pathname.slice(markerIndex);
      if (!afterTransform.startsWith("f_auto,q_auto/")) {
        url.pathname = `${beforeTransform}f_auto,q_auto/${afterTransform}`;
      }
    }
    return url.href;
  } catch {
    return raw;
  }
};

export const productImageUrls = (product) => {
  const values = [
    ...(Array.isArray(product?.imagenes) ? product.imagenes : []),
    product?.imagen,
  ];
  return [...new Set(values.map(normalizeImageUrl).filter(Boolean))];
};

export const firstProductImage = (product) => productImageUrls(product)[0] || "";

export const ProductImage = ({ product, alt = "", className = "", ...props }) => {
  const urls = productImageUrls(product);
  const handleError = (event) => {
    const currentIndex = Number(event.currentTarget.dataset.imageIndex || 0);
    const nextUrl = urls[currentIndex + 1];
    if (nextUrl) {
      event.currentTarget.dataset.imageIndex = String(currentIndex + 1);
      event.currentTarget.src = nextUrl;
      return;
    }
    event.currentTarget.style.visibility = "hidden";
  };

  return urls[0] ? (
    <img
      src={urls[0]}
      data-image-index="0"
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  ) : null;
};
