import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { signUp } from "./actions";

const ERRORS: Record<string, string> = {
  exists: "That email already has an account. Sign in instead.",
  weak: "Choose a password of at least 8 characters.",
  missing: "Fill in every field.",
  bademail: "That email address isn't valid. Check it and try again.",
  ratelimited:
    "Too many sign-up attempts from this project just now. Wait a few minutes and try again.",
  failed: "We couldn't create that account. Please try again.",
};

export default async function SignUpPage(props: PageProps<"/signup">) {
  const { error, pending } = await props.searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  // Set when the project requires email confirmation, so sign-up succeeded but
  // produced no session. Without this the visitor lands signed out and assumes
  // it silently failed.
  if (pending === "1") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-8">
        <h1 className="text-display-lg text-text-main">Check your email</h1>
        <Card>
          <div className="flex flex-col gap-4 p-5">
            <p className="text-body-lg text-text-main">
              Your account was created. Confirm your email address using the
              link we sent, then sign in.
            </p>
            <Link
              href="/signin"
              className="inline-flex h-touch items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
            >
              Go to sign in
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-8">
      <h1 className="text-display-lg text-text-main">Create an account</h1>

      <Card>
        <CardHeader title="New account" />
        <form action={signUp} className="flex flex-col gap-4 p-5">
          {message ? (
            <p
              role="alert"
              className="rounded border border-error/20 bg-error/10 px-3 py-2 text-body-md text-error"
            >
              {message}
            </p>
          ) : null}

          <Field
            id="signup-name"
            name="displayName"
            label="Display name"
            type="text"
            autoComplete="name"
            required
          />
          <Field
            id="signup-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
          />
          <Field
            id="signup-password"
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            required
          />

          <Button type="submit" variant="secondary" fullWidth>
            Create account
          </Button>
        </form>
      </Card>

      <p className="text-body-md text-text-muted">
        Already have an account?{" "}
        <Link href="/signin" className="text-link underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
