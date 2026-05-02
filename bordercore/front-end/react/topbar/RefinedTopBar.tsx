import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faSliders,
  faChartLine,
  faCommentDots,
  faCircleQuestion,
  faArrowRightFromBracket,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import TopSearch, { TopSearchHandle } from "../search/TopSearch";
import OverdueTasks from "../todo/OverdueTasks";
import RecentBlobs from "../blob/RecentBlobs";
import Weather from "../common/Weather";
import { Popover } from "../common/Popover";
import { resolveSection } from "./sectionMap";
import AuroraBg from "./AuroraBg";

interface BaseTemplateData {
  failedTestCount?: number;
  title?: string;
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
  const [recentBlobs, setRecentBlobs] = useState<any>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<any>(null);
  const [failedTestCount] = useState(data.failedTestCount || 0);
  const [pageTitle] = useState<string>(data.title || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const username = data.username || "User";
  const topSearchRef = useRef<TopSearchHandle>(null);

  const section = resolveSection(window.location.pathname);
  const title = pageTitle || section.defaultTitle;

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
    const modalBodyEl = document.getElementById("modal-body-help");
    if (helpTextEl && modalBodyEl) {
      modalBodyEl.textContent = helpTextEl.textContent || "";
      const modalEl = document.getElementById("modalHelp");
      const Modal = (window as any).bootstrap?.Modal;
      if (modalEl && Modal) new Modal(modalEl).show();
    }
  };

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
        <AuroraBg />
        <div className="refined-tb-title">
          <span className="icon">
            <FontAwesomeIcon icon={section.icon} />
          </span>
          <h1>{title}</h1>
        </div>
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
          <div className="refined-tb-div" />
          <UserMenu
            open={menuOpen}
            username={username}
            links={userMenuLinks}
            onOpenChange={setMenuOpen}
          />
        </div>
      </div>
      <div id="overdue-tasks">
        <OverdueTasks
          taskListInitial={overdueTasks}
          rescheduleTaskUrl={data.overdueTasksConfig?.rescheduleTaskUrl || ""}
          deleteTodoUrl={data.overdueTasksConfig?.deleteTodoUrl || ""}
        />
      </div>
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
