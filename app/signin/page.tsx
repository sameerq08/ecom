import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { signIn } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  missing: "Enter both your email and your password.",
};

export default async function SignInPage(props: PageProps<"/signin">) {
  const { error } = await props.searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-8">
      <h1 className="text-display-lg text-text-main">Sign in</h1>

      <Card>
        <CardHeader title="Your account" />
        <form action={signIn} className="flex flex-col gap-4 p-5">
          {message ? (
            <p
              role="alert"
              className="rounded border border-error/20 bg-error/10 px-3 py-2 text-body-md text-error"
            >
              {message}
            </p>
          ) : null}

          <Field
            id="signin-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
          />
          <Field
            id="signin-password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />

          {/* Secondary, not accent: amber is reserved for conversion CTAs. */}
          <Button type="submit" variant="secondary" fullWidth>
            Sign in
          </Button>
        </form>
      </Card>

      <p className="text-body-md text-text-muted">
        No account yet?{" "}
        <Link href="/signup" className="text-link underline">
          Create one
        </Link>
        .
      </p>
    </div>
  );
}
