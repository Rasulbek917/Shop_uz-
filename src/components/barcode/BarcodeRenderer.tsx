"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

interface BarcodeRendererProps {
  type: "QR" | "CODE128" | "EAN13";
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
  onDataUrlReady?: (dataUrl: string) => void;
}

export default function BarcodeRenderer({
  type,
  value,
  width = 2,
  height = 70,
  displayValue = true,
  className = "",
  onDataUrlReady,
}: BarcodeRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setError(null);

    if (type === "QR") {
      if (canvasRef.current) {
        QRCode.toCanvas(
          canvasRef.current,
          value,
          {
            width: height > 100 ? height : 140,
            margin: 1,
            color: { dark: "#000000", light: "#ffffff" },
            errorCorrectionLevel: "M",
          },
          (err) => {
            if (err) {
              console.error("QR render error:", err);
              setError("QR kod render xatosi");
            } else if (onDataUrlReady && canvasRef.current) {
              try {
                onDataUrlReady(canvasRef.current.toDataURL("image/png"));
              } catch (e) {
                // Ignore
              }
            }
          }
        );
      }
    } else {
      // CODE128 or EAN13
      if (svgRef.current) {
        try {
          const barcodeFormat = type === "EAN13" ? "EAN13" : "CODE128";
          JsBarcode(svgRef.current, value, {
            format: barcodeFormat,
            width: width,
            height: height,
            displayValue: displayValue,
            font: "monospace",
            fontSize: 13,
            textMargin: 3,
            margin: 6,
            background: "#ffffff",
            lineColor: "#000000",
          });

          // Also export to PNG DataURL via offscreen canvas if callback provided
          if (onDataUrlReady) {
            const svgString = new XMLSerializer().serializeToString(svgRef.current);
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
              const offCanvas = document.createElement("canvas");
              offCanvas.width = img.width || 280;
              offCanvas.height = img.height || 100;
              const ctx = offCanvas.getContext("2d");
              if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
                ctx.drawImage(img, 0, 0);
                onDataUrlReady(offCanvas.toDataURL("image/png"));
              }
              URL.revokeObjectURL(blobURL);
            };
            img.src = blobURL;
          }
        } catch (e: any) {
          console.error("Barcode render error:", e);
          setError(e.message || "Shtrix-kod formati noto'g'ri");
        }
      }
    }
  }, [type, value, width, height, displayValue]);

  if (error) {
    return (
      <div className="p-3 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-200 text-center font-mono">
        {error}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-2 bg-white rounded-lg ${className}`}>
      {type === "QR" ? (
        <canvas ref={canvasRef} className="max-w-full" />
      ) : (
        <svg ref={svgRef} className="max-w-full" />
      )}
    </div>
  );
}
