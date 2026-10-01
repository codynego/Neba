"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export type PreviewImage = { url: string; downloadUrl: string; alt: string; name: string };

export function ImageLightbox({ images, activeIndex, onChange, onClose }: {
  images: PreviewImage[]; activeIndex: number; onChange: (index: number) => void; onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const image = images[activeIndex];
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && images.length > 1) onChange((activeIndex - 1 + images.length) % images.length);
      if (event.key === "ArrowRight" && images.length > 1) onChange((activeIndex + 1) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [activeIndex, images.length, onChange, onClose]);
  if (!mounted || !image) return null;
  return createPortal(<div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`Preview ${image.alt}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="image-lightbox-bar"><span>{images.length > 1 ? `${activeIndex + 1} of ${images.length}` : image.name}</span><div><a href={image.downloadUrl} download={image.name}><Download size={18} />Download</a><button type="button" onClick={onClose} aria-label="Close image preview" autoFocus><X size={21} /></button></div></div>
    {images.length > 1 && <button type="button" className="image-lightbox-nav previous" aria-label="Previous image" onClick={() => onChange((activeIndex - 1 + images.length) % images.length)}><ChevronLeft size={28} /></button>}
    <img src={image.url} alt={image.alt} />
    {images.length > 1 && <button type="button" className="image-lightbox-nav next" aria-label="Next image" onClick={() => onChange((activeIndex + 1) % images.length)}><ChevronRight size={28} /></button>}
  </div>, document.body);
}
