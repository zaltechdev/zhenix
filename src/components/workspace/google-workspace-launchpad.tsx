import Link from "next/link";
import { ChevronRight, FileText, FolderOpen, Mail, Table2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

export function GoogleWorkspaceLaunchpad({ locale }: { locale: Locale }) {
  const options = { locale };

  const launchItems = [
    {
      href: "/workspace/documents",
      name: m.nav_documents({}, options),
      desc: m.home_docs_desc({}, options),
      icon: FileText,
      disabled: false,
      preview: false
    },
    {
      href: "/workspace/files",
      name: m.nav_files({}, options),
      desc: m.home_drive_desc({}, options),
      icon: FolderOpen,
      disabled: false,
      preview: false
    },
    {
      href: "/workspace/sheets",
      name: m.nav_sheets({}, options),
      desc: m.home_sheets_desc({}, options),
      icon: Table2,
      disabled: false,
      preview: true
    },
    {
      href: "/workspace/mail",
      name: m.nav_mail({}, options),
      desc: m.home_gmail_desc({}, options),
      icon: Mail,
      disabled: false,
      preview: true
    }
  ];

  return (
    <section aria-labelledby="workspace-launchpad-heading" className="aksa-dashboard-card">
      <div className="aksa-dashboard-card__header">
        <h2 className="aksa-dashboard-card__title" id="workspace-launchpad-heading">
          {m.home_workspace_heading({}, options)}
        </h2>
      </div>

      <ul aria-label={m.home_workspace_heading({}, options)} className="aksa-launchpad__flat-list">
        {launchItems.map((item) => {
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <li className="aksa-launchpad__flat-item" key={item.name}>
                <span
                  aria-disabled="true"
                  className="aksa-launchpad__flat-link aksa-launchpad__flat-link--disabled"
                  aria-label={`${item.name}: ${m.nav_slides_disabled({}, options)}`}
                  title={m.nav_slides_disabled({}, options)}
                >
                  <div className="aksa-launchpad__flat-icon">
                    <Icon aria-hidden="true" className="aksa-icon" />
                  </div>
                  <div className="aksa-launchpad__flat-info">
                    <span className="aksa-launchpad__flat-name">
                      {item.name}
                      {item.preview ? (
                        <span className="aksa-badge">{m.illustrative_label({}, options)}</span>
                      ) : null}
                    </span>
                    <span className="aksa-launchpad__flat-desc">{item.desc}</span>
                  </div>
                </span>
              </li>
            );
          }

          return (
            <li className="aksa-launchpad__flat-item" key={item.name}>
              <Link
                className="aksa-launchpad__flat-link"
                href={item.href as never}
              >
                <div className="aksa-launchpad__flat-icon">
                  <Icon aria-hidden="true" className="aksa-icon" />
                </div>
                <div className="aksa-launchpad__flat-info">
                  <span className="aksa-launchpad__flat-name">{item.name}</span>
                  <span className="aksa-launchpad__flat-desc">{item.desc}</span>
                </div>
                <div className="aksa-launchpad__flat-action">
                  <ChevronRight aria-hidden="true" className="aksa-icon aksa-icon--muted" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
