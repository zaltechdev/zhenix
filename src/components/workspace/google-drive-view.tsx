"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Home,
  HardDrive,
  Users,
  Clock,
  Star,
  Trash2,
  Folder,
  File,
  Grid,
  List as ListIcon,
  MoreVertical,
  SlidersHorizontal,
  Cloud
} from "lucide-react";
import { GoogleCompanionBar } from "@/components/workspace/google-suite-shell";
import {
  GoogleDriveIcon,
  GoogleDocsIcon,
  GoogleSheetsIcon
} from "@/components/workspace/google-app-icons";

type DriveItemType = {
  id: string;
  name: string;
  type: "folder" | "doc" | "sheet" | "pdf";
  modified: string;
  owner: string;
  size?: string;
};

const INITIAL_ITEMS: DriveItemType[] = [
  { id: "1", name: "Rencana Peluncuran Aksa 2026", type: "doc", modified: "Aug 14, 2026", owner: "me", size: "45 KB" },
  { id: "2", name: "Accessibility Research Notes", type: "pdf", modified: "Aug 13, 2026", owner: "me", size: "1.2 MB" },
  { id: "3", name: "Project Budget Q3", type: "sheet", modified: "Aug 12, 2026", owner: "Finance", size: "85 KB" },
  { id: "4", name: "ENDING 5 - System Design", type: "folder", modified: "Aug 10, 2026", owner: "Maya" },
  { id: "5", name: "ENDING 4 - Presentation Assets", type: "folder", modified: "Aug 9, 2026", owner: "Maya" },
  { id: "6", name: "TEMPLATE PRAKTIKUM VIBECODE", type: "doc", modified: "Aug 8, 2026", owner: "Prof. Hendra", size: "110 KB" },
  { id: "7", name: "RESPONSI 1 SISTEM DIGITAL", type: "pdf", modified: "Aug 5, 2026", owner: "me", size: "3.4 MB" },
  { id: "8", name: "ENDING 3 - UI Prototype", type: "folder", modified: "Aug 4, 2026", owner: "me" }
];

export function GoogleDriveView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"home" | "my-drive" | "shared" | "recent" | "starred" | "trash">("shared");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [items, setItems] = useState<DriveItemType[]>(INITIAL_ITEMS);

  const folders = useMemo(() => {
    return items.filter((i) => i.type === "folder" && (!searchQuery.trim() || i.name.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [items, searchQuery]);

  const files = useMemo(() => {
    return items.filter((i) => i.type !== "folder" && (!searchQuery.trim() || i.name.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [items, searchQuery]);

  return (
    <div className="gsuite-container">
      {/* Google Drive Header */}
      <header className="gsuite-header">
        <div className="flex items-center gap-3">
          <GoogleDriveIcon className="w-9 h-9 flex-shrink-0" />
          <span className="gdrive-title">Drive</span>
        </div>

        <div className="flex-1 max-w-2xl mx-8">
          <div className="gsuite-search-pill">
            <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              className="gsuite-search-input"
              placeholder="Search in Drive"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <SlidersHorizontal className="w-4 h-4 text-gray-500 cursor-pointer hover:text-gray-700" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="gsuite-avatar" title="Account">A</div>
        </div>
      </header>

      {/* Main Drive Layout */}
      <div className="gdrive-main-layout">
        {/* Drive Left Navigation Sidebar */}
        <aside className="gdrive-sidebar">
          <button
            type="button"
            className="gdrive-new-btn"
            onClick={() => {
              const newDoc: DriveItemType = {
                id: String(Date.now()),
                name: "Untitled Document",
                type: "doc",
                modified: "Just now",
                owner: "me",
                size: "0 KB"
              };
              setItems((prev) => [newDoc, ...prev]);
            }}
          >
            <Plus className="w-6 h-6 text-blue-600 font-bold" />
            <span>New</span>
          </button>

          <nav className="flex flex-col gap-1">
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "home" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => setActiveSection("home")}
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "my-drive" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => setActiveSection("my-drive")}
            >
              <HardDrive className="w-4 h-4" />
              <span>My Drive</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "shared" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => setActiveSection("shared")}
            >
              <Users className="w-4 h-4" />
              <span>Shared with me</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "recent" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => setActiveSection("recent")}
            >
              <Clock className="w-4 h-4" />
              <span>Recent</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "starred" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => setActiveSection("starred")}
            >
              <Star className="w-4 h-4" />
              <span>Starred</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "trash" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => setActiveSection("trash")}
            >
              <Trash2 className="w-4 h-4" />
              <span>Trash</span>
            </button>
          </nav>

          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Cloud className="w-4 h-4" />
              <span>Storage (7.21 GB of 15 GB used)</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: "48%" }} />
            </div>
          </div>
        </aside>

        {/* Content Scroll View */}
        <div className="gdrive-content-scroll">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
            <h1 className="gdrive-header-title capitalize">
              {activeSection === "shared" ? "Shared with me" : activeSection.replace("-", " ")}
            </h1>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`gsuite-icon-btn ${viewMode === "grid" ? "bg-gray-200 dark:bg-gray-700" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={`gsuite-icon-btn ${viewMode === "list" ? "bg-gray-200 dark:bg-gray-700" : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 py-3">
            {["Type", "People", "Modified", "Source"].map((chip) => (
              <button key={chip} type="button" className="gdrive-filter-chip">
                {chip} ▾
              </button>
            ))}
          </div>

          {/* Folders Section */}
          {folders.length > 0 && (
            <div>
              <h2 className="gdrive-section-title">Folders</h2>
              <div className="gdrive-folder-grid">
                {folders.map((folder) => (
                  <div key={folder.id} className="gdrive-folder-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <Folder className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" fill="currentColor" fillOpacity={0.2} />
                      <span className="gdrive-folder-name" title={folder.name}>
                        {folder.name}
                      </span>
                    </div>
                    <MoreVertical className="w-4 h-4 text-gray-400 hover:text-gray-700 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {files.length > 0 && (
            <div>
              <h2 className="gdrive-section-title">Files</h2>
              <div className="gdrive-grid">
                {files.map((file) => (
                  <div key={file.id} className="gdrive-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {file.type === "doc" && <GoogleDocsIcon className="w-4 h-4 flex-shrink-0" />}
                        {file.type === "sheet" && <GoogleSheetsIcon className="w-4 h-4 flex-shrink-0" />}
                        {file.type === "pdf" && <File className="w-4 h-4 text-red-600 flex-shrink-0" />}
                        <span className="gdrive-card__name" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <MoreVertical className="w-4 h-4 text-gray-400 hover:text-gray-700 flex-shrink-0" />
                    </div>

                    {/* Preview canvas */}
                    <div className="gdrive-card__preview">
                      <div className="w-3/4 h-2.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-sm" />
                      <div className="w-5/6 h-2 bg-gray-200 dark:bg-gray-700 rounded-sm" />
                      <div className="w-2/3 h-2 bg-gray-200 dark:bg-gray-700 rounded-sm" />
                    </div>

                    <div className="gdrive-card__footer">
                      <span className="font-medium text-gray-600 dark:text-gray-400">{file.owner}</span>
                      <span>{file.modified}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Companion Bar */}
        <GoogleCompanionBar />
      </div>
    </div>
  );
}
