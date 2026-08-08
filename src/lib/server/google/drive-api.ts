import { assertServerOnly } from "@/lib/server/server-guard";
import { contentLimits } from "@/lib/server/config/runtime-config";
import { fetchGoogleJson, GoogleApiError } from "@/lib/server/google/http";
import type { DriveItem, DriveListing } from "@/lib/contracts/google";

assertServerOnly("src/lib/server/google/drive-api.ts");

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

type GoogleDriveFile = {
  id?: unknown;
  name?: unknown;
  mimeType?: unknown;
  modifiedTime?: unknown;
  size?: unknown;
  parents?: unknown;
  webViewLink?: unknown;
  capabilities?: {
    canEdit?: unknown;
    canRename?: unknown;
    canMoveItemWithinDrive?: unknown;
  };
};

type GoogleDriveListResponse = {
  files?: GoogleDriveFile[];
  nextPageToken?: unknown;
  incompleteSearch?: unknown;
};

function escapeDriveQuery(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function toDriveItem(file: GoogleDriveFile): DriveItem | null {
  if (typeof file.id !== "string" || typeof file.name !== "string" || typeof file.mimeType !== "string") {
    return null;
  }

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    category: file.mimeType === GOOGLE_DOC_MIME ? "document" : "other",
    parentId: Array.isArray(file.parents) && typeof file.parents[0] === "string" ? file.parents[0] : null,
    parentName: null,
    modifiedAt: typeof file.modifiedTime === "string" ? Date.parse(file.modifiedTime) || null : null,
    sizeBytes: typeof file.size === "string" && /^\d+$/.test(file.size) ? Number(file.size) : null,
    webViewAvailable: typeof file.webViewLink === "string" && file.webViewLink.length > 0,
    canRead: true,
    canRename: asBoolean(file.capabilities?.canRename),
    canMove: asBoolean(file.capabilities?.canMoveItemWithinDrive)
  };
}

export async function listGoogleDocuments(
  accessToken: string,
  query = "",
  pageToken: string | null = null
): Promise<DriveListing> {
  const params = new URLSearchParams({
    q: `mimeType='${GOOGLE_DOC_MIME}' and trashed=false${query.trim() ? ` and name contains '${escapeDriveQuery(query.trim())}'` : ""}`,
    pageSize: String(contentLimits().drivePageSize),
    orderBy: "modifiedTime desc",
    spaces: "drive",
    fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime,size,parents,webViewLink,capabilities(canEdit,canRename,canMoveItemWithinDrive))"
  });
  if (pageToken) params.set("pageToken", pageToken);

  const raw = await fetchGoogleJson<GoogleDriveListResponse>(
    `${DRIVE_FILES_URL}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    },
    "drive.files.list"
  );

  const items = (raw.files ?? []).map(toDriveItem).filter((item): item is DriveItem => item !== null);

  return {
    items,
    nextPageToken: typeof raw.nextPageToken === "string" ? raw.nextPageToken : null,
    incompleteSearch: raw.incompleteSearch === true,
    query: query.trim() || null
  };
}

export async function getGoogleDriveItem(accessToken: string, itemId: string): Promise<DriveItem> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,modifiedTime,size,parents,webViewLink,capabilities(canEdit,canRename,canMoveItemWithinDrive)"
  });
  const raw = await fetchGoogleJson<GoogleDriveFile>(
    `${DRIVE_FILES_URL}/${encodeURIComponent(itemId)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    },
    "drive.files.get"
  );
  const item = toDriveItem(raw);
  if (!item) throw new GoogleApiError(500, "drive.files.get");
  return item;
}
