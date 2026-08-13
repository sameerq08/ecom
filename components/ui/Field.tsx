import type { InputHTMLAttributes } from "react";

/**
 * A labelled text input. The token strings match the ones
 * `components/product/SearchFilters.tsx` uses inline, so form controls look
 * the same wherever they appear.
 *
 * `id` is required rather than optional: a label needs something to point at,
 * and defaulting it from `name` would silently produce duplicate ids the first
 * time two forms share a field name on one page.
 */
type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  id: string;
  label: string;
  hint?: string;
};

export function Field({ id, label, hint, ...props }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md text-text-main" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className="h-touch w-full rounded border border-border bg-surface px-3 text-body-md text-text-main"
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-body-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
