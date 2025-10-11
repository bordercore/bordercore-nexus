<template>
    <div class="card-body backdrop-filter h-100 me-2">
        <div class="d-flex">
            <h3 v-cloak id="feed-title">
                <a :href="feedStore.currentFeed.homepage">{{ feedStore.currentFeed.name }}</a>
            </h3>
            <drop-down-menu ref="dropDownMenu" :links="feedDetailMenuItems" />
        </div>
        <hr>
        <ul>
            <li v-for="url in feedStore.currentFeed.feedItems" v-cloak :key="url.id">
                <a :href="url.link">{{ url.title }}</a>
            </li>
            <div v-if="feedStore.currentFeed.feedItems?.length == 0">
                No feed items found.
            </div>
        </ul>
    </div>
</template>

<script>

    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import {useFeedStore} from "/front-end/vue/stores/FeedStore.js";

    export default {
        components: {
            DropDownMenu,
        },
        emits: ["open-modal"],
        setup(props, ctx) {
            const feedStore = useFeedStore();

            const feedDetailMenuItems = [
                {
                    id: uuidv4(),
                    title: "Edit Feed",
                    url: "#",
                    clickHandler: handleEditFeed,
                    icon: "pencil-alt",
                },
                {
                    id: uuidv4(),
                    title: "Delete Feed",
                    url: "#",
                    clickHandler: handleDeleteFeed,
                    icon: "times",
                },
            ];

            function handleEditFeed(evt, action = "Edit") {
                if (action === "Edit") {
                    ctx.emit("open-modal", action, feedStore.currentFeed);
                } else {
                    ctx.emit("open-modal", action, {});
                }
            }

            function handleDeleteFeed() {
                const modal = new Modal("#modalDeleteFeed");
                modal.show();
            }

            function showFeed(feed) {
                feedStore.currentFeed = feed;
            };

            return {
                feedDetailMenuItems,
                feedStore,
                handleEditFeed,
                handleDeleteFeed,
                showFeed,
            };
        },
    };

</script>
