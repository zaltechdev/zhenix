export const workspaceSurfaceModes = ["live", "preview", "empty", "unavailable"] as const;

export type WorkspaceSurfaceMode = (typeof workspaceSurfaceModes)[number];
