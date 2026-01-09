<template>
    <Transition name="fade">
        <div v-show="showSearchWindow" id="top-search">
            <form class="form-inline" method="get">
                <input type="hidden" name="doctype" :value="searchFilter">
                <div class="form-row">
                    <div class="me-1">
                        <select-value
                            id="topSearchValue"
                            ref="selectValue"
                            label="name"
                            place-holder="Search"
                            :search-url="searchUrl"
                            @keydown="onKeyDown"
                            @search="handleSearch"
                            @search-change="onSearchChange"
                            @select="handleSelectOption"
                        >
                            <template #option="props">
                                <!-- @click.stop="" handlers are needed to prevent the splitter from being selected -->
                                <span v-if="props.option.splitter"
                                      class="search-splitter"
                                      @click.stop=""
                                >
                                    {{ props.option.name }}
                                </span>
                                <div v-else class="search-suggestion">
                                    <span v-if="props.option.important === 10" class="me-1">
                                        <font-awesome-icon icon="heart" class="text-danger" />
                                    </span>
                                    <span v-if="props.option.doctype">
                                        <em class="top-search-object-type">{{ props.option.doctype }}</em> -
                                    </span>
                                    <span class="d-inline" v-html="boldenOption(props.option.name, props.search)" />
                                </div>
                            </template>
                        </select-value>
                        <div v-if="searchFilter" id="top-search-filter" class="tag label label-info d-flex align-items-center">
                            <div>{{ getFilterName(searchFilter) }}</div>
                            <div>
                                <a class="ms-1" href="#" @click.prevent="removeFilter()">
                                    <font-awesome-icon icon="times" class="text-primary" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
            <div v-if="showFilter" id="top-search-filter-options" class="ms-3 mt-2 p-2">
                <div class="search-splitter">
                    Filter Options
                </div>
                <div class="d-flex flex-column">
                    <div v-for="filter in searchFilterTypes" :key="filter.icon" class="search-suggestion d-flex" :class="{'selected rounded-sm': filter.doctype === searchFilter}" @click.prevent="handleFilter(filter.doctype)">
                        <div class="top-search-filter-icon d-flex justify-content-center align-items-center">
                            <font-awesome-icon class="me-2" :icon="filter.icon" />
                        </div>
                        <div>
                            {{ filter.name }}
                        </div>
                    </div>
                </div>
                <div class="search-splitter">
                    Recent Searches
                </div>
                <div class="d-flex flex-column">
                    <div v-for="recentSearch in recentSearches" :key="recentSearch.id" class="search-suggestion d-flex" @click.prevent="handleRecentSearch(recentSearch)">
                        <div class="top-search-filter-icon d-flex justify-content-center align-items-center">
                            <font-awesome-icon class="me-2" icon="magnifying-glass" />
                        </div>
                        <div class="text-truncate">
                            {{ recentSearch.search_text }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<script>

    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import {boldenOption} from "/front-end/util.js";
    import SelectValue from "../common/SelectValue.vue";
    import useEvent from "/front-end/useEvent.js";

    export default {
        components: {
            FontAwesomeIcon,
            SelectValue,
        },
        props: {
            initialSearchFilter: {
                type: String,
                default: "",
            },
            initialSearchUrl: {
                type: String,
                default: "",
            },
            querySearchUrl: {
                type: String,
                default: "",
            },
            noteQuerySearchUrl: {
                type: String,
                default: "",
            },
            drillQuerySearchUrl: {
                type: String,
                default: "",
            },
            storeInSessionUrl: {
                type: String,
                default: "",
            },
            recentSearches: {
                type: Array,
                default: () => [],
            },
        },
        setup(props) {
            const showFilter = ref(true);
            const showSearchWindow = ref(false);
            const searchFilter = ref(props.initialSearchFilter);
            const selectValue = ref(null);

            const searchUrl = computed(() => {
                return `${props.initialSearchUrl}?doc_type=${searchFilter.value}&term=`;
            });

            const searchFilterTypes = ref([
                {
                    "name": "Books",
                    "icon": "book",
                    "doctype": "book",
                },
                {
                    "name": "Bookmarks",
                    "icon": "bookmark",
                    "doctype": "bookmark",
                },
                {
                    "name": "Notes",
                    "icon": "sticky-note",
                    "doctype": "note",
                },
                {
                    "name": "Music",
                    "icon": "music",
                    "doctype": "music",
                },
                {
                    "name": "Drill Questions",
                    "icon": "graduation-cap",
                    "doctype": "drill",
                },
            ]);

            useEvent("click", handleClick, {});
            useEvent("keydown", handleKeyDown, {});

            function focusSearch() {
                selectValue.value.focus();
            }

            function openSearchWindow() {
                showSearchWindow.value = true;
                setTimeout(() => {
                    focusSearch();
                }, 100);
            }

            function getFilterName(doctype) {
                const filter = searchFilterTypes.value.filter((x) => {
                    return x.doctype === doctype;
                });
                return filter.length > 0 ? filter[0].name : "";
            };

            function handleKeyDown(event) {
                if (event.key === "s" && event.altKey) {
                    showSearchWindow.value = true;
                    setTimeout(() => {
                        focusSearch();
                    }, 200);
                }
            };

            function handleFilter(filter) {
                searchFilter.value = searchFilter.value === filter ? "" : filter;
                saveSearchFilter(searchFilter);
            }

            function handleRecentSearch(searchTerm) {
                window.location=props.querySearchUrl + "?search=" + searchTerm.search_text;
            };

            // If a click was detected outside this component, *and*
            //  the click wasn't on the "Search icon", *and* the click
            //  wasn't on the filter close button, then hide the component.
            function handleClick(event) {
                const specifiedElement = document.getElementById("top-search");
                if (!specifiedElement) {
                    return;
                }
                const isClickInside = specifiedElement.contains(event.target) || specifiedElement.contains(event.target.parentElement);
                const topSearchIcon = document.getElementById("top-search-icon");
                const isClickOnSearchIcon = topSearchIcon && (topSearchIcon.contains(event.target) || topSearchIcon.contains(event.target.parentElement));
                if (!isClickInside &&
                    !isClickOnSearchIcon &&
                    !event.target.classList.contains("fa-times") &&
                    !event.target.parentElement.classList.contains("fa-times")
                ) {
                    showSearchWindow.value = false;
                }
            };

            function onKeyDown(evt) {
                if (evt.code === "KeyN" && evt.altKey) {
                    handleFilter("note");
                } else if (evt.code === "KeyL" && evt.altKey) {
                    handleFilter("bookmark");
                } else if (evt.code === "KeyB" && evt.altKey) {
                    handleFilter("book");
                } else if (evt.code === "KeyM" && evt.altKey) {
                    handleFilter("music");
                    // Hack to prevent Chrome on OS X from submitting the form.
                    // I have no idea why this happens.
                    evt.preventDefault();
                } else if (evt.code === "KeyD" && evt.altKey) {
                    handleFilter("drill");
                } else if (evt.key === "a" && evt.altKey) {
                    document.getElementById("top-simple-suggest").select();
                } else if (evt.code === "Escape") {
                    showSearchWindow.value = false;
                }
            };

            function onSearchChange(query) {
                showFilter.value = query === "";
            };

            function removeFilter() {
                searchFilter.value = "";
                handleFilter("");
            };

            function saveSearchFilter(searchFilter) {
                doPost(
                    props.storeInSessionUrl,
                    {
                        "top_search_filter": searchFilter.value,
                    }
                    ,
                    (response) => {},
                );
            }

            function handleSelectOption(selection) {
                if (selection.link) {
                    window.location = selection.link;
                }
            };

            function handleSearch(selection) {
                const form = document.querySelector("#top-search form");
                document.getElementById("topSearchValue").value = selectValue.value.multiselect.search;
                if (searchFilter.value === "note") {
                    form.action = props.noteQuerySearchUrl;
                } else if (searchFilter.value === "drill") {
                    form.action = props.drillQuerySearchUrl;
                } else {
                    form.action = props.querySearchUrl;
                    // The main search page is expecting the form field name to be
                    //  "term_search", so we need to change it before form submission.
                    for (let i = 0; i < form.elements.length; i++) {
                        const element = form.elements[i];
                        if (element.name == "search") {
                            element.name = "term_search";
                            break;
                        }
                    }
                }
                form.submit();
            };

            return {
                searchUrl,
                boldenOption,
                focusSearch,
                getFilterName,
                handleFilter,
                handleRecentSearch,
                handleSearch,
                handleSelectOption,
                onKeyDown,
                onSearchChange,
                openSearchWindow,
                removeFilter,
                saveSearchFilter,
                searchFilterTypes,
                selectValue,
                showFilter,
                showSearchWindow,
                searchFilter,
            };
        },
    };

</script>
