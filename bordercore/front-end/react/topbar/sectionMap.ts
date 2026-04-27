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
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

export interface Section {
  icon: IconDefinition;
  defaultTitle: string;
}

// Map URL prefix → section. First match wins; order matters for overlapping prefixes.
const ROUTES: Array<{ prefix: string; section: Section }> = [
  { prefix: "/bookmark/", section: { icon: faBookmark, defaultTitle: "Bookmarks" } },
  { prefix: "/feed/", section: { icon: faNewspaper, defaultTitle: "Feeds" } },
  { prefix: "/todo/", section: { icon: faListCheck, defaultTitle: "Todo" } },
  { prefix: "/drill/", section: { icon: faBolt, defaultTitle: "Drill" } },
  { prefix: "/search/notes", section: { icon: faNoteSticky, defaultTitle: "Notes" } },
  { prefix: "/note/", section: { icon: faNoteSticky, defaultTitle: "Notes" } },
  { prefix: "/tag/", section: { icon: faTag, defaultTitle: "Tags" } },
  { prefix: "/blob/", section: { icon: faCopy, defaultTitle: "Blobs" } },
  { prefix: "/collection/", section: { icon: faGripHorizontal, defaultTitle: "Collections" } },
  { prefix: "/node/", section: { icon: faBox, defaultTitle: "Nodes" } },
  { prefix: "/music/", section: { icon: faMusic, defaultTitle: "Music" } },
  { prefix: "/fitness/", section: { icon: faRunning, defaultTitle: "Fitness" } },
  { prefix: "/habit/", section: { icon: faGraduationCap, defaultTitle: "Habits" } },
  { prefix: "/reminder/", section: { icon: faClock, defaultTitle: "Reminders" } },
  { prefix: "/search/", section: { icon: faMagnifyingGlass, defaultTitle: "Search" } },
];

const DEFAULT_SECTION: Section = { icon: faHouse, defaultTitle: "Bordercore" };

export function resolveSection(pathname: string): Section {
  for (const { prefix, section } of ROUTES) {
    if (pathname.startsWith(prefix)) return section;
  }
  return DEFAULT_SECTION;
}
