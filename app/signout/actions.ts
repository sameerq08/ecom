"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out has no page of its own — the header and `/account` import this
 * action straight into a `<form>`.
 *
 * `signOut()` clears the session cookies server-side rather than just dropping
 * client state, so the session is genuinely revoked and not merely forgotten
 * by one browser tab.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
