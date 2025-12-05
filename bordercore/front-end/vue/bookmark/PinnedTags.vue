<template>
    <div class="card-body backdrop-filter h-100">
        <div class="card-title-large">
            Pinned Tags
        </div>
        <hr class="divider">
        <ul v-cloak class="list-group flex-column w-100">
            <div id="tag-list">
                <VueDraggable
                    v-model="tags"
                    :distance="3"
                    ghost-class="slicklist-helper"
                    :filter="'.no-drag'"
                    @end="handleSort"
                    tag="div"
                >
                    <div
                        v-for="(element, index) in tags"
                        :key="element.uuid"
                        :class="['slicklist-item', { 'no-drag': element.name === 'Untagged' }]"
                    >
                        <div class="slicklist-list-item-inner">
                            <li
                                :key="element.id"
                                class="list-with-counts rounded d-flex ps-2 py-1 pr-1"
                                :class="{ 'selected': element.name === bookmarkStore.selectedTagName }"
                                :data-tag="element.name"
                                :data-id="element.id"
                                @click.prevent="onClickTag"
                                @dragover="onDragOverTag($event)"
                                @dragleave="onDragLeaveTag($event)"
                                @drop="handleNewTagToBookmark($event, element)"
                            >
                                <div class="ps-2 text-truncate">
                                    {{ element.name }}
                                </div>
                                <div v-if="element.bookmark_count" class="ms-auto pe-2">
                                    <span class="px-2 badge rounded-pill">
                                        {{ element.bookmark_count }}
                                    </span>
                                </div>
                            </li>
                        </div>
                    </div>
                </VueDraggable>
            </div>
        </ul>
    </div>
</template>

<script>

    import {useBookmarkStore} from "/front-end/vue/stores/BookmarkStore.js";
    import {VueDraggable} from "vue-draggable-plus";

    export default {
        components: {
            VueDraggable,
        },
        props: {
            addTagUrl: {
                type: String,
                default: "",
            },
            removeTagUrl: {
                type: String,
                default: "",
            },
            sortTagsUrl: {
                type: String,
                default: "",
            },
        },
        emits: ["getPage", "searchTag"],
        setup(props, ctx) {
            const bookmarkStore = useBookmarkStore();
            const tags = ref([]);

            function setTags(tagsParam, untaggedCount) {
                tags.value = tagsParam;
                tags.value.unshift(
                    {
                        id: -1,
                        name: "Untagged",
                        count: untaggedCount,
                    },
                );
            };

            function onClickTag(evt) {
                const tagName = evt.currentTarget.dataset.tag;
                ctx.emit("searchTag", tagName);
            };

            function onDragOverTag(evt) {
                evt.currentTarget.classList.add("hover-tag");
            };

            function onDragLeaveTag(evt) {
                evt.currentTarget.classList.remove("hover-tag");
            };

            function handleNewTagToBookmark(evt, tag) {
                evt.currentTarget.classList.remove("hover-tag");

                // Ignore if we're dragging a bookmark from a tag list
                //  onto the same tag.
                if (tag.name === bookmarkStore.selectedTagName) {
                    return;
                }

                const bookmarkUuid = evt.dataTransfer.getData("application/x-moz-node");

                // Ignore if we're sorting the tag list instead of
                //  dragging a bookmark onto a tag (both events
                //  will trigger this handler). That will be taken
                //  care of in another handler.
                if (!bookmarkUuid) {
                    return;
                }

                if (tag.id === -1) {
                    // We're moving a bookmark from a tagged category to the 'Untagged' category,
                    //  which means we need to remove that tag from the bookmark.
                    doPost(
                        props.removeTagUrl,
                        {
                            "tag_name": bookmarkStore.selectedTagName,
                            "bookmark_uuid": bookmarkUuid,
                        },
                        (response) => {
                            ctx.emit("searchTag", bookmarkStore.selectedTagName);
                        },
                        "",
                        "Error removing tag",
                    );
                } else {
                    doPost(
                        props.addTagUrl,
                        {
                            "tag_id": tag.id,
                            "bookmark_uuid": bookmarkUuid,
                        },
                        (response) => {
                            ctx.emit("getPage", 1);
                        },
                        "",
                        "Error adding tag",
                    );
                }
            };

            function handleSort(event) {
                if (event.oldIndex === event.newIndex) {
                    return;
                }
                if (event.added) {
                    return;
                }
                // v-model has already updated the array, so the dragged item is now at newIndex
                const tagId = tags.value[event.newIndex].id;

                doPost(
                    props.sortTagsUrl,
                    {
                        "tag_id": tagId,
                        "new_position": event.newIndex,
                    },
                    () => {},
                    "",
                    "Error sorting tags",
                );
            };

            return {
                bookmarkStore,
                handleSort,
                onClickTag,
                onDragOverTag,
                onDragLeaveTag,
                handleNewTagToBookmark,
                setTags,
                tags,
            };
        },
    };

</script>
