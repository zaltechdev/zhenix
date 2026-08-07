import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/server/auth/better-auth";

export const { GET, POST } = toNextJsHandler(auth);
