"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clampCrop, cropRect, DEFAULT_CROP, MAX_ZOOM, MIN_ZOOM } from "@/lib/headshotCrop";
import type { HeadshotCrop } from "@/lib/types";

const BOX = 240;

/**
 * Drag and zoom the loan officer's headshot inside the circle used on the
 * graphics. Saved with the rest of the form as headshotCropX/Y/Zoom.
 */
export function HeadshotCropper({ initialUrl, initial }: { initialUrl: string; initial: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState<HeadshotCrop>(() => {
    const x = parseFloat(initial.headshotCropX);
    const y = parseFloat(initial.headshotCropY);
    const zoom = parseFloat(initial.headshotCropZoom);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(zoom) ? { x, y, zoom } : DEFAULT_CROP;
  });
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ px: number; py: number; start: HeadshotCrop } | null>(null);

  // Follow the "Headshot URL" field: a new photo starts from the default crop.
  useEffect(() => {
    const input = ref.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="headshotUrl"]');
    if (!input) return;
    const onInput = () => {
      setUrl(input.value.trim());
      setDims(null);
      setFailed(false);
      setCrop(DEFAULT_CROP);
    };
    input.addEventListener("input", onInput);
    return () => input.removeEventListener("input", onInput);
  }, []);

  const onLoaded = (img: HTMLImageElement) => {
    const d = { w: img.naturalWidth, h: img.naturalHeight };
    setDims(d);
    setCrop((c) => clampCrop(d.w, d.h, c));
  };

  // The photo can finish loading before React hydrates, so onLoad never fires.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) onLoaded(img);
  }, [url]);

  const update = (next: HeadshotCrop) => setCrop(dims ? clampCrop(dims.w, dims.h, next) : next);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dims) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, start: crop };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !dims) return;
    const { size } = cropRect(dims.w, dims.h, d.start);
    const scale = BOX / size; // screen px per image px
    // Dragging the photo right moves the crop window left.
    update({
      ...d.start,
      x: d.start.x - (e.clientX - d.px) / scale / dims.w,
      y: d.start.y - (e.clientY - d.py) / scale / dims.h,
    });
  };
  const endDrag = () => {
    drag.current = null;
  };

  let imgStyle: React.CSSProperties = { visibility: "hidden" };
  if (dims) {
    const r = cropRect(dims.w, dims.h, crop);
    const scale = BOX / r.size;
    imgStyle = { width: dims.w * scale, height: dims.h * scale, left: -r.left * scale, top: -r.top * scale };
  }

  const changed = crop.x !== 0.5 || crop.y !== 0.5 || crop.zoom !== 1;

  return (
    <div className="cropper" ref={ref}>
      <input type="hidden" name="headshotCropX" value={crop.x} />
      <input type="hidden" name="headshotCropY" value={crop.y} />
      <input type="hidden" name="headshotCropZoom" value={crop.zoom} />
      <span className="field-label">Headshot crop</span>
      {!url ? (
        <p className="muted small">Add a headshot URL to adjust how it&apos;s framed.</p>
      ) : (
        <div className="cropper-body">
          <div
            className={`cropper-circle${dims ? " is-ready" : ""}`}
            style={{ width: BOX, height: BOX }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {failed ? (
              <span className="cropper-error small">Couldn&apos;t load this image.</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                draggable={false}
                style={imgStyle}
                ref={imgRef}
                onLoad={(e) => onLoaded(e.currentTarget)}
                onError={() => setFailed(true)}
              />
            )}
          </div>
          <div className="cropper-controls">
            <label className="cropper-zoom">
              <span className="small">Zoom</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                disabled={!dims}
                onChange={(e) => update({ ...crop, zoom: parseFloat(e.target.value) })}
              />
            </label>
            <p className="muted small">
              Drag the photo to move it. The circle is what shows on every graphic and kit page. Save changes to apply it.
            </p>
            <button type="button" className="btn btn-small btn-ghost" disabled={!changed} onClick={() => update(DEFAULT_CROP)}>
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
