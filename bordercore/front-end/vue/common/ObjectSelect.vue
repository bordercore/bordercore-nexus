<template>
    <div :id="`modalObjectSelect${label}`" class="modal fade" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        {{ title }}
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" />
                </div>
                <div class="modal-body">
                    <div class="d-flex flex-column">
                        <form @submit.prevent>
                            <div>
                                <select-value
                                    id="object-search"
                                    ref="selectValue"
                                    label="name"
                                    name="search"
                                    place-holder="Search"
                                    :search-url="getSearchObjectUrl()"
                                    :bolden-option="true"
                                    @select="handleObjectSelect"
                                >
                                    <template #option="props">
                                        <!-- @click.stop="" handler is needed to prevent the splitter from being selected -->
                                        <div v-if="props.option.splitter"
                                             class="search-splitter"
                                             @click.stop=""
                                        >
                                            {{ props.option.name }}
                                        </div>
                                        <div v-else class="object-select-suggestion d-flex">
                                            <div v-if="props.option.cover_url" class="cover-image">
                                                <img class="mh-100 mw-100" :src="props.option.cover_url">
                                            </div>
                                            <div v-else-if="props.option.doctype === 'Note'" class="cover-image">
                                                <font-awesome-icon icon="sticky-note" class="fa-3x w-100 h-100 text-secondary" />
                                            </div>
                                            <div v-else-if="props.option.doctype === 'Document'" class="cover-image">
                                                <font-awesome-icon icon="fa-copy" class="fa-lg text-primary" />
                                            </div>
                                            <div v-else-if="props.option.doctype === 'Bookmark'" class="cover-image">
                                                <img width="120" height="67" :src="props.option.thumbnail_url">
                                            </div>
                                            <div class="name d-flex flex-column">
                                                <div class="text-truncate ms-2" v-html="boldenOption(props.option.name, props.search)" />
                                                <div class="date ms-2 my-2">
                                                    {{ props.option.date }}
                                                    <span v-if="props.option.important === 10" class="ms-2">
                                                        <font-awesome-icon icon="heart" class="text-danger" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                    <template #afterList="props">
                                        <div v-if="hasMoreThanMax()" slot="misc-item-below" class="object-select-misc-item-below p-2">
                                            <span>
                                                <strong class="me-2">{{ selectValue.multiselect.options.length - maxSuggestions }}</strong> other matches
                                            </span>
                                        </div>
                                    </template>
                                </select-value>
                            </div>
                        </form>
                        <div v-if="hasFilter" class="d-flex mt-2 ms-3">
                            <div>Filter:</div>
                            <div class="d-flex align-items-center ms-2">
                                <o-switch v-model="toggleBookmarks" data-filter-type="bookmarks" @update:modelValue="handleBookmarksToggle" />
                                <label class="ms-2">Bookmarks</label>
                            </div>
                            <div class="d-flex align-items-center ms-3">
                                <o-switch v-model="toggleBlobs" data-filter-type="blobs" @update:modelValue="handleBlobsToggle" />
                                <label class="ms-2">Blobs</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import {boldenOption} from "/front-end/util.js";
    import SelectValue from "/front-end/vue/common/SelectValue.vue";

    export default {
        components: {
            FontAwesomeIcon,
            SelectValue,
        },
        props: {
            hasFilter: {
                type: Boolean,
                default: true,
            },
            initialDoctypes: {
                type: Array,
                default: () => [],
            },
            label: {
                type: String,
                default: "",
            },
            maxSuggestions: {
                type: Number,
                default: 10,
            },
            title: {
                type: String,
                default: "Select Object",
            },
            searchObjectUrl: {
                default: "",
                type: String,
            },
        },
        emits: ["select-object"],
        setup(props, ctx) {
            const selectValue = ref(null);
            const toggleBlobs = ref(false);
            const toggleBookmarks = ref(false);

            let callback = null;
            let doctypes = ["blob", "book", "bookmark", "document", "note"];
            const recentBlobs = JSON.parse(document.getElementById("recent_blobs").textContent);
            const recentBookmarks = JSON.parse(document.getElementById("recent-bookmarks").textContent);
            const recentMedia = JSON.parse(document.getElementById("recent_media").textContent);
            let returnArgs = null;

            function handleBlobsToggle(value) {
                if (value) {
                    if (toggleBookmarks.value) {
                        toggleBookmarks.value = false;
                    }
                    doctypes = ["blob", "book", "document", "note"];
                } else {
                    doctypes = ["blob", "book", "bookmark", "document", "note"];
                }
            };

            function handleBookmarksToggle(value) {
                if (value) {
                    if (toggleBlobs.value) {
                        toggleBlobs.value = false;
                    }
                    doctypes = ["bookmark"];
                } else {
                    doctypes = ["blob", "book", "bookmark", "document", "note"];
                }
            };

            function handleObjectSelect(selection) {
                ctx.emit("select-object", selection, callback, returnArgs);

                const modal = Modal.getInstance(document.getElementById(`modalObjectSelect${props.label}`));
                modal.hide();

                nextTick(() => {
                    selectValue.value.multiselect.$el.querySelector("input").blur();
                    selectValue.value.clearOptions();
                });
            };

            function hasMoreThanMax() {
                if (!selectValue.value || selectValue.value.multiselect.search === "") {
                    // Wait for the component to appear and be sure the user has
                    //  actually searched for something.
                    return false;
                }
                return selectValue.value.multiselect.options.length > props.maxSuggestions;
            };

            function getSearchObjectUrl(query) {
                let url = props.searchObjectUrl;
                url += "?doc_type=" + doctypes.join(",");
                url += "&term=";
                return url;
            };

            function openModal(callbackParam, returnArgsParam) {
                callback = callbackParam;
                returnArgs = returnArgsParam;
                const modal = new Modal(`#modalObjectSelect${props.label}`);
                modal.show();
                setTimeout( () => {
                    selectValue.value.focus();
                }, 500);

                if (selectValue.value.multiselect.options.length === 0) {
                    if (props.initialDoctypes.includes("media")) {
                        selectValue.value.multiselect.options.push(
                            {
                                uuid: "__Recent_Media",
                                name: "Recent Media",
                                splitter: true,
                                value: "",
                            },
                        );
                        selectValue.value.multiselect.options.push(...recentMedia.mediaList.slice(0, 10));
                    } else if (props.initialDoctypes.includes("bookmark")) {
                        selectValue.value.multiselect.options.push(
                            {
                                uuid: "__Recent_Bookmarks",
                                name: "Recent Bookmarks",
                                splitter: true,
                                value: "",
                            },
                        );
                        selectValue.value.multiselect.options.push(...recentBookmarks.bookmarkList.slice(0, 10));
                    } else {
                        selectValue.value.multiselect.options.push(
                            {
                                uuid: "__Recent_Blobs",
                                name: "Recent Blobs",
                                splitter: true,
                                value: "",
                            },
                        );
                        selectValue.value.multiselect.options.push(...recentBlobs.blobList.slice(0, 5));
                        selectValue.value.multiselect.options.push(
                            {
                                uuid: "__Recent_Bookmarks",
                                name: "Recent Bookmarks",
                                splitter: true,
                                value: "",
                            },
                        );
                        selectValue.value.multiselect.options.push(...recentBookmarks.bookmarkList.slice(0, 5));
                    }
                }
            };

            onMounted(() => {
                if (props.initialDoctypes.length > 0) {
                    doctypes = props.initialDoctypes;
                }
            });

            return {
                boldenOption,
                callback,
                doctypes,
                getSearchObjectUrl,
                handleBlobsToggle,
                handleBookmarksToggle,
                hasMoreThanMax,
                handleObjectSelect,
                openModal,
                returnArgs,
                selectValue,
                toggleBookmarks,
                toggleBlobs,
            };
        },
    };

</script>
