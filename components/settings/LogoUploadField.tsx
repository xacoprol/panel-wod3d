"use client";

import { useRef, useState } from "react";

type Props = {
  currentLogoUrl: string | null;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function LogoUploadField({ currentLogoUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [fileName, setFileName] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [hasNewFile, setHasNewFile] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRemove(false);
    setHasNewFile(true);
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function clearLogo() {
    setRemove(true);
    setHasNewFile(false);
    setPreview(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const keepExisting = !remove && !hasNewFile;

  return (
    <div className="space-y-3 sm:col-span-2">
      <label className="label" htmlFor="logoFile">
        Logo (PDFs y documentos)
      </label>

      {keepExisting ? (
        <input type="hidden" name="logoUrl" value={currentLogoUrl ?? ""} />
      ) : null}
      {remove ? <input type="hidden" name="removeLogo" value="1" /> : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-md border border-line bg-bg-elevated px-3">
          {preview && !remove ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Vista previa del logo"
              className="max-h-14 max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-ink-muted">Sin logo</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => inputRef.current?.click()}
          >
            Subir imagen
          </button>
          {(preview || currentLogoUrl) && !remove ? (
            <button type="button" className="btn-ghost text-danger" onClick={clearLogo}>
              Quitar
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        id="logoFile"
        name="logoFile"
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFileChange}
      />

      <p className="text-xs text-ink-muted">
        PNG, JPG, WebP o GIF. Máx. 1,5&nbsp;MB.
        {fileName ? ` Seleccionado: ${fileName}` : null}
      </p>
    </div>
  );
}
