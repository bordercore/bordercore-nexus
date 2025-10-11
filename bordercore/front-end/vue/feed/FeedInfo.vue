<template>
    <card title="" class="backdrop-filter">
        <template #title-slot>
            <div class="d-flex">
                <h3>Feed Info</h3>
            </div>
            <hr>
        </template>
        <template #content>
            <div>
                <strong>Edited</strong>: {{ feedStore.currentFeed.lastCheck }}
            </div>
            <div>
                <strong>Status</strong>: <font-awesome-icon class="ms-1" :class="status.class" :icon="status.font" />
            </div>
            <div class="mt-3">
                <button class="btn btn-primary" @click="handleNewFeed">
                    New Feed
                </button>
            </div>
        </template>
    </card>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";
    import {useFeedStore} from "/front-end/vue/stores/FeedStore.js";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

    export default {
        components: {
            Card,
            FontAwesomeIcon,
        },
        props: {
            title: {
                default: "Card Title",
                type: String,
            },
        },
        emits: ["new-feed"],
        setup(props, ctx) {
            const feedStore = useFeedStore();
            const status = computed(() => {
                if (feedStore.currentFeed.lastResponse === "OK") {
                    return {
                        "class": "text-success",
                        "font": "check",
                    };
                } else {
                    return {
                        "class": "text-danger",
                        "font": "exclamation-triangle",
                    };
                }
            });

            function handleNewFeed() {
                ctx.emit("new-feed");
            }

            function showFeed(feed) {
                feedStore.currentFeed = feed;
            };

            return {
                feedStore,
                handleNewFeed,
                showFeed,
                status,
            };
        },
    };

</script>
