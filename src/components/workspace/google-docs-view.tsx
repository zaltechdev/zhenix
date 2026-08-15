"use client";

import { useState, useEffect } from "react";
import {
  Undo,
  Redo,
  Printer,
  SpellCheck,
  PaintBucket,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Link,
  MessageSquarePlus,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Plus,
  FileText,
  MoreVertical,
  Minus
} from "lucide-react";
import { GoogleSuiteHeader, GoogleCompanionBar, GoogleShareModal } from "@/components/workspace/google-suite-shell";

const INITIAL_DOC_BODY = `The history of modern computing began in the late 1930s with the pioneering work of Dr. John Atanasoff and Clifford Berry at Iowa State University, who built the first electronic computer to assist with complex mathematical computations. This era saw the development of the ENIAC in 1946, the first large-scale, general-purpose digital computer. Occupying a massive 30-by-50-foot space and weighing 30 tons, the ENIAC relied on thousands of vacuum tubes to perform calculations for the U.S. Army, such as predicting weather patterns and computing ballistics tables. These early machines laid the groundwork for a technological revolution, transitioning from mechanical processes to electronic data transformation.

As technology advanced, computers underwent a series of generational shifts characterized by the miniaturization of components and rapid expansion of computational power. The first generation's reliance on bulky vacuum tubes eventually gave way to smaller, faster, and more reliable transistors in the late 1950s, followed by integrated circuits in the 1960s, and ultimately the microprocessor in the 1970s.`;

export function GoogleDocsView() {
  const [docTitle, setDocTitle] = useState("Tugas Kelompok");
  const [docHeading, setDocHeading] = useState("The Evolution of Computing: From ENIAC to the Microprocessor");
  const [docContent, setDocContent] = useState(INITIAL_DOC_BODY);
  const [fontSize, setFontSize] = useState(26);
  const [fontFamily, setFontFamily] = useState("Playfair Display");
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [alignment, setAlignment] = useState<"left" | "center" | "right" | "justify">("left");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("First page");

  useEffect(() => {
    // Initial fetch from API
    async function loadDoc() {
      try {
        const res = await fetch("/api/google/docs/demo-doc-tugas-kelompok");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ready" && data.data) {
            setDocTitle(data.data.title || "Tugas Kelompok");
            const blocks = data.data.blocks;
            if (Array.isArray(blocks) && blocks.length > 0) {
              const fullText = blocks.map((b: { plainText: string }) => b.plainText).filter(Boolean).join("\n\n");
              if (fullText) {
                setDocContent(fullText);
              }
            }
          }
        }
      } catch {
        // Fallback to initial state
      }
    }
    void loadDoc();

    // Listen to live agent document updates
    const handleDocumentAppend = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string; documentId?: string }>;
      const textToAppend = customEvent.detail?.text;
      if (!textToAppend) return;

      setDocContent((prev) => {
        const separator = prev.endsWith("\n\n") ? "" : prev.endsWith("\n") ? "\n" : "\n\n";
        return `${prev}${separator}${textToAppend}`;
      });

      // Auto scroll canvas to bottom
      setTimeout(() => {
        const scrollEl = document.querySelector(".gsuite-canvas-scroll");
        if (scrollEl) {
          scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
        }
      }, 50);
    };

    window.addEventListener("aksa:document_append", handleDocumentAppend);
    return () => {
      window.removeEventListener("aksa:document_append", handleDocumentAppend);
    };
  }, []);

  return (
    <div className="gsuite-container">
      {/* 1:1 Google Docs Header */}
      <GoogleSuiteHeader
        app="docs"
        title={docTitle}
        onTitleChange={setDocTitle}
        onOpenShare={() => setShareModalOpen(true)}
      />

      {/* 1:1 Google Docs Toolbar */}
      <div className="gsuite-toolbar" role="toolbar" aria-label="Editing toolbar">
        <button type="button" className="gsuite-toolbar__btn" title="Undo (Ctrl+Z)" aria-label="Undo">
          <Undo className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Redo (Ctrl+Y)" aria-label="Redo">
          <Redo className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Print" aria-label="Print">
          <Printer className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Spelling and grammar" aria-label="Spell check">
          <SpellCheck className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Paint format" aria-label="Paint format">
          <PaintBucket className="w-4 h-4" />
        </button>

        <div className="gsuite-toolbar__divider" />

        <select className="gsuite-toolbar__select" defaultValue="100%">
          <option>100%</option>
          <option>75%</option>
          <option>125%</option>
          <option>Fit</option>
        </select>

        <div className="gsuite-toolbar__divider" />

        <select className="gsuite-toolbar__select" defaultValue="Title">
          <option>Normal text</option>
          <option>Title</option>
          <option>Heading 1</option>
          <option>Heading 2</option>
        </select>

        <select
          className="gsuite-toolbar__select"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
        >
          <option value="Playfair Display">Playfair...</option>
          <option value="Arial">Arial</option>
          <option value="Inter">Inter</option>
          <option value="Roboto">Roboto</option>
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="gsuite-toolbar__btn"
            onClick={() => setFontSize(Math.max(8, fontSize - 1))}
            title="Decrease font size"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-semibold px-1.5 py-0.5 border border-gray-300 rounded">
            {fontSize}
          </span>
          <button
            type="button"
            className="gsuite-toolbar__btn"
            onClick={() => setFontSize(fontSize + 1)}
            title="Increase font size"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="gsuite-toolbar__divider" />

        <button
          type="button"
          className={`gsuite-toolbar__btn ${isBold ? "gsuite-toolbar__btn--active" : ""}`}
          onClick={() => setIsBold(!isBold)}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`gsuite-toolbar__btn ${isItalic ? "gsuite-toolbar__btn--active" : ""}`}
          onClick={() => setIsItalic(!isItalic)}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`gsuite-toolbar__btn ${isUnderline ? "gsuite-toolbar__btn--active" : ""}`}
          onClick={() => setIsUnderline(!isUnderline)}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Highlight color">
          <Highlighter className="w-4 h-4" />
        </button>

        <div className="gsuite-toolbar__divider" />

        <button type="button" className="gsuite-toolbar__btn" title="Insert link">
          <Link className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Add comment">
          <MessageSquarePlus className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Insert image">
          <ImageIcon className="w-4 h-4" />
        </button>

        <div className="gsuite-toolbar__divider" />

        <button
          type="button"
          className={`gsuite-toolbar__btn ${alignment === "left" ? "gsuite-toolbar__btn--active" : ""}`}
          onClick={() => setAlignment("left")}
          title="Left align"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`gsuite-toolbar__btn ${alignment === "center" ? "gsuite-toolbar__btn--active" : ""}`}
          onClick={() => setAlignment("center")}
          title="Center align"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`gsuite-toolbar__btn ${alignment === "right" ? "gsuite-toolbar__btn--active" : ""}`}
          onClick={() => setAlignment("right")}
          title="Right align"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`gsuite-toolbar__btn ${alignment === "justify" ? "gsuite-toolbar__btn--active" : ""}`}
          onClick={() => setAlignment("justify")}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </button>

        <div className="gsuite-toolbar__divider" />

        <button type="button" className="gsuite-toolbar__btn" title="Checklist">
          <CheckSquare className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Bulleted list">
          <List className="w-4 h-4" />
        </button>
        <button type="button" className="gsuite-toolbar__btn" title="Numbered list">
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>

      {/* Main Work Area: Document Tabs + White Paper Page + Companion Bar */}
      <div className="gsuite-work-area">
        {/* Left Document Tabs */}
        <aside className="gsuite-doc-tabs">
          <div className="gsuite-doc-tabs__header">
            <span>Document tabs</span>
            <button type="button" className="gsuite-icon-btn" title="Add tab">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div
            className={`gsuite-doc-tab-item ${activeTab === "First page" ? "gsuite-doc-tab-item--active" : ""}`}
            onClick={() => setActiveTab("First page")}
          >
            <FileText className="w-4 h-4" />
            <span className="flex-1">First page</span>
            <MoreVertical className="w-3.5 h-3.5 opacity-60" />
          </div>

          <a href="#doc-title" className="gsuite-doc-sublink">
            {docHeading.length > 22 ? `${docHeading.substring(0, 22)}...` : docHeading}
          </a>
        </aside>

        {/* Center Document Canvas (Paper) */}
        <div className="gsuite-canvas-scroll">
          <div
            className="gsuite-doc-paper"
            style={{
              textAlign: alignment,
              fontFamily: fontFamily === "Playfair Display" ? "Playfair Display, Georgia, serif" : fontFamily
            }}
          >
            <h1
              id="doc-title"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setDocHeading(e.currentTarget.textContent || "")}
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: isBold ? 700 : 400,
                fontStyle: isItalic ? "italic" : "normal",
                textDecoration: isUnderline ? "underline" : "none"
              }}
            >
              {docHeading}
            </h1>

            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setDocContent(e.currentTarget.innerText || "")}
              className="outline-none whitespace-pre-wrap"
              style={{
                fontSize: "15px",
                lineHeight: "1.7"
              }}
            >
              {docContent}
            </div>
          </div>
        </div>

        {/* Right Companion Dock */}
        <GoogleCompanionBar />
      </div>

      {/* Share Modal Dialog */}
      <GoogleShareModal
        title={docTitle}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
