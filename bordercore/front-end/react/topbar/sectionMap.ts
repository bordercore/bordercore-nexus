import {
  faBookmark,
  faNewspaper,
  faListCheck,
  faBolt,
  faNoteSticky,
  faTag,
  faGraduationCap,
  faMusic,
  faHouse,
  faMagnifyingGlass,
  faBox,
  faCopy,
  faGripHorizontal,
  faRunning,
  faClock,
  faBook,
  faGear,
  faChartBar,
  faShareNodes,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

export interface Section {
  icon: IconDefinition;
  defaultTitle: string;
  /** Lowercase label rendered as the second crumb (e.g. "fitness"). Empty/undefined for the home/default section. */
  label?: string;
  /** URL the section crumb links to. Empty/undefined for the home/default section. */
  rootUrl?: string;
}

// Map URL prefix → section. First match wins; order matters for overlapping prefixes.
const ROUTES: Array<{ prefix: string; section: Section }> = [
  {
    prefix: "/bookmark/",
    section: {
      icon: faBookmark,
      defaultTitle: "Bookmarks",
      label: "bookmarks",
      rootUrl: "/bookmark/",
    },
  },
  {
    prefix: "/feed/",
    section: { icon: faNewspaper, defaultTitle: "Feeds", label: "feeds", rootUrl: "/feed/" },
  },
  {
    prefix: "/todo/",
    section: { icon: faListCheck, defaultTitle: "Todo", label: "todos", rootUrl: "/todo/" },
  },
  {
    prefix: "/drill/",
    section: { icon: faBolt, defaultTitle: "Drill", label: "drill", rootUrl: "/drill/" },
  },
  {
    prefix: "/blob/notes",
    section: { icon: faNoteSticky, defaultTitle: "Notes", label: "notes", rootUrl: "/blob/notes/" },
  },
  {
    prefix: "/blob/bookshelf",
    section: {
      icon: faBook,
      defaultTitle: "Bookshelf",
      label: "bookshelf",
      rootUrl: "/blob/bookshelf",
    },
  },
  {
    prefix: "/note/",
    section: { icon: faNoteSticky, defaultTitle: "Notes", label: "notes", rootUrl: "/note/" },
  },
  {
    prefix: "/tag/",
    section: { icon: faTag, defaultTitle: "Tags", label: "tags", rootUrl: "/tag/" },
  },
  {
    prefix: "/blob/",
    section: { icon: faCopy, defaultTitle: "Blobs", label: "blobs", rootUrl: "/blob/list" },
  },
  {
    prefix: "/collection/",
    section: {
      icon: faGripHorizontal,
      defaultTitle: "Collections",
      label: "collections",
      rootUrl: "/collection/",
    },
  },
  {
    prefix: "/node/",
    section: { icon: faBox, defaultTitle: "Nodes", label: "nodes", rootUrl: "/node/" },
  },
  {
    prefix: "/music/",
    section: { icon: faMusic, defaultTitle: "Music", label: "music", rootUrl: "/music/" },
  },
  {
    prefix: "/fitness/",
    section: { icon: faRunning, defaultTitle: "Fitness", label: "fitness", rootUrl: "/fitness/" },
  },
  {
    prefix: "/habit/",
    section: { icon: faGraduationCap, defaultTitle: "Habits", label: "habits", rootUrl: "/habit/" },
  },
  {
    prefix: "/reminder/",
    section: {
      icon: faClock,
      defaultTitle: "Reminders",
      label: "reminders",
      rootUrl: "/reminder/",
    },
  },
  {
    prefix: "/search/",
    section: {
      icon: faMagnifyingGlass,
      defaultTitle: "Search",
      label: "search",
      rootUrl: "/search/",
    },
  },
  {
    prefix: "/accounts/",
    section: {
      icon: faGear,
      defaultTitle: "Settings",
      label: "settings",
      rootUrl: "/accounts/prefs/",
    },
  },
  {
    prefix: "/metrics/",
    section: { icon: faChartBar, defaultTitle: "Metrics", label: "metrics", rootUrl: "/metrics/" },
  },
  {
    prefix: "/books",
    section: { icon: faBook, defaultTitle: "Books", label: "books", rootUrl: "/books/" },
  },
  {
    prefix: "/visualize/",
    section: {
      icon: faShareNodes,
      defaultTitle: "Constellation",
      label: "visualize",
      rootUrl: "/visualize/",
    },
  },
];

const DEFAULT_SECTION: Section = { icon: faHouse, defaultTitle: "Bordercore" };

export function resolveSection(pathname: string): Section {
  for (const { prefix, section } of ROUTES) {
    if (pathname.startsWith(prefix)) return section;
  }
  return DEFAULT_SECTION;
}
