import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The session seam. Screens ask these helpers who the visitor is; they never
 * reach for a Supabase client themselves.
 */

/** `profiles.role` is a text column with a check constraint, not an enum. */
export type ProfileRole = "buyer" | "seller";

export type CurrentProfile = {
  profileId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: ProfileRole;
};

function toRole(value: string): ProfileRole {
  return value === "seller" ? "seller" : "buyer";
}

/**
 * The authenticated user, or null.
 *
 * `getUser()` and not `getSession()`: the latter returns whatever is in the
 * cookie without checking it, so it can be spoofed. Anything that gates access
 * must go through this.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  // An expired or absent session is a normal state, not a failure to report.
  if (error) return null;
  return data.user;
}

/**
 * The signed-in user joined to their `profiles` row, or null when signed out.
 *
 * The read runs under `profiles_select_own`, so RLS — not this query — is what
 * guarantees a caller only ever sees their own row.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, role")
    .eq("user_id", userData.user.id)
    .single();

  // A user with no profile row means the signup trigger did not fire. Treat it
  // as signed out rather than rendering a half-identity.
  if (profileError || !profile) return null;

  return {
    profileId: profile.id,
    userId: profile.user_id,
    email: userData.user.email ?? null,
    displayName: profile.display_name,
    role: toRole(profile.role),
  };
}

/**
 * The profile, or a redirect to sign-in. For routes that require a session.
 *
 * `redirect()` throws, so nothing after a failed call runs and no protected
 * content can leak into the response.
 */
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");
  return profile;
}

export type SellerContext = CurrentProfile & {
  sellerProfileId: string;
  storeName: string;
};

/**
 * The signed-in seller's context, or null when signed in as a buyer (or a
 * seller-role profile with no `seller_profiles` row, which should not
 * happen but is handled the same way rather than crashing). Signed-out
 * visitors are redirected to `/signin` by the `requireProfile()` call below,
 * same as every other gated route.
 *
 * Callers get `null` for "not a seller" so the page can render a role-denied
 * state instead of a redirect loop — a buyer visiting `/seller/*` has done
 * nothing wrong, they're just in the wrong place.
 */
export async function requireSellerProfile(): Promise<SellerContext | null> {
  const profile = await requireProfile();
  if (profile.role !== "seller") return null;

  const supabase = await createClient();
  const { data: seller, error } = await supabase
    .from("seller_profiles")
    .select("id, store_name")
    .eq("profile_id", profile.profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load seller profile: ${error.message}`);
  }
  if (!seller) return null;

  return {
    ...profile,
    sellerProfileId: seller.id,
    storeName: seller.store_name,
  };
}
