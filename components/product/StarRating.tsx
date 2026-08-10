export function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 2) / 2;

  return (
    <div
      className="flex items-center gap-1"
      aria-label={`Rated ${rating} out of 5`}
    >
      <span className="text-accent" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star}>
            {rounded >= star ? "★" : rounded >= star - 0.5 ? "⯨" : "☆"}
          </span>
        ))}
      </span>
      <span className="text-body-sm text-text-muted">{rating.toFixed(1)}</span>
    </div>
  );
}
