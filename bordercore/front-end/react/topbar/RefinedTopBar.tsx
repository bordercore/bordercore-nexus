import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faSliders,
  faChartLine,
  faCommentDots,
  faCircleQuestion,
  faArrowRightFromBracket,
  faClockRotateLeft,
  faTimes,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import TopSearch, { TopSearchHandle } from "../search/TopSearch";
import OverdueTasks from "../todo/OverdueTasks";
import RecentBlobs from "../blob/RecentBlobs";
import Weather from "../common/Weather";
import { Popover } from "../common/Popover";
import { resolveSection } from "./sectionMap";
import TopBarBackground from "./TopBarBackground";

interface BaseTemplateData {
  failedTestCount?: number;
  title?: string;
  /** Optional third crumb (e.g. "exercise" on a fitness detail page). Set per-template via {% block crumb_leaf %}. */
  crumbLeaf?: string;
  username?: string;
  metricsUrl?: string;
  topSearchConfig?: {
    initialSearchFilter?: string;
    initialSearchUrl?: string;
    querySearchUrl?: string;
    drillQuerySearchUrl?: string;
    storeInSessionUrl?: string;
  };
  overdueTasksConfig?: {
    rescheduleTaskUrl?: string;
    deleteTodoUrl?: string;
  };
  recentBlobsConfig?: {
    blobDetailUrl?: string;
  };
  urls?: {
    getWeather?: string;
  };
  userMenuItems?: Array<{
    id: string;
    title: string;
    url: string;
    icon?: string;
    extra?: number | string;
    clickHandler?: string | (() => void);
  }>;
}

interface WeatherInfo {
  current?: {
    temp_f?: number;
  };
}

// ============================================================================
// Sub-components
// ============================================================================

function WeatherPill({ weather }: { weather: WeatherInfo | null }) {
  const temp = weather?.current?.temp_f;
  if (temp === undefined) return null;
  return (
    <div className="refined-tb-weather" title={`${Math.round(temp)}°F`}>
      <Weather weatherInfo={weather} />
      <span className="temp">{Math.round(temp)}°</span>
    </div>
  );
}

function AlertPill({ count, metricsUrl }: { count: number; metricsUrl: string }) {
  if (count <= 0) return null;
  return (
    <a href={metricsUrl} className="refined-tb-alert" title={`${count} tests failing`}>
      <span className="pulse-dot" />
      <span className="num">{count}</span>
      <span className="word">failing</span>
    </a>
  );
}

const MENU_ICONS: Record<string, IconDefinition> = {
  briefcase: faSliders,
  "chart-bar": faChartLine,
  comment: faCommentDots,
  question: faCircleQuestion,
  "sign-out-alt": faArrowRightFromBracket,
};

interface UserMenuLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  isLogout?: boolean;
  onClick?: () => void;
}

function UserMenu({
  open,
  username,
  links,
  onOpenChange,
}: {
  open: boolean;
  username: string;
  links: UserMenuLink[];
  onOpenChange: (open: boolean) => void;
}) {
  const trigger = (
    <button type="button" className={`refined-tb-user${open ? " open" : ""}`}>
      <span className="avatar">{(username[0] || "U").toUpperCase()}</span>
      <span className="greeting">
        Hello <strong>{username}</strong>
      </span>
      <span className="chev">
        <FontAwesomeIcon icon={faChevronDown} />
      </span>
    </button>
  );

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      placement="bottom-end"
      offsetDistance={6}
    >
      <div className="refined-tb-menu" role="menu">
        {links.map((link, i) => {
          const showDivider = link.isLogout && i > 0;
          const icon = link.icon ? MENU_ICONS[link.icon] : undefined;
          return (
            <React.Fragment key={link.id}>
              {showDivider && <div className="refined-tb-menu-divider" />}
              <a
                href={link.url}
                className="refined-tb-menu-item"
                role="menuitem"
                onClick={e => {
                  if (link.onClick) {
                    e.preventDefault();
                    link.onClick();
                  }
                  onOpenChange(false);
                }}
              >
                {icon && <FontAwesomeIcon icon={icon} />}
                <span>{link.title}</span>
              </a>
            </React.Fragment>
          );
        })}
      </div>
    </Popover>
  );
}

// ============================================================================
// Main component
// ============================================================================

export default function RefinedTopBar() {
  const data: BaseTemplateData = (window as any).BASE_TEMPLATE_DATA || {};
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [recentBlobs, setRecentBlobs] = useState<any>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<any>(null);
  const [failedTestCount] = useState(data.failedTestCount || 0);
  const [pageTitle] = useState<string>(data.title || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const username = data.username || "User";
  const topSearchRef = useRef<TopSearchHandle>(null);

  const section = resolveSection(window.location.pathname);
  const title = pageTitle || section.defaultTitle;
  const crumbLeaf = (data.crumbLeaf || "").trim();

  useEffect(() => {
    const weatherEl = document.getElementById("weather_info");
    const overdueEl = document.getElementById("overdue_tasks");
    const recentBlobsEl = document.getElementById("recent_blobs");
    const recentlyViewedEl = document.getElementById("recently_viewed");
    if (weatherEl) setWeather(JSON.parse(weatherEl.textContent || "null"));
    if (overdueEl) setOverdueTasks(JSON.parse(overdueEl.textContent || "[]"));
    if (recentBlobsEl) setRecentBlobs(JSON.parse(recentBlobsEl.textContent || "{}"));
    if (recentlyViewedEl) setRecentlyViewed(JSON.parse(recentlyViewedEl.textContent || "{}"));
  }, []);

  useEffect(() => {
    const url = data.urls?.getWeather;
    if (!url) return;
    const fetchWeather = async () => {
      try {
        const res = await axios.get(url);
        if (res.data?.weather) setWeather(res.data.weather);
      } catch (err) {
        console.error("Failed to fetch weather:", err);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, [data.urls?.getWeather]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "c" && event.altKey) {
        (window as any).EventBus?.$emit("chat", {});
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleChatBot = () => {
    (window as any).EventBus?.$emit("chat", {});
  };

  const showHelp = () => {
    const helpTextEl = document.getElementById("help-text");
    setHelpText(helpTextEl?.textContent?.trim() || "");
    setHelpOpen(true);
  };

  // Escape closes the help modal when it's open. Mirrors the per-modal Escape
  // pattern used by the refined modal family.
  useEffect(() => {
    if (!helpOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [helpOpen]);

  const userMenuLinks: UserMenuLink[] = (data.userMenuItems || []).map(item => {
    let onClick: (() => void) | undefined;
    if (item.clickHandler === "handleChatBot") onClick = handleChatBot;
    else if (item.clickHandler === "showHelp") onClick = showHelp;
    else if (typeof item.clickHandler === "function") onClick = item.clickHandler;
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      icon: item.icon,
      isLogout: item.title === "Logout",
      onClick,
    };
  });

  const metricsUrl =
    data.metricsUrl || data.userMenuItems?.find(i => i.title === "Metrics")?.url || "#";

  return (
    <>
      <div className="refined-tb">
        <TopBarBackground />
        {(() => {
          // Build the crumb chain root → section → leaf, then mark the last as current.
          // The current crumb is rendered as plain text (no link to itself).
          const crumbs: Array<{ label: string; href?: string; root?: boolean }> = [
            { label: "Bordercore", href: "/", root: true },
          ];
          if (section.label && section.rootUrl) {
            crumbs.push({ label: section.label, href: section.rootUrl });
          }
          if (crumbLeaf) {
            crumbs.push({ label: crumbLeaf });
          }
          const lastIdx = crumbs.length - 1;
          return (
            <nav className="refined-tb-crumb" aria-label="breadcrumb">
              {crumbs.map((c, i) => {
                const isCurrent = i === lastIdx;
                const linkClass = c.root ? "root" : undefined;
                return (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <span className="sep" aria-hidden="true">
                        /
                      </span>
                    )}
                    {isCurrent ? (
                      <span className="leaf" aria-current="page">
                        {c.label}
                      </span>
                    ) : (
                      <a className={linkClass} href={c.href}>
                        {c.label}
                      </a>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Hidden h1 keeps the page title in the DOM for legacy consumers. */}
              <h1 className="visually-hidden">{title}</h1>
            </nav>
          );
        })()}
        <div className="refined-tb-right">
          <WeatherPill weather={weather} />
          <TopSearch
            ref={topSearchRef}
            initialSearchFilter={data.topSearchConfig?.initialSearchFilter || ""}
            initialSearchUrl={data.topSearchConfig?.initialSearchUrl || ""}
            querySearchUrl={data.topSearchConfig?.querySearchUrl || ""}
            drillQuerySearchUrl={data.topSearchConfig?.drillQuerySearchUrl || ""}
            storeInSessionUrl={data.topSearchConfig?.storeInSessionUrl || ""}
            recentSearches={getRecentSearches()}
          />
          {recentBlobs && recentlyViewed && (
            <RecentBlobs
              blobListInfo={recentBlobs}
              blobDetailUrl={data.recentBlobsConfig?.blobDetailUrl || ""}
              recentlyViewed={recentlyViewed}
            />
          )}
          <AlertPill count={failedTestCount} metricsUrl={metricsUrl} />
          {overdueTasks.length > 0 && (
            <button
              type="button"
              className="refined-tb-overdue"
              onClick={() => setOverdueOpen(true)}
              title={`${overdueTasks.length} overdue tasks`}
            >
              <FontAwesomeIcon icon={faClockRotateLeft} />
              <span className="num">{overdueTasks.length}</span>
              <span className="word">overdue</span>
            </button>
          )}
          <div className="refined-tb-div" />
          <UserMenu
            open={menuOpen}
            username={username}
            links={userMenuLinks}
            onOpenChange={setMenuOpen}
          />
        </div>
      </div>
      <OverdueTasks
        open={overdueOpen}
        onClose={() => setOverdueOpen(false)}
        taskListInitial={overdueTasks}
        rescheduleTaskUrl={data.overdueTasksConfig?.rescheduleTaskUrl || ""}
        deleteTodoUrl={data.overdueTasksConfig?.deleteTodoUrl || ""}
      />
      {helpOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={() => setHelpOpen(false)} />
            <div className="refined-modal" role="dialog" aria-label="help">
              <button
                type="button"
                className="refined-modal-close"
                onClick={() => setHelpOpen(false)}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 className="refined-modal-title">
                <FontAwesomeIcon icon={faCircleQuestion} className="refined-help-title-icon" />
                Help
              </h2>
              <div className="refined-help-body">
                {helpText || "No help available for this page."}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

function getRecentSearches() {
  const el = document.getElementById("recent_searches");
  if (!el) return [];
  try {
    return JSON.parse(el.textContent || "[]");
  } catch {
    return [];
  }
}
