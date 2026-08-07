/**
 * Shared Aksa contracts.
 *
 * These types and schemas are the only vocabulary crossing the Henix and Zaltech
 * boundary. Components consume them. Server services produce them. No database
 * row, Google payload, provider response, or reasoning trace appears here.
 */
export * from "@/lib/contracts/errors";
export * from "@/lib/contracts/resource-state";
export * from "@/lib/contracts/capability";
export * from "@/lib/contracts/command";
export * from "@/lib/contracts/task";
export * from "@/lib/contracts/activity";
export * from "@/lib/contracts/confirmation";
export * from "@/lib/contracts/undo";
export * from "@/lib/contracts/google";
export * from "@/lib/contracts/search";
export * from "@/lib/contracts/auth";
