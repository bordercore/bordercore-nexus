<template>
    <ul>
        <VueDraggable
            v-model="localFeedList"
            :distance="3"
            ghost-class="slicklist-helper"
            @end="handleSort"
            tag="div"
        >
            <div
                v-for="(element, index) in localFeedList"
                :key="element.uuid"
                class="slicklist-item"
            >
                <div class="slicklist-list-item-inner">
                    <li v-cloak :key="element.id" :class="{'selected rounded-sm': element.id === feedStore.currentFeed.id}" class="ps-2">
                        <a href="#" :data-id="element.id" @click.prevent="onClick(element)">
                            {{ element.name }}
                        </a>
                        <small v-if="element.lastResponse !== 'OK'" class="text-danger ms-2">{{ element.lastResponse }}</small>
                    </li>
                </div>
            </div>
        </VueDraggable>
        <div v-if="feedList.length === 0" v-cloak class="text-secondary">
            No feeds found. <a href="#" @click.prevent="handleEditFeed('Edit')">Add a new one here.</a>
        </div>
    </ul>
</template>

<script>

    import {useFeedStore} from "/front-end/vue/stores/FeedStore.js";
    import {VueDraggable} from "vue-draggable-plus";

    export default {
        components: {
            VueDraggable,
        },
        props: {
            feedList: {
                default: () => [],
                type: Array,
            },
            feedSortUrl: {
                default: "",
                type: String,
            },
            storeInSessionUrl: {
                default: "",
                type: String,
            },
        },
        emits: ["show-feed"],
        setup(props, ctx) {
            const feedStore = useFeedStore();
            const localFeedList = ref(props.feedList.slice());

            function deleteFeed(feedUuid) {
                for (let i = 0; i < localFeedList.value.length; i++) {
                    if (localFeedList.value[i].uuid == feedUuid) {
                        localFeedList.value.splice(i, 1);
                    }
                }

                // Now that the current feed is deleted, we need to select a
                //  different current feed. Select the first in the list.
                feedStore.currentFeed = localFeedList.value[0];
            };

            function addFeed(feedInfo) {
                localFeedList.value.unshift(feedInfo);
            };

            function handleSort(event) {
                if (event.oldIndex === event.newIndex) {
                    return;
                }
                // v-model has already updated the array, so the dragged item is now at newIndex
                const feedId = localFeedList.value[event.newIndex].id;

                // The backend expects the ordering to begin with 1, not 0, so add 1.
                const newPosition = event.newIndex + 1;

                doPost(
                    props.feedSortUrl,
                    {
                        "feed_id": feedId,
                        "position": newPosition,
                    },
                    () => {},
                );
            }

            function onClick(feed) {
                ctx.emit("show-feed", feed);

                doPost(
                    props.storeInSessionUrl,
                    {
                        "current_feed": feed.id,
                    },
                    (response) => {},
                );
            }

            return {
                addFeed,
                deleteFeed,
                feedStore,
                handleSort,
                localFeedList,
                onClick,
            };
        },
    };

</script>
