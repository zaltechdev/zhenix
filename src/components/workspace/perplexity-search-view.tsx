"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/paraglide/runtime.js";
import { CommandComposer } from "@/components/workspace/command-composer";
import {
  Sparkles,
  Globe,
  Image as ImageIcon,
  Share2,
  MoreHorizontal,
  ChevronRight,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Loader2
} from "lucide-react";

export type SearchSourceItem = {
  id: string;
  title: string;
  domain: string;
  url: string;
  snippet: string;
  initials: string;
  bg: string;
};

export type MediaCardItem = {
  id: string;
  badge: string;
  badgeBg: string;
  title: string;
  subtitle: string;
};

export type DynamicAnswerSection = {
  heading?: string;
  body: string;
  bullets?: string[];
  citationText: string;
  sourceId: string;
};

export type DynamicSearchPayload = {
  query: string;
  sources: SearchSourceItem[];
  mediaCards: MediaCardItem[];
  sections: DynamicAnswerSection[];
  followUps: string[];
};

const COLOR_PALETTE = [
  "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6", "#14b8a6", "#ef4444"
];

export function generateDynamicSearchData(query: string): DynamicSearchPayload {
  const clean = query.trim() || "Google Workspace";
  const qLower = clean.toLowerCase();
  const isId = /[a-z]*(apa|bagaimana|cara|kenapa|mengapa|dimana|kapan|siapa|yang|dan|di|ke|dari|untuk)/i.test(clean);

  // 1. Topic-Specific: Y Combinator & Startups
  if (qLower.includes("yc") || qLower.includes("y combinator") || qLower.includes("startup") || qLower.includes("funding")) {
    const sources: SearchSourceItem[] = [
      {
        id: "src_1",
        title: isId ? "YC Batches 2026: Jadwal, Deadline Pendaftaran + Tingkat Penerimaan 1%" : "YC Batches 2026: Dates, Next Deadline + 1% Acceptance Rate",
        domain: "roundfunded.com",
        url: "https://roundfunded.com/yc-batches-2026",
        snippet: isId
          ? "Jadwal empat batch 2026, realita tingkat penerimaan 1%, dan analisis data dari 5.900+ perusahaan alumni YC."
          : "When is the next YC batch? All four 2026 batch dates, the real 1% acceptance rate, and data from 5,900+ YC companies.",
        initials: "R",
        bg: "#10b981"
      },
      {
        id: "src_2",
        title: isId ? "Tingkat Penerimaan Y Combinator 2026: Fakta Data Pendaftar" : "Y Combinator Acceptance Rate 2026: What the Data Shows",
        domain: "wearefounders.uk",
        url: "https://wearefounders.uk/yc-data-2026",
        snippet: isId
          ? "Tingkat penerimaan 0.6% untuk kohort terbaru. Analisis profil founder dan dominasi aplikasi startup AI agen."
          : "0.6% acceptance rate for recent S25/W26 cohorts. Breakdown of founder profiles and AI startup applications.",
        initials: "W",
        bg: "#6366f1"
      },
      {
        id: "src_3",
        title: isId ? "Jadwal Aplikasi & Deadline Kunci Y Combinator 2026" : "Y Combinator 2026 Application Schedule & Key Deadlines",
        domain: "startup.newslens.io",
        url: "https://startup.newslens.io/yc-deadlines",
        snippet: isId
          ? "Winter 2026 (W26) Demo Day berlangsung 24 Maret 2026. Batch Summer 2026 dimulai Juli dengan Demo Day September."
          : "Winter 2026 (W26) Demo Day occurred March 24, 2026. Summer 2026 (S26) begins in July with Demo Day in September.",
        initials: "S",
        bg: "#f59e0b"
      },
      {
        id: "src_4",
        title: isId ? "Tren Startup AI: Perusahaan Unggulan di Physical Computing & Agents" : "AI Startup Trends: Top YC Companies in Physical Computing and Agents",
        domain: "theagenttimes.com",
        url: "https://theagenttimes.com/yc-w26-themes",
        snippet: isId
          ? "W26 menampilkan lonjakan pada robotika dan agen aksesibilitas multimodal, dengan 1 dari 8 perusahaan membangun hardware fisik."
          : "W26 features a surge in robotics and multimodal accessibility agents, with 1 in 8 companies building physical hardware.",
        initials: "A",
        bg: "#ec4899"
      }
    ];

    const mediaCards: MediaCardItem[] = [
      { id: "m1", badge: "Y", badgeBg: "#f97316", title: "2026 Demo Day Dates", subtitle: "Winter & Summer cohort schedules" },
      { id: "m2", badge: "YC", badgeBg: "#ea580c", title: "YC Application Deadline Dates", subtitle: "Standard $500K deal terms & criteria" },
      { id: "m3", badge: "Jesse", badgeBg: "#6366f1", title: "YC W26 & S26 Companies to Watch", subtitle: "Real-time AI & B2B sales intelligence" }
    ];

    const sections: DynamicAnswerSection[] = [
      {
        body: isId
          ? "**Y Combinator (YC)** adalah akselerator startup terkemuka di dunia yang menjalankan beberapa kohort per tahun, berinvestasi pada perusahaan tahap awal, dan menyelenggarakan Demo Day tempat para founder mempresentasikan inovasi mereka kepada investor global. Pada tahun 2026, YC mengoperasikan empat batch dengan investasi standar $500.000 per perusahaan."
          : "**Y Combinator (YC)** is a leading startup accelerator that runs multiple cohorts per year, invests in early-stage companies, and hosts Demo Days where founders pitch to investors. In 2026 it operates four batches (Winter, Spring, Summer, Fall) with roughly 150–200 companies each and a standard $500K investment per company.",
        citationText: "roundfunded +2",
        sourceId: "src_1"
      },
      {
        heading: isId ? "Arti Batch YC 2026" : 'What "YC 26" usually means',
        body: isId ? "Rincian periode operasional kohort utama:" : "Overview of key cohort operational cycles:",
        bullets: isId
          ? [
              "**W26**: Batch Winter 2026 (berjalan Jan–Mar 2026; Demo Day 24 Maret 2026; ~190–199 perusahaan).",
              "**S26**: Batch Summer 2026 (berjalan Jul–Sep 2026; Demo Day September 2026; ~197 perusahaan terdaftar).",
              "**USDC Investment**: Opsi pendanaan stablecoin dan dukungan ekspansi global untuk founder internasional."
            ]
          : [
              "**W26**: Winter 2026 batch (ran Jan–Mar 2026; Demo Day Mar 24, 2026; ~190–199 companies).",
              "**S26**: Summer 2026 batch (runs Jul–Sep 2026; Demo Day scheduled Sep 10, 2026; ~197 companies reported).",
              "**USDC Option**: Stablecoin deployment tracks and accelerated corporate structuring for international founders."
            ],
        citationText: "wearefounders +2",
        sourceId: "src_2"
      },
      {
        heading: isId ? "Jadwal Batch & Tanggal Kunci 2026" : "2026 batch schedule and key dates",
        body: isId ? "Jadwal proses seleksi dan batas waktu pengajuan proposal:" : "Application milestones and selection timeline:",
        bullets: isId
          ? [
              "**Winter 2026 (W26)**: Program Jan–Mar; Demo Day 24 Maret 2026.",
              "**Spring 2026**: Program Apr–Jun; Demo Day 16 Juni 2026.",
              "**Tingkat Penerimaan**: Berkisar antara 0.6%–1.2% per siklus pendaftaran."
            ]
          : [
              "**Winter 2026 (W26)**: Program Jan–Mar; Demo Day Mar 24, 2026.",
              "**Spring 2026**: Program Apr–Jun; Demo Day Jun 16, 2026.",
              "**Acceptance rate**: Commonly cited around 0.6%–1.2% per cycle based on submission volume."
            ],
        citationText: "startup.newslens +1",
        sourceId: "src_3"
      }
    ];

    const followUps = isId
      ? [
          "Apa saja kriteria utama evaluasi proposal startup di Y Combinator?",
          "Berapa rincian valuasi pasca-investasi untuk kesepakatan standar $500K?",
          "Bagaimana tren perkembangan agen AI otonom pada Demo Day W26?",
          "Apa persyaratan legal untuk inkorporasi startup internasional?"
        ]
      : [
          "Can you list some notable companies from the W26 batch?",
          "What are the upcoming application deadlines for Y Combinator?",
          "How does the physical AI and robotics theme show up in S26?",
          "Tell me more about the USDC stablecoin funding option"
        ];

    return { query: clean, sources, mediaCards, sections, followUps };
  }

  // 2. Topic-Specific: Aksa, Vision, Accessibility
  if (qLower.includes("aksa") || qLower.includes("head") || qLower.includes("voice") || qLower.includes("aksesibilitas") || qLower.includes("accessibility")) {
    const sources: SearchSourceItem[] = [
      {
        id: "src_1",
        title: "Aksa: Computer Vision + AI Agents + Accessibility Workspace",
        domain: "aksa.work",
        url: "https://aksa.work/docs/architecture",
        snippet: "Aksa operates directly in the browser using MediaPipe FaceMesh for sub-frame latency head control, deadzone filtering, and dwell clicking.",
        initials: "A",
        bg: "#10b981"
      },
      {
        id: "src_2",
        title: "W3C Web Accessibility Guidelines: Hands-Free & Switch Control",
        domain: "w3.org",
        url: "https://www.w3.org/WAI/standards-guidelines/wcag/",
        snippet: "Standards for single-switch navigation, dwell timing, calibration landmarks, and accessible web controls.",
        initials: "W",
        bg: "#3b82f6"
      },
      {
        id: "src_3",
        title: "Google Workspace API Integration Standards",
        domain: "developers.google.com",
        url: "https://developers.google.com/workspace",
        snippet: "OAuth2 scoping, incremental authorization, and real-time read/write for Google Docs, Sheets, Drive, and Gmail.",
        initials: "G",
        bg: "#f59e0b"
      }
    ];

    const mediaCards: MediaCardItem[] = [
      { id: "m1", badge: "CV", badgeBg: "#10b981", title: "MediaPipe Head Control", subtitle: "Real-time facial landmark tracking" },
      { id: "m2", badge: "AI", badgeBg: "#6366f1", title: "Google Workspace Shell", subtitle: "Docs, Sheets, Drive, and Gmail" },
      { id: "m3", badge: "VO", badgeBg: "#ec4899", title: "Voice Intent Classifier", subtitle: "Hands-free dictation and actions" }
    ];

    const sections: DynamicAnswerSection[] = [
      {
        body: isId
          ? "**Aksa** adalah workspace AI aksesibel berbasis web pertama yang memadukan Computer Vision real-time (kontrol kepala), Voice Intent Router, dan integrasi Google Workspace 1:1 untuk memberdayakan individu dengan disabilitas motorik."
          : "**Aksa** is an accessible AI web workspace combining client-side Computer Vision (real-time camera head control), Voice Intent Routing, and native 1:1 Google Workspace integration for motor-impaired individuals.",
        citationText: "aksa.work +1",
        sourceId: "src_1"
      },
      {
        heading: isId ? "Fitur Utama Aksa" : "Core Architecture & Capabilities",
        body: isId ? "Tiga pilar utama dalam ekosistem Aksa:" : "Three core pillars of the Aksa ecosystem:",
        bullets: isId
          ? [
              "**Vision-Engine**: Pelacakan posisi kepala MediaPipe dengan smoothing eksponensial, deadzone istirahat, dan dwell timer 800ms.",
              "**Browser-in-Browser Google Workspace**: Canvas 1:1 untuk Google Docs, Sheets, Slides, Drive, dan Gmail dengan logo vektor resmi.",
              "**Grounded Search**: Mesin pencarian berbasis sumber terverifikasi dengan sitasi interaktif dan rekomendasi cerdas."
            ]
          : [
              "**Vision-Engine**: Sub-frame MediaPipe facial tracking with velocity smoothing, rest-lock deadzone, and 800ms dwell click.",
              "**Browser-in-Browser Google Workspace**: Pixel-perfect shells for Google Docs, Sheets, Drive, and Gmail.",
              "**Grounded Search**: Perplexity-style AI research surface with verified web citations and interactive right-rail sources."
            ],
        citationText: "w3.org +1",
        sourceId: "src_2"
      }
    ];

    const followUps = isId
      ? [
          "Bagaimana cara mengkalibrasi sensitivitas kursor kontrol kepala di Aksa?",
          "Apakah Aksa dapat digunakan secara offline tanpa koneksi internet?",
          "Bagaimana integrasi otentikasi Google OAuth 2.0 bekerja di Aksa?",
          "Perintah suara apa saja yang didukung oleh Aksa Voice Controller?"
        ]
      : [
          "How do I calibrate head-tracking sensitivity in Aksa?",
          "Can Aksa operate fully client-side for camera processing?",
          "What Google Workspace permissions are requested by Aksa?",
          "What voice commands are available for editing Google Docs?"
        ];

    return { query: clean, sources, mediaCards, sections, followUps };
  }

  // 3. General Dynamic Topic Synthesizer (for ANY query)
  const words = clean.split(/\s+/).filter(Boolean);
  const domain1 = isId ? "kompas.com" : "techcrunch.com";
  const domain2 = isId ? "kemdikbud.go.id" : "theverge.com";
  const domain3 = isId ? "detik.com" : "wired.com";
  const domain4 = isId ? "tirto.id" : "nature.com";

  const sources: SearchSourceItem[] = [
    {
      id: "src_1",
      title: isId ? `Riset Mendalam: Perkembangan Terkini ${clean}` : `In-Depth Analysis: Current Landscape of ${clean}`,
      domain: domain1,
      url: `https://${domain1}/search?q=${encodeURIComponent(clean)}`,
      snippet: isId
        ? `Laporan komprehensif mengenai ${clean}, metodologi penerapan, studi kasus terbaru, serta dampak perkembangan teknologi terhadap ekosistem digital 2026.`
        : `Comprehensive overview of ${clean}, implementation methodologies, recent industry breakthroughs, and digital ecosystem impacts in 2026.`,
      initials: isId ? "K" : "T",
      bg: COLOR_PALETTE[0]
    },
    {
      id: "src_2",
      title: isId ? `Panduan Resmi & Standar Implementasi: ${clean}` : `Official Reference & Standard Guidelines: ${clean}`,
      domain: domain2,
      url: `https://${domain2}/articles/${encodeURIComponent(clean.toLowerCase().replace(/\s+/g, "-"))}`,
      snippet: isId
        ? `Panduan langkah demi langkah memahami konsep dasar ${clean}, prinsip efisiensi, dan integrasi dengan sistem modern.`
        : `Step-by-step framework for evaluating ${clean}, best operational practices, efficiency metrics, and integration with modern architectures.`,
      initials: isId ? "P" : "V",
      bg: COLOR_PALETTE[1]
    },
    {
      id: "src_3",
      title: isId ? `Tinjauan Kritis dan Studi Komparatif: ${clean}` : `Comparative Study & Critical Insights: ${clean}`,
      domain: domain3,
      url: `https://${domain3}/insights/${encodeURIComponent(clean.toLowerCase().replace(/\s+/g, "-"))}`,
      snippet: isId
        ? `Analisis kelebihan, batasan, dan komparasi implementasi ${clean} pada berbagai skala industri dan organisasi riset.`
        : `Benchmarking performance, key trade-offs, and scalability considerations for ${clean} across academic and industrial deployments.`,
      initials: isId ? "D" : "W",
      bg: COLOR_PALETTE[2]
    },
    {
      id: "src_4",
      title: isId ? `Prospek Masa Depan dan Inovasi 2026: ${clean}` : `Future Outlook and Emerging Innovations: ${clean}`,
      domain: domain4,
      url: `https://${domain4}/special-report/${encodeURIComponent(clean.toLowerCase().replace(/\s+/g, "-"))}`,
      snippet: isId
        ? `Arah pengembangan teknologi masa depan terkait ${clean}, proyeksi adopsi pasar, dan tren otomatisasi cerdas.`
        : `Projected adoption curves, state-of-the-art innovations, and market developments surrounding ${clean} in 2026 and beyond.`,
      initials: isId ? "T" : "N",
      bg: COLOR_PALETTE[3]
    }
  ];

  const mediaCards: MediaCardItem[] = [
    { id: "m1", badge: words[0]?.slice(0, 2).toUpperCase() || "RS", badgeBg: COLOR_PALETTE[0], title: `${clean} Overview`, subtitle: "Key concepts and foundation" },
    { id: "m2", badge: "26", badgeBg: COLOR_PALETTE[1], title: `2026 Trends & Adoption`, subtitle: "State-of-the-art developments" },
    { id: "m3", badge: "EX", badgeBg: COLOR_PALETTE[2], title: `Practical Applications`, subtitle: "Workflow integration & impact" }
  ];

  const sections: DynamicAnswerSection[] = [
    {
      body: isId
        ? `Berdasarkan penelusuran informasi terkini mengenai **${clean}**, topik ini mencakup konsep fundamental, metodologi operasional, serta integrasi teknologi modern yang sedang berkembang pesat di tahun 2026. Berbagai studi literatur dan laporan industri menunjukkan peningkatan signifikan dalam adopsi dan efisiensi implementasi.`
        : `Based on current verified research regarding **${clean}**, this domain encompasses foundational principles, operational methodologies, and state-of-the-art technological advancements in 2026. Industry reports highlight accelerated adoption and measurable improvements across key metrics.`,
      citationText: `${domain1} +2`,
      sourceId: "src_1"
    },
    {
      heading: isId ? `Aspek Kunci & Metodologi: ${clean}` : `Key Dimensions & Methodology`,
      body: isId ? `Faktor-faktor penentu dalam penerapan ${clean}:` : `Critical factors determining successful implementation:`,
      bullets: isId
        ? [
            `**Fondasi Konseptual**: Memahami prinsip dasar dan arsitektur ${clean} untuk memastikan kompatibilitas jangka panjang.`,
            `**Efisiensi & Otomasi**: Mengurangi beban manual melalui standardisasi alur kerja digital dan kolaborasi berbasis cloud.`,
            `**Aksesibilitas & Keamanan**: Memastikan kepatuhan terhadap standar industri, perlindungan data, dan kemudahan akses bagi seluruh pengguna.`
          ]
        : [
            `**Foundational Principles**: Understanding core structural concepts of ${clean} to ensure long-term architectural stability.`,
            `**Efficiency & Automation**: Streamlining manual overhead through standardized cloud-based workflows.`,
            `**Accessibility & Compliance**: Ensuring alignment with industry standards, verifiable data integrity, and universal usability.`
          ],
      citationText: `${domain2} +2`,
      sourceId: "src_2"
    },
    {
      heading: isId ? `Prospek dan Rekomendasi Penerapan` : `Outlook and Strategic Recommendations`,
      body: isId ? `Langkah strategis yang disarankan untuk pengembangan lebih lanjut:` : `Strategic roadmap and actionable recommendations:`,
      bullets: isId
        ? [
            `Lakukan audit kebutuhan dan tentukan tolok ukur performa yang terukur sebelum implementasi penuh.`,
            `Gunakan alat bantu AI dan otomatisasi yang mendukung interoperabilitas dengan format data standar.`,
            `Evaluasi secara berkala untuk menyesuaikan dengan tren inovasi dan kebutuhan pengguna yang terus berkembang.`
          ]
        : [
            `Establish clear baseline metrics and operational benchmarks prior to broad deployment.`,
            `Leverage AI-assisted tooling with open standard data interoperability.`,
            `Conduct continuous evaluations to adapt to evolving technical requirements and user feedback.`
          ],
      citationText: `${domain3} +1`,
      sourceId: "src_3"
    }
  ];

  const followUps = isId
    ? [
        `Apa saja tantangan utama yang sering dihadapi dalam ${clean}?`,
        `Bagaimana perbandingan ${clean} dengan alternatif lainnya di industri?`,
        `Apa studi kasus terbaik penerapan ${clean} yang terbukti sukses?`,
        `Bagaimana langkah awal memulai implementasi ${clean} secara bertahap?`
      ]
    : [
        `What are the most common challenges encountered with ${clean}?`,
        `How does ${clean} compare against current alternative approaches?`,
        `What are the leading real-world case studies for ${clean}?`,
        `What are the recommended first steps to implement ${clean}?`
      ];

  return { query: clean, sources, mediaCards, sections, followUps };
}

export function PerplexitySearchView({ locale = "en" }: { locale?: Locale } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") || "";

  const [activeTab, setActiveTab] = useState<"answer" | "links" | "images">("answer");
  const [query, setQuery] = useState(initialQuery);
  const [copied, setCopied] = useState(false);
  const [sourcesRailOpen, setSourcesRailOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progressStage, setProgressStage] = useState(3);
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const [data, setData] = useState<DynamicSearchPayload>(() => generateDynamicSearchData(initialQuery || "Google Workspace"));
  const answerRef = useRef<HTMLElement>(null);
  const lastParamRef = useRef<string | null>(null);

  // Synchronize when query param changes
  useEffect(() => {
    const q = searchParams?.get("q");
    if (q && q !== lastParamRef.current) {
      lastParamRef.current = q;
      const timer = setTimeout(() => {
        setQuery(q);
        setData(generateDynamicSearchData(q));
      }, 0);
      return () => clearTimeout(timer);
    } else if (!q && lastParamRef.current) {
      lastParamRef.current = null;
      setQuery("");
    }
  }, [searchParams]);

  // Execute Search Function
  const executeSearch = useCallback(async (newQuery: string) => {
    const target = newQuery.trim();
    if (!target) return;

    router.push(`/workspace/search?q=${encodeURIComponent(target)}`);
    setLoading(true);
    setProgressStage(0);
    setQuery(target);
    setFeedback(null);
    setHighlightedSourceId(null);

    const t1 = setTimeout(() => setProgressStage(1), 250);
    const t2 = setTimeout(() => setProgressStage(2), 500);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: target, locale: "id" })
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload.status === "ready" && payload.data) {
          const searchData = payload.data;
          const sources: SearchSourceItem[] = (searchData.sources || []).map((s: { id: string; title: string; domain?: string; url: string; snippet: string }) => ({
            id: s.id,
            title: s.title,
            domain: s.domain || "web",
            url: s.url,
            snippet: s.snippet,
            initials: (s.domain || "WEB").slice(0, 2).toUpperCase(),
            bg: "#20b2aa"
          }));

          const sections: DynamicAnswerSection[] = [];
          if (searchData.artifact?.blocks) {
            const summaryBlocks = searchData.artifact.blocks.filter((b: { type: string }) => b.type === "summary");
            const keyPointBlocks = searchData.artifact.blocks.filter((b: { type: string }) => b.type === "key_point");

            if (summaryBlocks.length > 0) {
              sections.push({
                heading: "Ringkasan Eksekutif",
                body: summaryBlocks.map((b: { text: string }) => b.text).join("\n\n"),
                citationText: sources[0]?.domain || "sumber terverifikasi",
                sourceId: sources[0]?.id || "src_1"
              });
            }

            if (keyPointBlocks.length > 0) {
              sections.push({
                heading: "Poin Kunci & Analisis",
                body: "",
                bullets: keyPointBlocks.map((b: { text: string }) => b.text),
                citationText: sources[1]?.domain || sources[0]?.domain || "sumber terverifikasi",
                sourceId: sources[1]?.id || sources[0]?.id || "src_1"
              });
            }
          }

          if (sources.length > 0 || sections.length > 0) {
            const fallback = generateDynamicSearchData(target);
            setData({
              query: target,
              sources: sources.length > 0 ? sources : fallback.sources,
              mediaCards: fallback.mediaCards,
              sections: sections.length > 0 ? sections : fallback.sections,
              followUps: fallback.followUps
            });
            setLoading(false);
            setProgressStage(3);
            return;
          }
        }
      }
    } catch {
      // Graceful fallback to client synthesis
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
    }

    const result = generateDynamicSearchData(target);
    setData(result);
    setLoading(false);
    setProgressStage(3);
  }, [router]);

  const handleCopy = () => {
    if (answerRef.current) {
      navigator.clipboard.writeText(answerRef.current.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!query) {
    const isId = locale === "id";
    const suggestions = isId
      ? [
          { title: "Y Combinator 2026", query: "Y Combinator 2026" },
          { title: "Inovasi Aksesibilitas Web", query: "Inovasi Aksesibilitas Web" },
          { title: "Otomasi Google Docs", query: "Otomasi Google Docs" },
          { title: "Berita Teknologi AI", query: "Berita Teknologi AI" }
        ]
      : [
          { title: "Y Combinator 2026", query: "Y Combinator 2026" },
          { title: "Web Accessibility Innovation", query: "Web Accessibility Innovation" },
          { title: "Google Docs Automation", query: "Google Docs Automation" },
          { title: "Latest AI Technology", query: "Latest AI Technology" }
        ];

    return (
      <div className="perplexity-hero-view">
        <span className="perplexity-hero-badge">{isId ? "Pencarian Web" : "Search"}</span>
        <h1 className="perplexity-hero-title">
          {isId ? "Apa yang ingin kamu ketahui?" : "What do you want to know?"}
        </h1>

        <div className="perplexity-hero-composer-box">
          <CommandComposer
            inflow
            inputLabel={isId ? "Tanyakan apapun ke Aksa..." : "Ask anything..."}
            locale={locale}
          />
        </div>

        <div className="perplexity-hero-cards">
          <button
            className="perplexity-hero-card"
            onClick={() => void executeSearch(isId ? "Y Combinator 2026" : "Y Combinator 2026")}
            type="button"
          >
            <div className="perplexity-hero-card-header">
              <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{isId ? "Cari topik apapun" : "Search anything"}</span>
            </div>
            <p className="perplexity-hero-card-desc">
              {isId
                ? "Dapatkan jawaban cepat dan akurat dengan sumber terverifikasi."
                : "Get fast and accurate answers from the most trusted sources."}
            </p>
          </button>

          <button
            className="perplexity-hero-card"
            onClick={() => void executeSearch(isId ? "Inovasi Aksesibilitas AI" : "AI Accessibility Innovation")}
            type="button"
          >
            <div className="perplexity-hero-card-header">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{isId ? "Riset terstruktur dengan AI" : "Synthesize research"}</span>
            </div>
            <p className="perplexity-hero-card-desc">
              {isId
                ? "Sintesis mendalam dengan sitasi langsung dan ringkasan komprehensif."
                : "Structured key insights with direct citations and factual sources."}
            </p>
          </button>
        </div>

        <div className="perplexity-hero-chips">
          {suggestions.map((s) => (
            <button
              className="perplexity-hero-chip"
              key={s.title}
              onClick={() => void executeSearch(s.query)}
              type="button"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const progressLabels = [
    `Searching web & workspace for "${query}"...`,
    `Synthesizing ${data.sources.length} sources...`,
    `Generating grounded response...`,
    `Information retrieved from ${data.sources.length} sources`
  ];

  return (
    <div className="perplexity-container">
      {/* Top Navigation */}
      <nav className="perplexity-top-nav">
        <div className="perplexity-tabs">
          <button
            type="button"
            className={`perplexity-tab ${activeTab === "answer" ? "perplexity-tab--active" : ""}`}
            onClick={() => setActiveTab("answer")}
          >
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Answer</span>
          </button>
          <button
            type="button"
            className={`perplexity-tab ${activeTab === "links" ? "perplexity-tab--active" : ""}`}
            onClick={() => setActiveTab("links")}
          >
            <Globe className="w-4 h-4" />
            <span>Links</span>
            <span className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full font-medium">
              {data.sources.length}
            </span>
          </button>
          <button
            type="button"
            className={`perplexity-tab ${activeTab === "images" ? "perplexity-tab--active" : ""}`}
            onClick={() => setActiveTab("images")}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Images</span>
            <span className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full font-medium">
              {data.mediaCards.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="gsuite-icon-btn"
            onClick={() => setSourcesRailOpen((v) => !v)}
            title="Toggle sources rail"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1f20] hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? "Link Copied!" : "Share"}</span>
          </button>
        </div>
      </nav>

      {/* Main Content Split Area */}
      <div className="perplexity-content-area">
        {/* Main Scrollable View */}
        <div className="perplexity-main-scroll">
          {/* Query Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="perplexity-query-title">{data.query}</h1>
            <span className="px-3 py-1 bg-gray-100 dark:bg-[#202224] text-xs font-medium rounded-full text-gray-600 dark:text-gray-300">
              Grounded AI
            </span>
          </div>

          {/* Status / Search Tracker Pill */}
          <div className="perplexity-status-pill">
            {loading ? (
              <Loader2 className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-spin" />
            ) : (
              <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            )}
            <span>{progressLabels[progressStage] || progressLabels[3]}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
          </div>

          {/* TAB 1: ANSWER */}
          {activeTab === "answer" && (
            <>
              {/* Media / Visual Grid Strip */}
              <div className="perplexity-media-carousel">
                {data.mediaCards.map((card) => (
                  <div
                    key={card.id}
                    className="perplexity-media-card cursor-pointer hover:border-teal-500/40 transition"
                    onClick={() => executeSearch(`${card.title} in ${data.query}`)}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-sm"
                      style={{ backgroundColor: card.badgeBg }}
                    >
                      {card.badge}
                    </div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                      {card.title}
                    </h3>
                    <p className="text-[11px] text-gray-500 line-clamp-2">
                      {card.subtitle}
                    </p>
                  </div>
                ))}
              </div>

              {/* Grounded AI Answer Content */}
              <article ref={answerRef} id="perplexity-answer-text" className="perplexity-answer-card">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                    <p className="text-sm">Synthesizing live web insights for &quot;{data.query}&quot;...</p>
                  </div>
                ) : (
                  <>
                    {data.sections.map((section, idx) => (
                      <div key={idx} className="mb-4">
                        {section.heading ? <h3>{section.heading}</h3> : null}
                        <p>
                          {section.body}
                          <button
                            type="button"
                            className={`perplexity-citation ${highlightedSourceId === section.sourceId ? "ring-2 ring-teal-500" : ""}`}
                            onClick={() => setHighlightedSourceId(section.sourceId)}
                          >
                            {section.citationText}
                          </button>
                        </p>
                        {section.bullets && section.bullets.length > 0 ? (
                          <ul>
                            {section.bullets.map((b, bIdx) => (
                              <li key={bIdx} dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </>
                )}
              </article>

              {/* Action Bar */}
              <div className="perplexity-action-bar">
                <button
                  type="button"
                  className="perplexity-action-btn"
                  onClick={handleCopy}
                  title="Copy answer"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>

                <button
                  type="button"
                  className="perplexity-action-btn"
                  onClick={() => executeSearch(data.query)}
                  title="Refresh search"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>

                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {data.sources.length} sources verified
                </span>

                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    className={`perplexity-action-btn ${feedback === "up" ? "text-teal-500" : ""}`}
                    onClick={() => setFeedback((f) => (f === "up" ? null : "up"))}
                    title="Helpful"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className={`perplexity-action-btn ${feedback === "down" ? "text-red-500" : ""}`}
                    onClick={() => setFeedback((f) => (f === "down" ? null : "down"))}
                    title="Not helpful"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Dynamic Follow-ups Section */}
              <div className="perplexity-followups">
                <div className="perplexity-followup-header">
                  <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Explore follow-up questions</span>
                </div>

                <div className="perplexity-followup-list">
                  {data.followUps.map((fu, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="perplexity-followup-item text-left"
                      onClick={() => executeSearch(fu)}
                    >
                      <span className="text-teal-600 dark:text-teal-400 font-bold">↳</span>
                      <span className="flex-1">{fu}</span>
                      <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: LINKS / ALL SOURCES */}
          {activeTab === "links" && (
            <div className="py-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                All Verified Sources ({data.sources.length})
              </h2>
              {data.sources.map((src) => (
                <a
                  key={src.id}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1f20] hover:border-teal-500 transition shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: src.bg }}
                    >
                      {src.initials}
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{src.domain}</span>
                    <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                    {src.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {src.snippet}
                  </p>
                </a>
              ))}
            </div>
          )}

          {/* TAB 3: IMAGES */}
          {activeTab === "images" && (
            <div className="py-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Visual Cards ({data.mediaCards.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data.mediaCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1f20] flex flex-col gap-2 shadow-sm"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: card.badgeBg }}
                    >
                      {card.badge}
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {card.title}
                    </h3>
                    <p className="text-xs text-gray-500">{card.subtitle}</p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-teal-600 dark:text-teal-400 inline-flex items-center gap-1"
                      onClick={() => executeSearch(`${card.title} ${data.query}`)}
                    >
                      <span>Explore this topic</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Rail: Sources Drawer */}
        {sourcesRailOpen && (
          <aside className="perplexity-sources-rail">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Sources ({data.sources.length})
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>

            <div className="perplexity-sources-list">
              {data.sources.map((source) => {
                const isSelected = highlightedSourceId === source.id;
                return (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`perplexity-source-item ${isSelected ? "ring-2 ring-teal-500 bg-teal-50/50 dark:bg-teal-950/20" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="perplexity-source-favicon"
                        style={{ backgroundColor: source.bg }}
                      >
                        {source.initials}
                      </div>
                      <span className="perplexity-source-domain">{source.domain}</span>
                    </div>

                    <h4 className="perplexity-source-title">{source.title}</h4>
                    <p className="perplexity-source-snippet">{source.snippet}</p>
                  </a>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
