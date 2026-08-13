"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Account creation.
 *
 * The display name travels as `options.data`, which Supabase stores on
 * `auth.users.raw_user_meta_data`. That is deliberate and not a convenience:
 * `profiles` has no INSERT policy, because `handle_new_user()` owns profile
 * creation and reads `raw_user_meta_data ->> 'display_name'` from the trigger.
 * Writing to `profiles` from here would be denied by RLS, and adding a policy
 * to make it work would be weakening RLS to fit the client.
 *
 * The new profile gets `role = 'buyer'` from the column default. Nothing here
 * grants seller — that needs a `seller_profiles` row too, and is its own step.
 */

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Supabase error codes → the opaque codes the form knows how to render. */
function signUpErrorCode(code: string | undefined, message: string): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "exists";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "ratelimited";
    case "email_address_invalid":
      return "bademail";
    case "weak_password":
      return "weak";
    default:
      // Older releases report the duplicate case through the message only.
      return message.toLowerCase().includes("already registered")
        ? "exists"
        : "failed";
  }
}

export async function signUp(formData: FormData): Promise<void> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const displayName = readString(formData, "displayName");

  if (!email || !password || !displayName) redirect("/signup?error=missing");

  // Supabase enforces its own minimum, but failing here costs no round trip
  // and lets the form say something specific.
  if (password.length < 8) redirect("/signup?error=weak");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    // Map by Supabase's stable `code`, not by matching on `message` — the
    // wording is not part of the API contract and changes between releases.
    //
    // Rate limiting is not a corner case here: this project has email
    // confirmation enabled, so every attempt sends mail and the per-hour cap
    // is reachable by an ordinary person mistyping their address twice. A
    // generic "something went wrong" invites them to retry immediately, which
    // is the one thing guaranteed not to work.
    redirect(`/signup?error=${signUpErrorCode(error.code, error.message)}`);
  }

  // With email confirmation enabled, Supabase returns a user with an empty
  // `identities` array for an address that already exists, rather than an
  // error — deliberate, so the form cannot be used to enumerate accounts.
  if (data.user && data.user.identities?.length === 0) {
    redirect("/signup?error=exists");
  }

  // No session means the project requires email confirmation. Say so instead
  // of redirecting to a signed-out home page that looks like a silent failure.
  if (!data.session) redirect("/signup?pending=1");

  revalidatePath("/", "layout");
  redirect("/");
}
