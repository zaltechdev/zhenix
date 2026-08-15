"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Undo,
  Redo,
  Printer,
  Bold,
  Italic,
  Play,
  Plus
} from "lucide-react";
import { GoogleSuiteHeader, GoogleCompanionBar, GoogleShareModal } from "@/components/workspace/google-suite-shell";

type SlideItem = {
  id: number;
  title: string;
  subtitle?: string;
  content: string;
  notes: string;
};

const INITIAL_SLIDES: SlideItem[] = [
  {
    id: 1,
    title: "Your Name",
    subtitle: "Digital experience designer",
    content: "Portfolio Presentation\nAksa Accessibility Innovation 2026",
    notes: "Welcome the audience and introduce the presentation goals."
  },
  {
    id: 2,
    title: "About me",
    subtitle: "---",
    content: "I'm passionate about building great products that make people's lives easier. I have over 10 years of experience strategizing innovative digital experiences for small startups to the world's biggest brands.\n\nI grew up in Anytown, am an avid kayaker, and I'm excited to partner with you!",
    notes: "Highlight key design principles and accessibility focus."
  },
  {
    id: 3,
    title: "Skills & expertise",
    content: "• Motion design & Micro-interactions\n• User experience & Accessibility research\n• Physical computing & Vision head tracking\n• Accessible Web Architecture (Next.js / Turbopack)",
    notes: "Discuss technical architecture and performance benchmarks."
  },
  {
    id: 4,
    title: "Portfolio samples",
    subtitle: "Featured Case Studies",
    content: "1. Aksa: Accessible AI Workspace for Disabled Users\n2. Real-time Head Control & Voice Navigation Engine\n3. 1:1 Google Workspace Integration Canvas",
    notes: "Demonstrate live Aksa AI command execution."
  }
];

export function GoogleSlidesView() {
  const [presentationTitle, setPresentationTitle] = useState("Portfolio");
  const [slides, setSlides] = useState<SlideItem[]>(INITIAL_SLIDES);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const activeSlide = slides[activeSlideIndex] || slides[0];

  const handleUpdateSlideText = useCallback((field: "title" | "subtitle" | "content" | "notes", val: string) => {
    setSlides((prev) =>
      prev.map((s, idx) => (idx === activeSlideIndex ? { ...s, [field]: val } : s))
    );
  }, [activeSlideIndex]);

  useEffect(() => {
    const handleSlideAppend = (event: Event) => {
      const customEvent = event as CustomEvent<{
        title?: string;
        subtitle?: string;
        content?: string;
        notes?: string;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      const newSlide: SlideItem = {
        id: Date.now(),
        title: detail.title || "Slide Baru",
        subtitle: detail.subtitle,
        content: detail.content || "Konten presentasi",
        notes: detail.notes || ""
      };

      setSlides((prev) => [...prev, newSlide]);
      setActiveSlideIndex((prevIndex) => prevIndex + 1);
    };

    const handleSlideUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        field: "title" | "subtitle" | "content" | "notes";
        value: string;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;
      handleUpdateSlideText(detail.field, detail.value);
    };

    window.addEventListener("aksa:slide_append", handleSlideAppend);
    window.addEventListener("aksa:slide_update", handleSlideUpdate);
    return () => {
      window.removeEventListener("aksa:slide_append", handleSlideAppend);
      window.removeEventListener("aksa:slide_update", handleSlideUpdate);
    };
  }, [handleUpdateSlideText]);

  return (
    <div className="gsuite-container">
      {/* Google Slides Top Bar */}
      <GoogleSuiteHeader
        app="slides"
        title={presentationTitle}
        onTitleChange={setPresentationTitle}
        onOpenShare={() => setShareModalOpen(true)}
      />

      {/* Toolbar */}
      <div className="gsuite-toolbar" role="toolbar" aria-label="Slides toolbar">
        <button type="button" className="gsuite-toolbar__btn"><Undo className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn"><Redo className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn"><Printer className="w-4 h-4" /></button>

        <div className="gsuite-toolbar__divider" />

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold rounded-full text-xs hover:bg-amber-100 transition"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Slideshow</span>
        </button>

        <div className="gsuite-toolbar__divider" />

        <button type="button" className="gsuite-toolbar__btn font-bold"><Bold className="w-4 h-4" /></button>
        <button type="button" className="gsuite-toolbar__btn italic"><Italic className="w-4 h-4" /></button>

        <div className="gsuite-toolbar__divider" />

        <button
          type="button"
          className="gsuite-toolbar__btn"
          onClick={() => {
            const newSlide: SlideItem = {
              id: slides.length + 1,
              title: "Untitled Slide",
              content: "Click to add text",
              notes: ""
            };
            setSlides((prev) => [...prev, newSlide]);
          }}
          title="New Slide"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Main Work Area: Filmstrip + 16:9 Canvas + Companion */}
      <div className="gslides-main-layout">
        {/* Left Filmstrip */}
        <aside className="gslides-filmstrip">
          {slides.map((s, idx) => (
            <div
              key={s.id}
              className={`gslides-thumb ${activeSlideIndex === idx ? "gslides-thumb--active" : ""}`}
              onClick={() => setActiveSlideIndex(idx)}
            >
              <div className="text-center truncate px-1">
                <span className="block text-[10px] font-bold opacity-60">Slide {idx + 1}</span>
                <span className="truncate block">{s.title}</span>
              </div>
            </div>
          ))}
        </aside>

        {/* Center 16:9 Presentation Canvas */}
        <div className="gslides-canvas-center">
          <div className="gslides-slide-sheet">
            <h1
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => handleUpdateSlideText("title", e.currentTarget.innerText || "")}
              className="text-3xl font-bold text-gray-900 dark:text-white mb-2 outline-none"
            >
              {activeSlide.title}
            </h1>

            {activeSlide.subtitle && (
              <h2
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleUpdateSlideText("subtitle", e.currentTarget.innerText || "")}
                className="text-lg font-medium text-gray-500 mb-4 outline-none"
              >
                {activeSlide.subtitle}
              </h2>
            )}

            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => handleUpdateSlideText("content", e.currentTarget.innerText || "")}
              className="text-base text-gray-700 dark:text-gray-300 leading-relaxed outline-none whitespace-pre-wrap flex-1"
            >
              {activeSlide.content}
            </div>
          </div>

          {/* Speaker notes */}
          <div className="w-full max-w-[800px] mt-4 p-3 bg-white dark:bg-[#1e1f20] rounded-lg border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-semibold block mb-1">Speaker notes:</span>
            <input
              type="text"
              value={activeSlide.notes}
              onChange={(e) => handleUpdateSlideText("notes", e.target.value)}
              className="w-full bg-transparent border-none outline-none font-inherit text-inherit"
              placeholder="Click to add speaker notes..."
            />
          </div>
        </div>

        {/* Right Companion Bar */}
        <GoogleCompanionBar />
      </div>

      {/* Share Modal Dialog */}
      <GoogleShareModal
        title={presentationTitle}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
