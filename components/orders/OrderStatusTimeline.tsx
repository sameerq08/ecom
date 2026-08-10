import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STEPS,
  type OrderStatus,
} from "@/lib/types/ui";

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = ORDER_STATUS_STEPS.indexOf(status);
  const lastIndex = ORDER_STATUS_STEPS.length - 1;
  const progressPercent = (currentIndex / lastIndex) * 100;

  return (
    <div className="relative pt-8 pb-4">
      <div className="absolute top-10 left-0 h-1 w-full rounded-full bg-surface-muted" />
      <div
        className="absolute top-10 left-0 h-1 rounded-full bg-success"
        style={{ width: `${progressPercent}%` }}
      />

      <ol className="relative flex w-full justify-between">
        {ORDER_STATUS_STEPS.map((step, index) => {
          const reached = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li
              key={step}
              className="relative flex w-1/4 flex-col items-center"
            >
              {isCurrent ? (
                <span className="absolute -top-[48px] z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-surface bg-success shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-surface" />
                </span>
              ) : (
                <span
                  className={`absolute -top-11 z-10 h-4 w-4 rounded-full border-2 border-surface shadow-sm ${
                    reached ? "bg-success" : "bg-surface-muted"
                  }`}
                />
              )}
              <p
                className={`mt-4 text-center text-label-md ${
                  reached ? "text-text-main" : "text-text-muted"
                }`}
              >
                {ORDER_STATUS_LABELS[step]}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
