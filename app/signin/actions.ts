"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * A Server Action is a public POST endpoint, so every field is untrusted and
 * validated here rather than trusting the form that rendered it.
 *
 * Failures redirect back with an opaque code rather than a message. The code
 * says "a sign-in failed" — which whoever just failed already knows — and
 * never the email or the password, so nothing sensitive reaches the URL bar,
 * the browser history or the server access log.
 *
 * Inline state via `useActionState` would need a client component, and the
 * whole repo is server-rendered and works with JavaScript off. A redirect
 * keeps that property.
 */

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function signIn(formData: FormData): Promise<void> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");

  if (!email || !password) redirect("/signin?error=missing");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // One message for both "no such user" and "wrong password": distinguishing
  // them turns the form into an oracle for which emails have accounts.
  if (error) redirect("/signin?error=invalid");

  // Layout scope, matching the existing actions — the header renders auth
  // state as well as the cart badge, and page scope would leave it stale.
  revalidatePath("/", "layout");
  redirect("/");
}
