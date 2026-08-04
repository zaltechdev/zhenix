import { cookies } from "next/headers";
import { baseLocale, toLocale } from "@/paraglide/runtime.js";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  return toLocale(cookieStore.get("PARAGLIDE_LOCALE")?.value) ?? baseLocale;
}
