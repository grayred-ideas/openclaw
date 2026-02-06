import { html, nothing } from "lit";
import type { SessionsListResult } from "../types.ts";
import { icons } from "../icons.ts";

export type SessionTabsProps = {
  sessions: SessionsListResult | null;
  activeSessionKey: string;
  mainSessionKey?: string | null;
  connected: boolean;
  onSessionChange: (sessionKey: string) => void;
  onNewSession: () => void;
  onCloseSession?: (sessionKey: string) => void;
};

function resolveSessionDisplayName(key: string, row?: SessionsListResult["sessions"][number]) {
  const label = row?.label?.trim();
  if (label) {
    return `${label}`;
  }
  const displayName = row?.displayName?.trim();
  if (displayName && displayName !== key) {
    return displayName;
  }
  return key;
}

function truncateTabName(name: string, maxLength = 20): string {
  if (name.length <= maxLength) {
    return name;
  }
  return name.slice(0, maxLength - 3) + "...";
}

function getSessionStatus(
  session: SessionsListResult["sessions"][number],
): "active" | "idle" | "unknown" {
  if (!session.updatedAt) {
    return "unknown";
  }

  const now = Date.now();
  const updatedAt = new Date(session.updatedAt).getTime();
  const minutesAgo = (now - updatedAt) / (1000 * 60);

  if (minutesAgo < 5) {
    return "active";
  } else if (minutesAgo < 30) {
    return "idle";
  }
  return "unknown";
}

export function renderSessionTabs(props: SessionTabsProps) {
  if (!props.sessions?.sessions) {
    return nothing;
  }

  const sessions = props.sessions.sessions;
  const mainSessionKey = props.mainSessionKey || "main";

  // Sort sessions: main session first, then alphabetical
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.key === mainSessionKey) return -1;
    if (b.key === mainSessionKey) return 1;
    return a.key.localeCompare(b.key);
  });

  // Ensure active session is included even if not in sessions list
  const activeSessionInList = sortedSessions.some((s) => s.key === props.activeSessionKey);
  if (!activeSessionInList) {
    sortedSessions.push({
      key: props.activeSessionKey,
      kind: "agent",
      displayName: props.activeSessionKey,
      label: null,
      updatedAt: null,
      tokenUsage: null,
    });
  }

  return html`
    <div class="session-tabs">
      <div class="session-tabs__container">
        <div class="session-tabs__track">
          ${sortedSessions.map((session) => {
            const isActive = session.key === props.activeSessionKey;
            const isMain = session.key === mainSessionKey;
            const status = getSessionStatus(session);
            const displayName = resolveSessionDisplayName(session.key, session);
            const truncatedName = truncateTabName(displayName);

            return html`
              <div
                class="session-tab ${isActive ? "session-tab--active" : ""} ${isMain ? "session-tab--main" : ""}"
                @click=${() => props.onSessionChange(session.key)}
                @contextmenu=${(e: MouseEvent) => {
                  if (props.onCloseSession && !isMain) {
                    e.preventDefault();
                    props.onCloseSession(session.key);
                  }
                }}
              >
                <span class="session-tab__status-dot session-tab__status-dot--${status}"></span>
                <span class="session-tab__name" title="${displayName}">${truncatedName}</span>
                ${
                  props.onCloseSession && !isMain
                    ? html`
                        <button
                          class="session-tab__close"
                          type="button"
                          aria-label="Close session"
                          @click=${(e: Event) => {
                            e.stopPropagation();
                            props.onCloseSession!(session.key);
                          }}
                        >
                          ${icons.x}
                        </button>
                      `
                    : nothing
                }
              </div>
            `;
          })}
          
          <button
            class="session-tabs__new"
            type="button"
            title="New session"
            ?disabled=${!props.connected}
            @click=${props.onNewSession}
          >
            ${icons.plus}
          </button>
        </div>
      </div>
    </div>
  `;
}
