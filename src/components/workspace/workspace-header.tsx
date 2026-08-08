"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  Menu,
  Pause,
  Play,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { SessionState } from "@/lib/contracts/auth";
import type { GoogleConnection } from "@/lib/contracts/google";
import { googleConnectionCopy } from "@/lib/i18n/copy";
import { StatusChip } from "@/components/workspace/status-chip";
import { navigationLabelForPath } from "@/components/workspace/navigation-items";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useHeadControl } from "@/lib/client/vision/head-control-context";
import { useAksaActions } from "@/components/workspace/aksa-action-context";
import type { VisionFailureCategory } from "@/lib/client/vision/vision-engine";

/**
 * Quiet, compact workspace header.
 *
 * It reports location, account state, and Google connection. It is deliberately not
 * styled as a browser toolbar and recreates no browser chrome.
 */
function headControlFailureCopy(
  category: VisionFailureCategory | null,
  options: { locale: Locale }
): string {
  switch (category) {
    case "permission_denied":
      return m.a11y_camera_denied_status({}, options);
    case "no_device":
      return m.a11y_camera_missing_status({}, options);
    case "model_load_failed":
      return m.a11y_model_failed_status({}, options);
    case "stream_ended":
      return m.a11y_stream_ended_status({}, options);
    default:
      return m.a11y_camera_unavailable_status({}, options);
  }
}

export function WorkspaceHeader({
  locale,
  session,
  connection,
  onOpenNavigation
}: {
  locale: Locale;
  session?: SessionState;
  connection: GoogleConnection;
  onOpenNavigation: () => void;
}) {
  const pathname = usePathname();
  const options = { locale };
  const isAuthenticated = session?.status === "authenticated";
  const isGoogleConnected = connection.state === "connected";
  const title = navigationLabelForPath(pathname, locale);
  const headControl = useHeadControl();
  const { executeAksaIntent } = useAksaActions();
  const { lifecycleState, isPaused } = headControl;
  const calibrationProgress = Math.round(
    headControl.calibrationState.progressRatio * 100
  );

  return (
    <header aria-label={m.workspace_header_label({}, options)} className="aksa-header">
      <div className="aksa-header__leading">
        <button
          aria-controls="workspace-navigation-drawer"
          className="aksa-icon-button aksa-header__menu"
          onClick={onOpenNavigation}
          type="button"
        >
          <Menu aria-hidden="true" className="aksa-icon" />
          <span className="sr-only">{m.workspace_nav_open({}, options)}</span>
        </button>
        <span className="aksa-header__title-mobile">{title}</span>
      </div>

      <div className="aksa-header__actions">
        {lifecycleState === "idle" || lifecycleState === "disabled" ? (
          <button
            aria-label={m.a11y_start_head_control({}, options)}
            className="aksa-button aksa-button--secondary aksa-button--sm"
            onClick={() => void headControl.startHeadControl()}
            type="button"
          >
            <Camera aria-hidden="true" className="aksa-icon" size={16} />
            <span>{m.a11y_start_head_control({}, options)}</span>
          </button>
        ) : null}

        {lifecycleState === "initializing" ? (
          <>
            <StatusChip tone="pending" value={m.a11y_initializing_head_control({}, options)} />
            <button
              className="aksa-button aksa-button--quiet aksa-button--sm"
              onClick={headControl.disableControl}
              type="button"
            >
              {m.a11y_cancel_head_control({}, options)}
            </button>
          </>
        ) : null}

        {lifecycleState === "tracking_lost" ? (
          <StatusChip tone="attention" value={m.a11y_tracking_lost_status({}, options)} />
        ) : null}

        {lifecycleState === "active" || lifecycleState === "paused" ? (
          <button
            aria-label={isPaused ? m.a11y_resume_head_control({}, options) : m.a11y_pause_head_control({}, options)}
            className="aksa-button aksa-button--quiet aksa-button--sm"
            onClick={() => void executeAksaIntent(isPaused ? "HEAD_RESUME" : "HEAD_PAUSE")}
            type="button"
          >
            {isPaused ? (
              <>
                <Play aria-hidden="true" className="aksa-icon" size={16} />
                <span>{m.a11y_resume_head_control({}, options)}</span>
              </>
            ) : (
              <>
                <Pause aria-hidden="true" className="aksa-icon" size={16} />
                <span>{m.a11y_pause_head_control({}, options)}</span>
              </>
            )}
          </button>
        ) : null}

        {lifecycleState === "active" &&
        headControl.calibrationState.status === "capturing" ? (
          <StatusChip
            tone="pending"
            value={m.a11y_calibrating_head_control(
              { progress: calibrationProgress },
              options
            )}
          />
        ) : lifecycleState !== "initializing" ? (
          <button
            aria-label={
              headControl.calibrationState.status === "completed"
                ? m.a11y_recalibrate_head_control({}, options)
                : m.a11y_calibrate_head_control({}, options)
            }
            className="aksa-button aksa-button--quiet aksa-button--sm"
            onClick={() => void executeAksaIntent("HEAD_CALIBRATE")}
            type="button"
          >
            <Sparkles aria-hidden="true" className="aksa-icon" size={16} />
            <span>
              {headControl.calibrationState.status === "completed"
                ? m.a11y_recalibrate_head_control({}, options)
                : m.a11y_calibrate_head_control({}, options)}
            </span>
          </button>
        ) : null}

        {lifecycleState === "error" ? (
          <>
            <StatusChip
              tone="attention"
              value={headControlFailureCopy(headControl.errorCategory, options)}
            />
            <button
              aria-label={m.a11y_retry_head_control({}, options)}
              className="aksa-button aksa-button--secondary aksa-button--sm"
              onClick={() => void headControl.startHeadControl()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="aksa-icon" size={16} />
              <span>{m.a11y_retry_head_control({}, options)}</span>
            </button>
          </>
        ) : null}

        {!isAuthenticated ? (
          <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/sign-in">
            {m.action_sign_in({}, options)}
          </Link>
        ) : !isGoogleConnected ? (
          <Link className="aksa-button aksa-button--secondary aksa-button--sm" href="/workspace/settings">
            {connection.state === "needs_reconnect" ? "Reconnect Google" : m.action_connect_google({}, options)}
          </Link>
        ) : (
          <StatusChip
            label={m.google_connection_label({}, options)}
            tone="ready"
            value={googleConnectionCopy(connection.state, locale)}
          />
        )}

        <ThemeToggle locale={locale} />
      </div>
    </header>
  );
}
