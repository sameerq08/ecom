import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { requireProfile } from "@/lib/supabase/session";
import { signOut } from "@/app/signout/actions";

/**
 * The profile shell: proof the session resolves server-side, not a settings
 * screen. Everything here is read-only.
 *
 * In particular there is no control that changes `role`. Becoming a seller
 * means creating a `seller_profiles` row as well as flipping the column, which
 * is seller onboarding and belongs in its own step.
 */
export default async function AccountPage() {
  // Redirects to /signin when signed out. It throws, so no protected content
  // can render first.
  const profile = await requireProfile();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-8">
      <h1 className="text-display-lg text-text-main">Account</h1>

      <Card>
        <CardHeader title={profile.displayName ?? "Your account"} />
        <dl className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <dt className="text-label-md text-text-muted">Display name</dt>
            <dd className="text-body-lg text-text-main">
              {profile.displayName ?? "Not set"}
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-label-md text-text-muted">Email</dt>
            <dd className="text-body-lg text-text-main">
              {profile.email ?? "Not set"}
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-label-md text-text-muted">Role</dt>
            <dd>
              <Badge tone={profile.role === "seller" ? "pending" : "neutral"}>
                {profile.role}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" fullWidth>
          Sign out
        </Button>
      </form>
    </div>
  );
}
