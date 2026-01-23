import {VueDraggable} from "vue-draggable-plus";
window.VueDraggable = VueDraggable;

import {computed, createApp, h, nextTick, onMounted, onUnmounted, reactive, ref, watch} from "vue";
window.computed = computed;
window.createApp = createApp;
window.h = h;
window.nextTick = nextTick;
window.onMounted = onMounted;
window.onUnmounted = onUnmounted;
window.reactive = reactive;
window.ref = ref;
window.watch = watch;

// Vue composables
import useEvent from "./useEvent.js";
window.useEvent = useEvent;

import mouseRating from "./useMouseRating.js";
window.mouseRating = mouseRating;

// Use the tiny-emitter package as an event bus
import emitter from "tiny-emitter/instance";

const EventBus = {
  $on: (...args) => emitter.on(...args),
  $once: (...args) => emitter.once(...args),
  $off: (...args) => emitter.off(...args),
    $emit: (...args) => emitter.emit(...args),
};
window.EventBus = EventBus;

// Pinia state management
import {createPinia} from "pinia";
window.createPinia = createPinia;
import {useBaseStore} from "./vue/stores/BaseStore.js";
window.useBaseStore = useBaseStore;
import {useBookmarkStore} from "./vue/stores/BookmarkStore.js";
window.useBookmarkStore = useBookmarkStore;
import {useFeedStore} from "./vue/stores/FeedStore.js";
window.useFeedStore = useFeedStore;
import {useExerciseStore} from "./vue/stores/ExerciseStore.js";
window.useExerciseStore = useExerciseStore;

import Sortable from "sortablejs";
window.Sortable = Sortable;

import Datepicker from "vue3-datepicker";
window.Datepicker = Datepicker;

import FloatingVue from "floating-vue";
// Allow the user to hover over the tooltip content
FloatingVue.options.popperTriggers = ["hover"];
window.FloatingVue = FloatingVue;

import pluralize from "pluralize";
window.pluralize = pluralize;

import axios from "axios";
window.axios = axios;
axios.defaults.xsrfCookieName = "csrftoken";
axios.defaults.xsrfHeaderName = "X-CSRFTOKEN";

import "bootstrap";
import {Dropdown, Modal, Popover, Tab} from "bootstrap";
window.Dropdown = Dropdown;
window.Modal = Modal;
window.Popover = Popover;
window.Tab = Tab;

import {library, dom} from "@fortawesome/fontawesome-svg-core";
import {faAlignLeft, faAngleDown, faAngleRight, faAngleUp, faArrowsAltH, faArrowUp, faExchangeAlt, faExternalLinkAlt, faBars, faBook, faBookmark, faBookOpen, faBox, faBriefcase, faCalendarAlt, faCaretUp, faChartBar, faCheck, faChevronLeft, faChevronRight, faChevronUp, faClock, faClone, faComment, faCopy, faDownload, faEllipsisV, faExclamationTriangle, faEye, faFileAlt, faFileImport, faGripHorizontal, faHeart, faHome, faImage, faImages, faInfo, faGraduationCap, faLink, faList, faLock, faMusic, faNewspaper, faObjectGroup, faPencilAlt, faPlus, faQuestion, faQuoteLeft, faRandom, faRunning, faSearch, faSignOutAlt, faSplotch, faSquareRootAlt, faStar, faStickyNote, faTags, faTasks, faThumbtack, faTimes, faTimesCircle, faTrashAlt, faUser} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
import {faAws, faPython} from "@fortawesome/free-brands-svg-icons";
library.add(faAlignLeft, faAngleDown, faAngleRight, faAngleUp, faArrowsAltH, faArrowUp, faAws, faExchangeAlt, faExternalLinkAlt, faBars, faBookmark, faBookOpen, faBook, faBox, faBriefcase, faCalendarAlt, faCaretUp, faChartBar, faCheck, faChevronLeft, faChevronRight, faChevronUp, faClock, faClone, faComment, faCopy, faDownload, faEllipsisV, faExclamationTriangle, faEye, faFileAlt, faFileImport, faGripHorizontal, faHeart, faHome, faImage, faImages, faInfo, faGraduationCap, faLink, faList, faLock, faMusic, faNewspaper, faObjectGroup, faPencilAlt, faPlus, faPython, faQuestion, faQuoteLeft, faRandom, faRunning, faSearch, faSquareRootAlt, faStar, faStickyNote, faTags, faSignOutAlt, faSplotch, faTasks, faThumbtack, faTimes, faTimesCircle, faTrashAlt, faUser);
dom.watch();
window.FontAwesomeIcon = FontAwesomeIcon;

import {format} from "date-fns";
window.format = format;

import {cloneDeep, isEqual} from "lodash";
window.cloneDeep = cloneDeep;
window.isEqual = isEqual;

import hljs from "highlight.js";
const markdown = require("markdown-it")({
    highlight: function(str) {
      try {
          return hljs.highlightAuto(str).value;
      } catch (__) {}

    return "";
    },
});
window.markdown = markdown;
import "highlight.js/styles/dracula.css";

import "media-chrome";

import {v4 as uuidv4} from "uuid";
window.uuidv4 = uuidv4;

import {
    getReasonPhrase,
} from "http-status-codes";
window.getReasonPhrase = getReasonPhrase;

import {doGet, doPost, doPut, getFormattedDate, animateCSS} from "./util.js";
window.doGet = doGet;
window.doPost = doPost;
window.doPut = doPut;
window.getFormattedDate = getFormattedDate;
window.animateCSS = animateCSS;

import {RouterLink} from "vue-router";
window.RouterLink = RouterLink;

import {SidebarMenu} from "vue-sidebar-menu";
import "vue-sidebar-menu/dist/vue-sidebar-menu.css";
window.SidebarMenu = SidebarMenu;

import PerfectScrollbar from "perfect-scrollbar";
window.PerfectScrollbar = PerfectScrollbar;

import {BarController, BarElement, Chart, CategoryScale, LinearScale, Title, Tooltip} from "chart.js";
window.Chart = Chart;
Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Title,
    Tooltip,
);

import Rainbow from "rainbowvis.js";
window.Rainbow = Rainbow;

import Prism from "prismjs";
import {addCopyButton} from "./util.js";
addCopyButton();

import "animate.css";

import hotkeys from "hotkeys-js";

import Oruga from "@oruga-ui/oruga-next";
import "@oruga-ui/oruga-next/dist/oruga-full.css";
import "@oruga-ui/oruga-next/dist/oruga-full-vars.css";
window.Oruga = Oruga;

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
window.sqlite3InitModule = sqlite3InitModule;

// Wait 10 seconds after selecting a song to play
//  for it to be marked as "listened to".
window.MUSIC_LISTEN_TIMEOUT = 10000;

import VueMarkdownEditor from "@kangc/v-md-editor";
import enUS from "@kangc/v-md-editor/lib/lang/en-US";
import "@kangc/v-md-editor/lib/style/base-editor.css";
import vuepressTheme from "@kangc/v-md-editor/lib/theme/vuepress.js";
import "@kangc/v-md-editor/lib/theme/style/vuepress.css";
VueMarkdownEditor.use(vuepressTheme, {
    Prism,
});
VueMarkdownEditor.lang.use("en-US", enUS);
window.VueMarkdownEditor = VueMarkdownEditor;

//
// Custom Vue Components
//

import AddToCollection from "./vue/blob/AddToCollection.vue";
window.AddToCollection = AddToCollection;

import AddWorkoutForm from "./vue/fitness/AddWorkoutForm.vue";
window.AddWorkoutForm = AddWorkoutForm;

import BackReferences from "./vue/common/BackReferences.vue";
window.BackReferences = BackReferences;

import BlobDetailCover from "./vue/blob/BlobDetailCover.vue";
window.BlobDetailCover = BlobDetailCover;

import Card from "./vue/common/Card.vue";
window.Card = Card;

import ChatBot from "./vue/blob/ChatBot.vue";
window.ChatBot = ChatBot;

import CollectionObjectList from "./vue/collection/CollectionObjectList.vue";
window.CollectionObjectList = CollectionObjectList;

import CollectionObjectListModal from "./vue/collection/CollectionObjectListModal.vue";
window.CollectionObjectListModal = CollectionObjectListModal;

import FeedEditorModal from "./vue/feed/FeedEditorModal.vue";
window.FeedEditorModal = FeedEditorModal;

import TodoEditor from "./vue/todo/TodoEditor.vue";
window.TodoEditor = TodoEditor;

import DrillDisabledTags from "./vue/drill/DrillDisabledTags.vue";
window.DrillDisabledTags = DrillDisabledTags;

import DrillPinnedTags from "./vue/drill/DrillPinnedTags.vue";
window.DrillPinnedTags = DrillPinnedTags;

import DrillTagProgress from "./vue/common/DrillTagProgress.vue";
window.DrillTagProgress = DrillTagProgress;

import DropDownMenu from "./vue/common/DropDownMenu.vue";
window.DropDownMenu = DropDownMenu;

import EditableTextArea from "./vue/common/EditableTextArea.vue";
window.EditableTextArea= EditableTextArea;

import FeedInfo from "./vue/feed/FeedInfo.vue";
window.FeedInfo = FeedInfo;

import FeedItemList from "./vue/feed/FeedItemList.vue";
window.FeedItemList = FeedItemList;

import FeedList from "./vue/feed/FeedList.vue";
window.FeedList = FeedList;

import Schedule from "./vue/fitness/Schedule.vue";
window.Schedule = Schedule;

import IconButton from "./vue/common/IconButton.vue";
window.IconButton = IconButton;

import LastWorkout from "./vue/fitness/LastWorkout.vue";
window.LastWorkout = LastWorkout;

import NodeImage from "./vue/node/NodeImage.vue";
window.NodeImage = NodeImage;

import NodeImageModal from "./vue/node/NodeImageModal.vue";
window.NodeImageModal = NodeImageModal;

import NodeQuote from "./vue/node/NodeQuote.vue";
window.NodeQuote = NodeQuote;

import NodeQuoteModal from "./vue/node/NodeQuoteModal.vue";
window.NodeQuoteModal = NodeQuoteModal;

import NodeNode from "./vue/node/NodeNode.vue";
window.NodeNode = NodeNode;

import NodeNote from "./vue/node/NodeNote.vue";
window.NodeNote = NodeNote;

import NodeNodeModal from "./vue/node/NodeNodeModal.vue";
window.NodeNodeModal = NodeNodeModal;

import NodeNoteModal from "./vue/node/NodeNoteModal.vue";
window.NodeNoteModal = NodeNoteModal;

import NodeTodoList from "./vue/node/NodeTodoList.vue";
window.NodeTodoList = NodeTodoList;

import ObjectSelect from "./vue/common/ObjectSelect.vue";
window.ObjectSelect = ObjectSelect;

import OverdueTasks from "./vue/todo/OverdueTasks.vue";
window.OverdueTasks = OverdueTasks;

import Pagination from "./vue/common/Pagination.vue";
window.Pagination = Pagination;

import PinnedTags from "./vue/bookmark/PinnedTags.vue";
window.PinnedTags = PinnedTags;

import PythonConsole from "./vue/common/PythonConsole.vue";
window.PythonConsole = PythonConsole;

import RecentBlobs from "./vue/blob/RecentBlobs.vue";
window.RecentBlobs = RecentBlobs;

import RelatedObjects from "./vue/common/RelatedObjects.vue";
window.RelatedObjects = RelatedObjects;

import RelatedTags from "./vue/common/RelatedTags.vue";
window.RelatedTags = RelatedTags;

import SearchNoResult from "./vue/common/SearchNoResult.vue";
window.SearchNoResult = SearchNoResult;

import SelectValue from "./vue/common/SelectValue.vue";
import "vue-multiselect/dist/vue-multiselect.css";
window.SelectValue = SelectValue;

import TopSearch from "./vue/search/TopSearch.vue";
window.TopSearch = TopSearch;

import TagsInput from "./vue/common/TagsInput.vue";
window.TagsInput = TagsInput;

import Toast from "./vue/common/Toast.vue";
window.Toast = Toast;

import TreeMenu from "./vue/common/TreeMenu.vue";
window.TreeMenu = TreeMenu;

import Weather from "./vue/common/Weather.vue";
window.Weather = Weather;

import WorkoutGraph from "./vue/fitness/WorkoutGraph.vue";
window.WorkoutGraph = WorkoutGraph;
