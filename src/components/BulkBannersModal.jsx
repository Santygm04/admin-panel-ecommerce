import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { Badge, Button, Field, Input, Modal, Select } from "./ui";
import { API_URL, authHeaders } from "../utils/api";
import { cloudinaryErrorMessage, uploadCloudinaryImage } from "../utils/cloudinary";
import { notify } from "../utils/toast";

const API = `${API_URL}/api/banners`;
const MAX_FILES = 10;
const MAX_IMAGE_MB = 8;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

let uid = 0;

function prettyName(filename) {
  const base = String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

export default function BulkBannersModal({ open, nextOrder = 1, onClose, onCreated }) {
  const [items, setItems] = useState([]);
  const [dispositivo, setDispositivo] = useState("todos");
  const [activo, setActivo] = useState(true);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) return;
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.preview));
      return [];
    });
    setProgress(null);
    setError("");
    setConfirmClose(false);
    setDispositivo("todos");
    setActivo(true);
  }, [open]);

  if (!open) return null;

  const pendingItems = items.filter((item) => item.status === "pending" || item.status === "error");

  const updateItem = (id, patch) => setItems((current) => current.map((item) => (
    item.id === id ? { ...item, ...patch } : item
  )));

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    const accepted = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`“${file.name}” no es una imagen compatible.`);
        continue;
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        setError(`“${file.name}” supera el máximo de ${MAX_IMAGE_MB} MB.`);
        continue;
      }
      accepted.push({
        id: `bulk-${++uid}`,
        file,
        preview: URL.createObjectURL(file),
        name: prettyName(file.name) || `Banner ${items.length + accepted.length + 1}`,
        status: "pending",
        error: "",
        url: "",
      });
    }
    if (!accepted.length) return;
    setItems((current) => {
      const room = Math.max(0, MAX_FILES - current.length);
      const next = [...current, ...accepted.slice(0, room)];
      if (accepted.length > room) setError(`Máximo ${MAX_FILES} imágenes por vez.`);
      return next;
    });
  };

  const removeItem = (id) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  };

  const requestClose = () => {
    if (working) return;
    const hasPending = items.some((item) => item.status !== "done");
    if (hasPending) setConfirmClose(true);
    else onClose?.();
  };

  const createAll = async () => {
    const queue = items.filter((item) => item.status === "pending" || item.status === "error");
    if (!queue.length) return;
    setWorking(true);
    setError("");
    let created = 0;
    let failed = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      setProgress({ current: index + 1, total: queue.length });
      updateItem(item.id, { status: "uploading", error: "" });

      let url;
      try {
        url = await uploadCloudinaryImage(item.file, { folder: "banners" });
      } catch (uploadError) {
        failed += 1;
        updateItem(item.id, { status: "error", error: cloudinaryErrorMessage(uploadError) });
        continue;
      }

      const nombre = item.name.trim() || prettyName(item.file.name) || "Banner";
      try {
        const response = await fetch(API, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre,
            alt: nombre,
            imagenDesktop: url,
            dispositivo,
            activo,
            orden: nextOrder + index,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || "No se pudo crear el banner");
        created += 1;
        updateItem(item.id, { status: "done", url });
      } catch (saveError) {
        failed += 1;
        updateItem(item.id, { status: "error", error: saveError.message });
      }
    }

    setWorking(false);
    setProgress(null);
    if (created) {
      notify.success(created === 1 ? "1 banner creado" : `${created} banners creados`);
      onCreated?.();
    }
    if (!failed) {
      onClose?.();
    } else {
      setError(`Se crearon ${created} y ${failed} quedaron con error. Corregí y volvé a intentar.`);
    }
  };

  return (
    <>
      <Modal
        open
        wide
        title="Subir varias imágenes"
        subtitle="Elegí varias imágenes y se creará un banner por cada una."
        onClose={requestClose}
        footer={(
          <>
            <Button variant="secondary" onClick={requestClose} disabled={working}>Cancelar</Button>
            <Button onClick={createAll} loading={working} disabled={!pendingItems.length}>
              {working && progress
                ? `Subiendo ${progress.current} de ${progress.total}…`
                : pendingItems.length > 1
                  ? `Crear ${pendingItems.length} banners`
                  : pendingItems.length === 1 ? "Crear banner" : "Elegí imágenes"}
            </Button>
          </>
        )}
      >
        <div className="bn-bulk">
          {items.length < MAX_FILES && (
            <button
              type="button"
              className="bn-dropzone"
              onClick={() => inputRef.current?.click()}
              disabled={working}
            >
              <ImagePlus size={22} />
              <span>Hacé click para elegir varias imágenes</span>
              <small>Hasta {MAX_FILES} por vez · JPG, PNG, WebP o AVIF · Máx. {MAX_IMAGE_MB} MB cada una</small>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }}
            hidden
          />

          {items.length > 0 && (
            <ul className="bn-bulk-grid">
              {items.map((item) => (
                <li key={item.id} className={`bn-bulk-item is-${item.status}`}>
                  <img src={item.preview} alt="" />
                  <div className="bn-bulk-fields">
                    <Input
                      value={item.name}
                      onChange={(event) => updateItem(item.id, { name: event.target.value })}
                      disabled={working || item.status === "done"}
                      maxLength={120}
                      aria-label="Nombre del banner"
                    />
                    <div className="bn-bulk-status">
                      {item.status === "pending" && <Badge tone="neutral">Pendiente</Badge>}
                      {item.status === "uploading" && <Badge tone="info">Subiendo…</Badge>}
                      {item.status === "done" && <Badge tone="success">Creado</Badge>}
                      {item.status === "error" && <Badge tone="danger">Error</Badge>}
                      {item.file && <span className="bn-bulk-filename">{item.file.name}</span>}
                    </div>
                    {item.error && <p className="bn-bulk-error">{item.error}</p>}
                  </div>
                  <button
                    type="button"
                    className="bn-tool bn-tool--danger"
                    onClick={() => removeItem(item.id)}
                    disabled={working || item.status === "done"}
                    title="Quitar"
                    aria-label={`Quitar ${item.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="bn-bulk-options">
            <Field label="Dispositivo para todos">
              <Select value={dispositivo} onChange={(event) => setDispositivo(event.target.value)} disabled={working}>
                <option value="todos">Todos los dispositivos</option>
                <option value="desktop">Solo escritorio</option>
                <option value="mobile">Solo mobile</option>
              </Select>
            </Field>
            <label className="ui-check bn-check">
              <input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} disabled={working} />
              Dejar los banners activos
            </label>
          </div>

          <p className="bn-bulk-note">
            Cada imagen se crea como un banner independiente y va al final del orden actual.
            Después podés editar fechas, enlaces, texto del botón y orden de cada uno.
          </p>

          {error && <div className="ui-banner ui-banner--danger" role="alert">{error}</div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClose}
        title="Descartar imágenes"
        message="Tenés imágenes sin crear. ¿Querés descartarlas?"
        confirmText="Descartar"
        cancelText="Seguir acá"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); onClose?.(); }}
      />
    </>
  );
}
