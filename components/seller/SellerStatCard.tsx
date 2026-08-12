import { Card } from "@/components/ui/Card";

/** Dashboard count tile. Neutral by design — a count is not a call to action. */
export function SellerStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <p className="text-label-md text-text-muted">{label}</p>
      <p className="text-display-lg text-text-main">{value}</p>
      <p className="text-body-sm text-text-muted">{hint}</p>
    </Card>
  );
}
