"use client";

import { useState, useMemo } from "react";
import {
  Search,
  PenSquare,
  Inbox,
  Star,
  Clock,
  Send,
  File,
  Trash2,
  Tag,
  Mail,
  ChevronLeft,
  X,
  SlidersHorizontal,
  Users
} from "lucide-react";
import { GoogleCompanionBar } from "@/components/workspace/google-suite-shell";
import { GoogleGmailIcon } from "@/components/workspace/google-app-icons";

type EmailItemType = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
  category: "primary" | "promotions" | "social" | "updates";
};

const INITIAL_EMAILS: EmailItemType[] = [
  {
    id: "1",
    sender: "Team Sync",
    subject: "Weekly team update for next week",
    snippet: "Summary of tasks, priorities, and deadlines for the upcoming week.",
    body: "Hi team,\n\nHere is the summary of our key milestones and deliverables for the upcoming week. Please review the launch plan and submit your updates before Friday.\n\nBest,\nTeam Lead",
    date: "09:15",
    unread: true,
    starred: false,
    category: "primary"
  },
  {
    id: "2",
    sender: "Acme Corp",
    subject: "Your invoice is ready",
    snippet: "Invoice #INV-78324 for your recent purchase is attached.",
    body: "Dear Customer,\n\nYour invoice #INV-78324 has been generated. Please find the details attached or access your account dashboard.\n\nThank you.",
    date: "08:12",
    unread: true,
    starred: true,
    category: "primary"
  },
  {
    id: "3",
    sender: "Productivity Hub",
    subject: "5 tips to improve your workflow",
    snippet: "Simple strategies to help you stay focused and productive.",
    body: "Check out these 5 essential tips for optimizing your daily workflow and assistive keyboard shortcuts.",
    date: "07:45",
    unread: false,
    starred: false,
    category: "primary"
  },
  {
    id: "4",
    sender: "Calendar Alerts",
    subject: "Reminder: Project planning meeting",
    snippet: "Friday, Aug 15, 2026 at 10:00 AM on Google Meet.",
    body: "This is a reminder for your upcoming project planning session on Google Meet at 10:00 AM.",
    date: "06:30",
    unread: false,
    starred: false,
    category: "updates"
  },
  {
    id: "5",
    sender: "TravelPlus",
    subject: "Your flight confirmation",
    snippet: "Booking reference #TP-9821 for your trip on Aug 20, 2026.",
    body: "Your booking is confirmed! Details: Flight TP-204 departing Aug 20, 2026.",
    date: "Yesterday",
    unread: false,
    starred: false,
    category: "updates"
  },
  {
    id: "6",
    sender: "Social Network",
    subject: "10 new connection requests",
    snippet: "See who wants to connect with you this week.",
    body: "You have 10 pending connection requests from colleagues and peers.",
    date: "Aug 12",
    unread: false,
    starred: false,
    category: "social"
  }
];

export function GoogleGmailView() {
  const [activeCategory, setActiveCategory] = useState<"primary" | "promotions" | "social" | "updates">("primary");
  const [activeSection, setActiveSection] = useState<"inbox" | "starred" | "snoozed" | "sent" | "drafts">("inbox");
  const [emails, setEmails] = useState<EmailItemType[]>(INITIAL_EMAILS);
  const [selectedEmail, setSelectedEmail] = useState<EmailItemType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const filteredEmails = useMemo(() => {
    return emails.filter((e) => {
      const matchesSearch =
        !searchQuery.trim() ||
        e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.sender.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeSection === "starred") return e.starred;
      return e.category === activeCategory;
    });
  }, [emails, searchQuery, activeSection, activeCategory]);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails((prev) =>
      prev.map((item) => (item.id === id ? { ...item, starred: !item.starred } : item))
    );
  };

  const handleSendDraft = () => {
    if (!composeTo || !composeSubject) return;
    const newEmail: EmailItemType = {
      id: String(Date.now()),
      sender: "Me",
      subject: composeSubject,
      snippet: composeBody.substring(0, 60),
      body: composeBody,
      date: "Just now",
      unread: false,
      starred: false,
      category: "primary"
    };
    setEmails((prev) => [newEmail, ...prev]);
    setComposeOpen(false);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
  };

  return (
    <div className="gsuite-container">
      {/* Gmail Top Bar */}
      <header className="gsuite-header">
        <div className="flex items-center gap-3">
          <GoogleGmailIcon className="w-9 h-9 flex-shrink-0" />
          <span className="gdrive-title">Gmail</span>
        </div>

        <div className="flex-1 max-w-2xl mx-8">
          <div className="gsuite-search-pill">
            <Search className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              className="gsuite-search-input"
              placeholder="Search mail"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <SlidersHorizontal className="w-4 h-4 text-gray-500 cursor-pointer hover:text-gray-700" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="gsuite-avatar bg-red-600" title="Account">A</div>
        </div>
      </header>

      {/* Main Gmail Layout */}
      <div className="gmail-main-layout">
        {/* Left Navigation Sidebar */}
        <aside className="gmail-sidebar">
          <button
            type="button"
            className="gmail-compose-btn"
            onClick={() => setComposeOpen(true)}
          >
            <PenSquare className="w-5 h-5 text-[#001d35] dark:text-[#041e49]" />
            <span>Compose</span>
          </button>

          <nav className="flex flex-col gap-1">
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "inbox" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => { setActiveSection("inbox"); setSelectedEmail(null); }}
            >
              <Inbox className="w-4 h-4" />
              <span className="flex-1 text-left">Inbox</span>
              <span className="text-xs font-semibold">2,135</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "starred" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => { setActiveSection("starred"); setSelectedEmail(null); }}
            >
              <Star className="w-4 h-4" />
              <span className="flex-1 text-left">Starred</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "snoozed" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => { setActiveSection("snoozed"); setSelectedEmail(null); }}
            >
              <Clock className="w-4 h-4" />
              <span className="flex-1 text-left">Snoozed</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "sent" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => { setActiveSection("sent"); setSelectedEmail(null); }}
            >
              <Send className="w-4 h-4" />
              <span className="flex-1 text-left">Sent</span>
            </button>
            <button
              type="button"
              className={`gdrive-nav-item ${activeSection === "drafts" ? "gdrive-nav-item--active" : ""}`}
              onClick={() => { setActiveSection("drafts"); setSelectedEmail(null); }}
            >
              <File className="w-4 h-4" />
              <span className="flex-1 text-left">Drafts</span>
            </button>
          </nav>
        </aside>

        {/* Email Reading View or List View */}
        <div className="gmail-list-scroll">
          {selectedEmail ? (
            /* Reading Pane */
            <div className="p-6 bg-white dark:bg-[#1e1f20] min-h-full">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to inbox
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => toggleStar(selectedEmail.id, e)}
                    className="gsuite-icon-btn"
                  >
                    <Star
                      className="w-4 h-4"
                      fill={selectedEmail.starred ? "#f4b400" : "none"}
                      stroke={selectedEmail.starred ? "#f4b400" : "currentColor"}
                    />
                  </button>
                  <button type="button" className="gsuite-icon-btn"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="py-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedEmail.subject}
                </h1>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base">
                      {selectedEmail.sender[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedEmail.sender}</p>
                      <p className="text-xs text-gray-500">to me &lt;user@aksa.ai&gt;</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{selectedEmail.date}</span>
                </div>

                <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedEmail.body}
                </div>
              </div>
            </div>
          ) : (
            /* Email List View */
            <div>
              {/* Category Tabs */}
              <div className="gmail-categories-bar">
                {[
                  { key: "primary", label: "Primary", icon: Mail },
                  { key: "promotions", label: "Promotions", icon: Tag },
                  { key: "social", label: "Social", icon: Users, count: "10 new" },
                  { key: "updates", label: "Updates", icon: Inbox, count: "8 new" }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeCategory === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className={`gmail-category-tab ${isActive ? "gmail-category-tab--active" : ""}`}
                      onClick={() => setActiveCategory(tab.key as "primary" | "promotions" | "social" | "updates")}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {tab.count && (
                        <span className="text-[11px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Rows */}
              <div>
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    className={`gmail-row ${email.unread ? "gmail-row--unread" : ""}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <input type="checkbox" className="rounded" onClick={(e) => e.stopPropagation()} />
                    <button
                      type="button"
                      onClick={(e) => toggleStar(email.id, e)}
                      className="text-gray-400 hover:text-amber-400 p-1"
                    >
                      <Star
                        className="w-4 h-4"
                        fill={email.starred ? "#f4b400" : "none"}
                        stroke={email.starred ? "#f4b400" : "currentColor"}
                      />
                    </button>
                    <span className="gmail-row__sender font-medium">{email.sender}</span>
                    <span className="gmail-row__snippet">
                      <span className="font-semibold text-gray-900 dark:text-white mr-1.5">{email.subject}</span>
                      — {email.snippet}
                    </span>
                    <span className="gmail-row__date font-medium">{email.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Companion Bar */}
        <GoogleCompanionBar />
      </div>

      {/* Gmail In-App Compose Floating Box */}
      {composeOpen && (
        <div className="fixed bottom-24 right-16 w-full max-w-lg bg-white dark:bg-[#1e1f20] rounded-t-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">New Message</span>
            <button type="button" onClick={() => setComposeOpen(false)}>
              <X className="w-4 h-4 text-gray-500 hover:text-gray-800 dark:hover:text-white" />
            </button>
          </div>

          <div className="p-4 space-y-2 flex-1 flex flex-col">
            <input
              type="email"
              placeholder="Recipients"
              className="w-full text-sm border-b border-gray-200 dark:border-gray-700 pb-2 outline-none bg-transparent"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
            />
            <input
              type="text"
              placeholder="Subject"
              className="w-full text-sm border-b border-gray-200 dark:border-gray-700 pb-2 outline-none bg-transparent"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
            />
            <textarea
              placeholder="Write your email here or dictate with Aksa..."
              className="w-full flex-1 min-h-[160px] text-sm outline-none bg-transparent resize-none pt-2"
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
            />

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleSendDraft}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition"
              >
                Send
              </button>
              <span className="text-xs text-gray-400">Aksa AI Assistant ready</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
