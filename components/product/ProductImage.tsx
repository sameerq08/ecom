import Image from "next/image";

/**
 * Fills an already-positioned `relative` container with either the product
 * image or a neutral placeholder. The caller owns the well's size and aspect
 * ratio, so a listing with no image still occupies exactly the same space and
 * grid rows stay aligned.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  padding = "p-4",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  padding?: string;
}) {
  if (!src) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-muted text-text-muted"
        role="img"
        aria-label={`${alt} — no image available`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-10 w-10"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span className="text-body-sm">No image</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={`object-contain ${padding}`}
    />
  );
}
