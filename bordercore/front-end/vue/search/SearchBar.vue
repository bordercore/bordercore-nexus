<template>
    <div class="card-body mb-3 pb-4">
        <form :action="termSearchUrl" method="get" autocomplete="off">
            <div class="d-flex">
                <div class="d-flex flex-column">
                    <div class="mb-1 text-nowrap">
                        Term Search
                    </div>
                    <div class="col-auto has-search position-relative px-0">
                        <font-awesome-icon icon="magnifying-glass" />
                        <input id="search-bar" ref="searchInput" v-model="searchTerm" name="term_search" placeholder="Search" class="default-input form-control">
                    </div>
                </div>
                <div class="d-flex w-100">
                    <div class="d-flex flex-column w-20 ms-3 me-3">
                        <div class="mb-1">
                            Type
                        </div>
                        <select name="boolean_search_type" class="form-control">
                            <option selected="selected">
                                AND
                            </option>
                            <option>
                                OR
                            </option>
                        </select>
                    </div>
                    <div class="d-flex flex-column w-20 me-3">
                        <div class="mb-1">
                            Exact Match
                        </div>
                        <select v-model="exactMatch" name="exact_match" class="form-control">
                            <option>
                                No
                            </option>
                            <option>
                                Yes
                            </option>
                        </select>
                    </div>
                    <div class="d-flex flex-column w-20 me-3">
                        <div class="mb-1">
                            Sort By
                        </div>
                        <select id="search-sort-by" v-model="sortBy" name="sort" class="form-control">
                            <option value="_score">
                                Rank
                            </option>
                            <option value="date_unixtime">
                                Date
                            </option>
                        </select>
                    </div>
                    <div class="d-flex flex-column w-20 me-1">
                        <div class="mb-1">
                            &nbsp;
                        </div>
                        <input class="search-input btn btn-primary" type="submit" value="Search" :disabled="termSearchDisabled">
                    </div>
                </div>
            </div>
        </form>
        <hr>
        <form>
            <div class="d-flex">
                <div>
                    <div class="mb-1">
                        Tag Search
                    </div>
                    <tags-input
                        ref="tagsInput"
                        name="tag-search"
                        class-list="tag-search me-3 position-relative"
                        place-holder="Tag"
                        :search-url="tagSearchUrl"
                        :search-icon="true"
                        tags-changed-url="tagSearchUrl"
                        @tags-changed="handleTagSearch"
                    />
                </div>
                <div v-if="tagCounts.length > 0" class="me-3">
                    <div class="mb-1">
                        Related Tags
                    </div>
                    <select class="form-control form-select" @change="handleRelatedTagsChange">
                        <option value="-1">
                            Choose
                        </option>
                        <option v-for="tag in tagCounts" :key="tag[0]" :value="tag[0]">
                            {{ tag[0] }} ({{ tag[1] }})
                        </option>
                    </select>
                </div>
                <div class="d-flex flex-column w-20 me-1">
                    <div class="mb-1">
                        &nbsp;
                    </div>
                    <input class="search-input btn btn-primary" type="submit" name="Go" value="Search" :disabled="tagSearchDisabled">
                </div>
            </div>
        </form>
        <hr>
        <form :action="semanticSearchUrl" method="get" autocomplete="off">
            <div class="d-flex">
                <div class="tag-search me-3">
                    <div class="mb-1">
                        Semantic Search
                    </div>
                    <div class="semantic-search col-auto has-search position-relative px-0">
                        <font-awesome-icon icon="magnifying-glass" />
                        <input v-model="searchSemantic" name="semantic_search" placeholder="Search" class="default-input form-control">
                    </div>
                </div>
                <div class="d-flex flex-column w-20 me-3">
                    <div class="mb-1">
                        &nbsp;
                    </div>
                    <input class="search-input btn btn-primary" type="submit" value="Search" :disabled="semanticSearchDisabled">
                </div>
            </div>
        </form>
    </div>
</template>

<script>

    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import TagsInput from "/front-end/vue/common/TagsInput.vue";

    export default {
        components: {
            FontAwesomeIcon,
            TagsInput,
        },
        props: {
            exactMatchInitial: {
                type: String,
                default: "No",
            },
            searchSemanticInitial: {
                type: String,
                default: "",
            },
            searchTermInitial: {
                type: String,
                default: "",
            },
            sortByInitial: {
                type: String,
                default: "_score",
            },
            tagCounts: {
                type: Array,
                default: () => [],
            },
            tagsChangedUrl: {
                type: String,
                default: "",
            },
            tagSearchUrl: {
                type: String,
                default: "",
            },
            termSearchUrl: {
                type: String,
                default: "",
            },
            semanticSearchUrl: {
                type: String,
                default: "",
            },
        },
        setup(props) {
            const searchSemantic = ref(props.searchSemanticInitial || "");
            const searchTerm = ref(props.searchTermInitial || "");
            const exactMatch = ref(props.exactMatchInitial || "No");
            const sortBy = ref(props.sortByInitial || "_score");
            const searchInput = ref(null);
            const tagsInput = ref(null);

            function focusTagSearch() {
                tagsInput.value.focus();
            };

            function focusTermSearch() {
                searchInput.value.focus();
            };

            function handleRelatedTagsChange(evt) {
                const tagList = JSON.parse(document.getElementById("initial-tags").textContent);
                tagList.push(evt.srcElement.value);
                handleTagSearch(tagList);
            };

            function handleTagSearch(tagList) {
                window.location = props.tagsChangedUrl.replace("666", tagList.join(",")).replace("//", "/");
            };

            const semanticSearchDisabled = computed(() => {
                return searchSemantic.value === "";
            });

            const tagSearchDisabled = computed(() => {
                return tagsInput.value && tagsInput.value.value.length === 0;
            });

            const termSearchDisabled = computed(() => {
                return searchTerm.value === "";
            });

            return {
                exactMatch,
                focusTagSearch,
                focusTermSearch,
                handleRelatedTagsChange,
                handleTagSearch,
                searchInput,
                searchSemantic,
                searchTerm,
                semanticSearchDisabled,
                sortBy,
                tagsInput,
                tagSearchDisabled,
                termSearchDisabled,
            };
        },
    };

</script>
