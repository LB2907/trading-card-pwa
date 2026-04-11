import type { User } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export type AdminRole = "user" | "moderator" | "admin";

export async function getProfileRoleForUser(user: User): Promise<AdminRole | null> {
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data?.role) return null;
  const r = data.role as string;
  if (r === "admin" || r === "moderator" || r === "user") return r;
  return "user";
}

export async function assertAdmin(user: User): Promise<boolean> {
  const role = await getProfileRoleForUser(user);
  return role === "admin";
}

export async function assertModeratorOrAdmin(user: User): Promise<boolean> {
  const role = await getProfileRoleForUser(user);
  return role === "admin" || role === "moderator";
}
