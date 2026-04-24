import React from "react";
import { createRoot } from "react-dom/client";
import { BaseStoreProvider, useBaseStore } from "../react/stores/BaseStore";
import Toast from "../react/common/Toast";
import Weather from "../react/common/Weather";
import TopSearch, { TopSearchHandle } from "../react/search/TopSearch";
import RecentBlobs from "../react/blob/RecentBlobs";
import DropDownMenu from "../react/common/DropDownMenu";
import OverdueTasks from "../react/todo/OverdueTasks";
import ChatBot, { ChatBotHandle } from "../react/blob/ChatBot";
import SidebarMenu from "../react/common/SidebarMenu";
import GlobalAudioPlayer from "../react/music/GlobalAudioPlayer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faAngleDown, faBriefcase, faChartBar, faComment, faQuestion, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { Modal } from "bootstrap";
import MarkdownIt from "markdown-it";
import { EventBus, doGet, doPost } from "../react/utils/reactUtils";

// Initialize markdown-it renderer
const markdown = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// Set up globals for compatibility with code that expects them
if (typeof window !== "undefined") {
  window.EventBus = EventBus;
  window.doGet = doGet;
  window.doPost = doPost;
  window.markdown = markdown;
}

// Declare global types for window object
declare global {
  interface Window {
    BASE_TEMPLATE_DATA?: any;
    EventBus?: any;
    doPost?: (url: string, params: any, callback: (response: any) => void) => void;
    doGet?: (url: string, callback: (response: any) => void, errorMsg?: string) => void;
    markdown?: any;
  }
}

function TopBarContent() {
  const data = window.BASE_TEMPLATE_DATA || {};
  const [weatherInfo, setWeatherInfo] = React.useState<any>(null);
  const [recentBlobs, setRecentBlobs] = React.useState<any>(null);
  const [recentlyViewed, setRecentlyViewed] = React.useState<any>(null);
  const [recentSearches, setRecentSearches] = React.useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = React.useState<any[]>([]);
  const [failedTestCount, setFailedTestCount] = React.useState(data.failedTestCount || 0);
  const [pageTitle, setPageTitle] = React.useState<string>(data.title || "");
  const username = data.username || "User";
  const topSearchRef = React.useRef<TopSearchHandle>(null);

  React.useEffect(() => {
    // Load data from json_script tags
    const recentBlobsEl = document.getElementById("recent_blobs");
    const recentlyViewedEl = document.getElementById("recently_viewed");
    const recentSearchesEl = document.getElementById("recent_searches");
    const overdueTasksEl = document.getElementById("overdue_tasks");
    const weatherInfoEl = document.getElementById("weather_info");

    if (recentBlobsEl) {
      setRecentBlobs(JSON.parse(recentBlobsEl.textContent || "{}"));
    }
    if (recentlyViewedEl) {
      setRecentlyViewed(JSON.parse(recentlyViewedEl.textContent || "{}"));
    }
    if (recentSearchesEl) {
      setRecentSearches(JSON.parse(recentSearchesEl.textContent || "[]"));
    }
    if (overdueTasksEl) {
      setOverdueTasks(JSON.parse(overdueTasksEl.textContent || "[]"));
    }
    if (weatherInfoEl) {
      setWeatherInfo(JSON.parse(weatherInfoEl.textContent || "null"));
    }
  }, []);


  React.useEffect(() => {
    // Fetch weather data every 10 minutes
    if (data.urls?.getWeather) {
      const fetchWeather = async () => {
        try {
          const response = await axios.get(data.urls.getWeather);
          if (response.data && response.data.weather) {
            setWeatherInfo(response.data.weather);
          }
        } catch (error) {
          console.error("Failed to fetch weather data:", error);
        }
      };
      const interval = setInterval(fetchWeather, 600000); // 10 minutes
      fetchWeather(); // Initial fetch
      return () => clearInterval(interval);
    }
  }, [data.urls?.getWeather]);

  React.useEffect(() => {
    // Handle keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "c" && event.altKey) {
        // Toggle chatbot
        EventBus.$emit("chat", {});
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleChatBot = () => {
    EventBus.$emit("chat", {});
  };

  const showHelp = () => {
    const helpTextEl = document.getElementById("help-text");
    const modalBodyEl = document.getElementById("modal-body-help");
    if (helpTextEl && modalBodyEl) {
      const helpText = helpTextEl.innerHTML;
      modalBodyEl.innerHTML = markdown.render(helpText);
      const modalElement = document.getElementById("modalHelp");
      if (modalElement) {
        const modal = new Modal(modalElement);
        modal.show();
      }
    }
  };

  const openSearchWindow = () => {
    if (topSearchRef.current) {
      topSearchRef.current.focusSearch();
      // Also trigger the custom event for the component's internal handler
      window.dispatchEvent(new CustomEvent("openSearchWindow"));
    }
  };

  const userMenuItems = (data.userMenuItems || []).map((item: any) => {
    if (item.clickHandler === "handleChatBot") {
      return { ...item, clickHandler: handleChatBot };
    } else if (item.clickHandler === "showHelp") {
      return { ...item, clickHandler: showHelp };
    }
    return item;
  });

  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      briefcase: faBriefcase,
      "chart-bar": faChartBar,
      comment: faComment,
      question: faQuestion,
      "sign-out-alt": faSignOutAlt,
    };
    return icons[iconName] || faBriefcase;
  };

  return (
    <>
      <div className="top-title-container" id="top-title">
        <span id="top-title-text">
          {pageTitle}
        </span>
      </div>
      <div className="top-bar-right">
        {weatherInfo && (
          <div id="weather-display" className="top-bar-item">
            <Weather weatherInfo={weatherInfo} />
          </div>
        )}
        <div id="top-search-bar" className="top-bar-item">
          <TopSearch
            ref={topSearchRef}
            initialSearchFilter={data.topSearchConfig?.initialSearchFilter || ""}
            initialSearchUrl={data.topSearchConfig?.initialSearchUrl || ""}
            querySearchUrl={data.topSearchConfig?.querySearchUrl || ""}
            noteQuerySearchUrl={data.topSearchConfig?.noteQuerySearchUrl || ""}
            drillQuerySearchUrl={data.topSearchConfig?.drillQuerySearchUrl || ""}
            storeInSessionUrl={data.topSearchConfig?.storeInSessionUrl || ""}
            recentSearches={recentSearches}
          />
        </div>
        {recentBlobs && recentlyViewed && (
        <div id="rb-popover" className="top-bar-item">
          <RecentBlobs
            blobListInfo={recentBlobs}
            blobDetailUrl={data.recentBlobsConfig?.blobDetailUrl || ""}
            recentlyViewed={recentlyViewed}
          />
        </div>
        )}
        <div id="user-menu-wrapper" className="top-bar-item user-menu-wrapper">
          <DropDownMenu
            links={userMenuItems}
            showTarget={false}
            iconSlot={
              <span className="user-greeting">
                <span className="align-middle ms-2">
                  Hello <strong>{username}</strong>
                </span>
                {failedTestCount > 0 && (
                  <span className="dropdown-item-extra align-middle ms-2">{failedTestCount}</span>
                )}
                <FontAwesomeIcon icon={faAngleDown} className="align-middle ms-2" />
              </span>
            }
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

function ChatBotContent() {
  const data = window.BASE_TEMPLATE_DATA || {};
  const chatBotRef = React.useRef<ChatBotHandle>(null);

  return (
    <ChatBot
      ref={chatBotRef}
      blobUuid={data.chatBotConfig?.blobUuid || ""}
      chatUrl={data.chatBotConfig?.chatUrl || ""}
      csrfToken={data.chatBotConfig?.csrfToken || ""}
    />
  );
}

function parseInitialOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((h): h is string => typeof h === "string");
}

function applyOrder<T extends { href: string }>(items: T[], order: string[]): T[] {
  if (!order.length) {
    return items;
  }
  const byHref = new Map(items.map(i => [i.href, i]));
  const ordered: T[] = [];
  for (const href of order) {
    const item = byHref.get(href);
    if (item) {
      ordered.push(item);
      byHref.delete(href);
    }
  }
  // Append any items not present in the saved order (e.g., new menu entries)
  for (const item of items) {
    if (byHref.has(item.href)) {
      ordered.push(item);
    }
  }
  return ordered;
}

function SidebarContent() {
  const { sidebarCollapsed, setSidebarCollapsed } = useBaseStore();
  const data = window.BASE_TEMPLATE_DATA || {};
  const [menu, setMenu] = React.useState<any[]>([]);

  // Sync wrapper class for any other CSS dependencies
  React.useEffect(() => {
    const wrapper = document.querySelector(".wrapper");
    if (wrapper) {
      if (sidebarCollapsed) {
        wrapper.classList.add("collapsed");
      } else {
        wrapper.classList.remove("collapsed");
      }
    }
  }, [sidebarCollapsed]);

  React.useEffect(() => {
    // Build menu structure
    const menuItems = [
      {
        href: "/",
        title: "Home",
        class: "first-item",
        color: "#cbd5e1",
        icon: { element: "font-awesome-icon", attributes: { icon: "home" }, class: "fa-xs" },
      },
      {
        href: "/search/",
        title: "Search",
        alias: "/search/*",
        color: "#38bdf8",
        icon: { element: "font-awesome-icon", attributes: { icon: "search" }, class: "" },
      },
      {
        href: "/bookmark/",
        title: "Bookmarks",
        alias: "/bookmark/*",
        color: "#fcd34d",
        icon: { element: "font-awesome-icon", attributes: { icon: "bookmark" }, class: "" },
        badge: { text: "", class: "" },
      },
      {
        href: "/node/",
        title: "Nodes",
        alias: "/node/*",
        color: "#818cf8",
        icon: { element: "font-awesome-icon", attributes: { icon: "box" }, class: "" },
      },
      {
        href: "/collection/",
        title: "Collections",
        alias: "/collection/*",
        color: "#22d3ee",
        icon: { element: "font-awesome-icon", attributes: { icon: "grip-horizontal" }, class: "" },
      },
      {
        href: "/feed/",
        title: "Feeds",
        color: "#fb7185",
        icon: { element: "font-awesome-icon", attributes: { icon: "newspaper" }, class: "" },
      },
      {
        href: "/search/notes",
        title: "Notes",
        color: "#eab308",
        icon: { element: "font-awesome-icon", attributes: { icon: "sticky-note" }, class: "" },
      },
      {
        href: "/blob/list",
        title: "Blobs",
        alias: "/blob/list",
        color: "#94a3b8",
        icon: { element: "font-awesome-icon", attributes: { icon: "copy" }, class: "" },
      },
      {
        href: "/drill/",
        title: "Drill",
        alias: "/drill/*",
        color: "#a78bfa",
        icon: { element: "font-awesome-icon", attributes: { icon: "graduation-cap" }, class: "" },
      },
      {
        href: "/music/",
        title: "Music",
        alias: ["/music/artist/*", "/music/album/*", "/music/tag/*"],
        color: "#e879f9",
        icon: { element: "font-awesome-icon", attributes: { icon: "music" }, class: "" },
      },
      {
        href: "/todo/",
        title: "Todo",
        alias: "/todo/*",
        color: "#fb923c",
        icon: { element: "font-awesome-icon", attributes: { icon: "tasks" }, class: "" },
        badge: data.sidebarConfig?.todoCount
          ? { text: data.sidebarConfig.todoCount, class: "vsm--badge_default" }
          : undefined,
      },
      {
        href: "/reminder/",
        title: "Reminders",
        alias: "/reminder/*",
        color: "#fbbf24",
        icon: { element: "font-awesome-icon", attributes: { icon: "clock" }, class: "" },
      },
      {
        href: "/habit/",
        title: "Habits",
        alias: "/habit/*",
        color: "#2dd4bf",
        icon: { element: "font-awesome-icon", attributes: { icon: "check-double" }, class: "" },
      },
      {
        href: "/tag/list",
        title: "Tags",
        alias: "/tag/list",
        color: "#f472b6",
        icon: { element: "font-awesome-icon", attributes: { icon: "tags" }, class: "" },
      },
      {
        href: "/fitness/",
        title: "Fitness",
        alias: "/fitness/*",
        color: "#a3e635",
        icon: { element: "font-awesome-icon", attributes: { icon: "running" }, class: "" },
        badge: data.sidebarConfig?.exerciseCount
          ? { text: data.sidebarConfig.exerciseCount, class: "vsm--badge_default" }
          : undefined,
      },
      {
        href: "/visualize/",
        title: "Constellation",
        alias: "/visualize/*",
        color: "#8ab4ff",
        icon: { element: "font-awesome-icon", attributes: { icon: "project-diagram" }, class: "" },
      },
    ];
    const savedOrder = parseInitialOrder(data.initialSidebarOrder);
    setMenu(applyOrder(menuItems, savedOrder));
  }, [data.sidebarConfig, data.initialSidebarOrder]);

  React.useEffect(() => {
    // Update bookmark count every minute
    if (data.sidebarConfig?.getNewBookmarksCountUrl) {
      const getUntaggedBookmarkCount = () => {
        const currentTime = new Date().getTime();
        const url = data.sidebarConfig.getNewBookmarksCountUrl.replace(/666/, currentTime.toString());
        doGet(
          url,
          (response: any) => {
            const count = response.data.count;
            setMenu((prev) =>
              prev.map((item) =>
                item.title === "Bookmarks"
                  ? {
                      ...item,
                      badge: { text: count, class: count === 0 ? "d-none" : "vsm--badge_default" },
                    }
                  : item
              )
            );
          },
          "Error getting new bookmarks count"
        );
      };
      const interval = setInterval(getUntaggedBookmarkCount, 60000);
      getUntaggedBookmarkCount(); // Initial call
      return () => clearInterval(interval);
    }
  }, [data.sidebarConfig]);

  const onToggleCollapse = (newCollapsed: boolean) => {
    setSidebarCollapsed(newCollapsed);

    if (data.sidebarConfig?.storeInSessionUrl) {
      doPost(
        data.sidebarConfig.storeInSessionUrl,
        { show_sidebar: !newCollapsed },
        () => {}
      );
    }
  };

  const onReorder = (newOrder: string[]) => {
    setMenu(prev => applyOrder(prev, newOrder));
    if (data.sidebarConfig?.updateSidebarOrderUrl) {
      doPost(
        data.sidebarConfig.updateSidebarOrderUrl,
        { order: JSON.stringify(newOrder) },
        () => {}
      );
    }
  };

  return (
    <SidebarMenu
      menu={menu}
      collapsed={sidebarCollapsed}
      onToggleCollapse={onToggleCollapse}
      onReorder={onReorder}
      headerSlot={
        <div
          className="d-flex align-items-center"
          style={{
            padding: "1rem",
            paddingBottom: "0.5rem",
            justifyContent: sidebarCollapsed ? "center" : "flex-start"
          }}
        >
          <img
            src={(window.BASE_TEMPLATE_DATA?.staticUrl || "/static/") + "img/bordercore-logo.jpg"}
            width={sidebarCollapsed ? "64" : "48"}
            height={sidebarCollapsed ? "64" : "48"}
            alt="Bordercore"
            style={{ flexShrink: 0 }}
          />
          {!sidebarCollapsed && (
            <span style={{ marginLeft: "12px", fontSize: "16px", fontWeight: 600, color: "var(--sidebar-color)" }}>
              Bordercore
            </span>
          )}
        </div>
      }
    />
  );
}

// Mount components to their respective DOM elements
const toastContainer = document.getElementById("react-toast");
if (toastContainer) {
  const toastRoot = createRoot(toastContainer);
  const data = window.BASE_TEMPLATE_DATA || {};
  toastRoot.render(
    <BaseStoreProvider initialCollapsed={data.initialSidebarCollapsed || false}>
      <Toast initialMessages={data.initialMessages || []} />
    </BaseStoreProvider>
  );
}

const topBarContainer = document.getElementById("top-bar");
if (topBarContainer) {
  // Read title from server-rendered span before React replaces it
  const originalTitleEl = document.getElementById("top-title-text");
  if (originalTitleEl?.textContent?.trim()) {
    window.BASE_TEMPLATE_DATA = window.BASE_TEMPLATE_DATA || {};
    window.BASE_TEMPLATE_DATA.title = originalTitleEl.textContent.trim();
  }

  const topBarRoot = createRoot(topBarContainer);
  const data = window.BASE_TEMPLATE_DATA || {};
  topBarRoot.render(
    <BaseStoreProvider initialCollapsed={data.initialSidebarCollapsed || false}>
      <TopBarContent />
    </BaseStoreProvider>
  );
}

const sidebarContainer = document.getElementById("sidebar");
if (sidebarContainer) {
  const sidebarRoot = createRoot(sidebarContainer);
  const data = window.BASE_TEMPLATE_DATA || {};
  sidebarRoot.render(
    <BaseStoreProvider initialCollapsed={data.initialSidebarCollapsed || false}>
      <SidebarContent />
    </BaseStoreProvider>
  );
}

const chatBotContainer = document.getElementById("chat-bot");
if (chatBotContainer) {
  const chatBotRoot = createRoot(chatBotContainer);
  chatBotRoot.render(<ChatBotContent />);
}

const audioPlayerContainer = document.getElementById("global-audio-player");
if (audioPlayerContainer) {
  const audioPlayerRoot = createRoot(audioPlayerContainer);
  audioPlayerRoot.render(<GlobalAudioPlayer />);
}
