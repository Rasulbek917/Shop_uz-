"use client";
import { useState } from "react";

export default function PublicReceiptImage({
  imageUrl,
  filename,
  description,
}: {
  imageUrl: string;
  filename: string;
  description: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [retry, setRetry] = useState(0);
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${imageUrl}&download=1`, {
        cache: "no-store",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/png")
      )
        throw new Error("Chek rasmini yuklab bo‘lmadi. Qayta urinib ko‘ring.");
      const buffer = await response.arrayBuffer();
      const header = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
      if (
        ![137, 80, 78, 71, 13, 10, 26, 10].every(
          (byte, index) => header[index] === byte,
        )
      )
        throw new Error("Chek rasmi to‘liq olinmadi. Qayta urinib ko‘ring.");
      const url = URL.createObjectURL(
        new Blob([buffer], { type: "image/png" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      {previewError ? (
        <div role="alert" className="my-5 rounded-xl border bg-white p-5">
          <p>Chek rasmi yuklanmadi.</p>
          <button
            className="btn-secondary mt-3"
            onClick={() => {
              setPreviewError(false);
              setRetry((value) => value + 1);
            }}
          >
            Qayta yuklash
          </button>
        </div>
      ) : (
        <img
          className="my-5 w-full rounded-xl border bg-white shadow-sm"
          src={`${imageUrl}&retry=${retry}`}
          alt={description}
          onError={() => setPreviewError(true)}
        />
      )}
      <button className="btn-primary" disabled={busy} onClick={download}>
        {busy ? "Rasm tayyorlanmoqda…" : "Chek rasmini yuklab olish (PNG)"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
