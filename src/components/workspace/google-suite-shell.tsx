"use client";

import { useState } from "react";
import {
  Star,
  Cloud,
  FolderOpen,
  History,
  MessageSquare,
  Video,
  Lock,
  Share2,
  Calendar,
  CheckSquare,
  MapPin,
  Plus,
  X,
  Copy,
  Check
} from "lucide-react";

export type GoogleAppType = "docs" | "sheets" | "slides" | "drive" | "gmail";

const APP_CONFIG: Record<
  GoogleAppType,
  {
    name: string;
    iconBg: string;
    iconColor: string;
    brandColor: string;
    defaultTitle: string;
  }
> = {
  docs: {
    name: "Google Docs",
    iconBg: "#4285f4",
    iconColor: "#ffffff",
    brandColor: "#1a73e8",
    defaultTitle: "Tugas Kelompok"
  },
  sheets: {
    name: "Google Sheets",
    iconBg: "#0f9d58",
    iconColor: "#ffffff",
    brandColor: "#0f9d58",
    defaultTitle: "Historical Analysis"
  },
  slides: {
    name: "Google Slides",
    iconBg: "#f4b400",
    iconColor: "#ffffff",
    brandColor: "#f4b400",
    defaultTitle: "Portfolio"
  },
  drive: {
    name: "Google Drive",
    iconBg: "#1a73e8",
    iconColor: "#ffffff",
    brandColor: "#1a73e8",
    defaultTitle: "My Drive"
  },
  gmail: {
    name: "Gmail",
    iconBg: "#ea4335",
    iconColor: "#ffffff",
    brandColor: "#ea4335",
    defaultTitle: "Inbox"
  }
};

import {
  GoogleDocsIcon,
  GoogleSheetsIcon,
  GoogleSlidesIcon,
  GoogleDriveIcon,
  GoogleGmailIcon
} from "@/components/workspace/google-app-icons";

export function GoogleSuiteHeader({
  app,
  title,
  onTitleChange,
  onOpenShare
}: {
  app: GoogleAppType;
  title: string;
  onTitleChange?: (title: string) => void;
  onOpenShare?: () => void;
}) {
  const config = APP_CONFIG[app];
  const [isStarred, setIsStarred] = useState(false);

  return (
    <header className="gsuite-header">
      <div className="gsuite-header__left">
        <div
          className="gsuite-header__icon"
          title={config.name}
        >
          {app === "docs" && <GoogleDocsIcon className="w-9 h-9" />}
          {app === "sheets" && <GoogleSheetsIcon className="w-9 h-9" />}
          {app === "slides" && <GoogleSlidesIcon className="w-9 h-9" />}
          {app === "drive" && <GoogleDriveIcon className="w-9 h-9" />}
          {app === "gmail" && <GoogleGmailIcon className="w-9 h-9" />}
        </div>

        <div className="gsuite-header__meta">
          <div className="gsuite-header__title-row">
            <input
              type="text"
              className="gsuite-header__title-input"
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              aria-label="Document Title"
            />
            <div className="gsuite-header__title-actions">
              <button
                type="button"
                className="gsuite-icon-btn"
                onClick={() => setIsStarred(!isStarred)}
                title="Star"
                aria-label="Star document"
              >
                <Star
                  className="w-4 h-4"
                  fill={isStarred ? "#f4b400" : "none"}
                  stroke={isStarred ? "#f4b400" : "currentColor"}
                />
              </button>
              <button type="button" className="gsuite-icon-btn" title="Move" aria-label="Move folder">
                <FolderOpen className="w-4 h-4" />
              </button>
              <button type="button" className="gsuite-icon-btn" title="Document Status" aria-label="Saved to cloud">
                <Cloud className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="gsuite-menu-row">
            <button type="button" className="gsuite-menu-item">File</button>
            <button type="button" className="gsuite-menu-item">Edit</button>
            <button type="button" className="gsuite-menu-item">View</button>
            <button type="button" className="gsuite-menu-item">Insert</button>
            <button type="button" className="gsuite-menu-item">Format</button>
            <button type="button" className="gsuite-menu-item">Tools</button>
            <button type="button" className="gsuite-menu-item">Extensions</button>
            <button type="button" className="gsuite-menu-item">Help</button>
            <button type="button" className="gsuite-menu-item gsuite-menu-item--accent">
              Accessibility
            </button>
          </div>
        </div>
      </div>

      <div className="gsuite-header__right">
        <button type="button" className="gsuite-icon-btn" title="Version History">
          <History className="w-4 h-4 text-gray-600" />
        </button>
        <button type="button" className="gsuite-icon-btn" title="Comments">
          <MessageSquare className="w-4 h-4 text-gray-600" />
        </button>
        <button type="button" className="gsuite-icon-btn" title="Meet">
          <Video className="w-4 h-4 text-gray-600" />
        </button>
        <button
          type="button"
          className="gsuite-share-btn"
          onClick={onOpenShare}
          aria-label="Share document"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
        <div className="gsuite-avatar" title="Account">
          A
        </div>
      </div>
    </header>
  );
}

export function GoogleCompanionBar() {
  return (
    <aside className="gsuite-companion-bar" aria-label="Google side panel">
      <div className="gsuite-companion-icon text-blue-500" title="Google Calendar">
        <Calendar className="w-5 h-5" />
      </div>
      <div className="gsuite-companion-icon text-amber-500" title="Google Keep">
        <CheckSquare className="w-5 h-5" />
      </div>
      <div className="gsuite-companion-icon text-blue-600" title="Google Tasks">
        <CheckSquare className="w-5 h-5" />
      </div>
      <div className="gsuite-companion-icon text-red-500" title="Google Maps">
        <MapPin className="w-5 h-5" />
      </div>
      <div className="gsuite-toolbar__divider my-2" />
      <div className="gsuite-companion-icon text-gray-500" title="Get Add-ons">
        <Plus className="w-5 h-5" />
      </div>
    </aside>
  );
}

export function GoogleShareModal({
  title,
  isOpen,
  onClose
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1e1f20] rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share &ldquo;{title}&rdquo;
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
              Add people and groups
            </label>
            <input
              type="text"
              placeholder="Add emails or groups..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Share2 className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">General access</p>
                <p className="text-xs text-gray-500">Anyone with the link can view</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-100 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
