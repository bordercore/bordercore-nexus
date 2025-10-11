<template>
    <div>
        <div id="modalNewTag" class="modal fade" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 id="myModalLabel" class="modal-title">
                            Pinned Tags
                        </h4>
                        <button type="button" class="close-button btn-close" data-bs-dismiss="modal" />
                    </div>
                    <div class="modal-body">
                        <div class="form-row align-items-center">
                            <div class="form-row mx-1 w-100">
                                <select-value
                                    ref="selectValuePinnedTag"
                                    :search-url="tagSearchUrl + '?doctype=drill&query='"
                                    place-holder="New Tag"
                                    @select="handleTagSelect"
                                />
                            </div>
                        </div>
                        <ul id="drill-pinned-tags" class="interior-borders p-2 mb-0 wide-list">
                            <slick-list
                                v-model:list="tagList"
                                :distance="3"
                                helper-class="slicklist-helper"
                                @sort-end="handleSort"
                            >
                                <slick-item
                                    v-for="(element, index) in tagList"
                                    :key="element.uuid"
                                    :index="index"
                                >
                                    <div class="slicklist-list-item-inner">
                                        <li :key="element.name" class="list-group-item px-2 py-1">
                                            <div class="d-flex">
                                                <div>
                                                    {{ element.name }}
                                                </div>
                                                <div class="ms-auto my-auto">
                                                    <font-awesome-icon icon="times-circle" class="list-delete" @click="handleTagDelete(element.name)" />
                                                </div>
                                            </div>
                                        </li>
                                    </div>
                                </slick-item>
                            </slick-list>
                        </ul>
                    </div>
                    <div class="modal-footer justify-content-start">
                        <input class="btn btn-primary" type="button" value="Save" data-bs-dismiss="modal">
                    </div>
                </div>
            </div>
        </div>
        <card
            id="vue-app-pinned-tags"
            title="Pinned Tags"
            class="backdrop-filter hover-target"
        >
            <template #title-slot>
                <div class="card-title d-flex align-items-center">
                    <div>
                        Pinned Tags
                    </div>
                    <drop-down-menu :show-on-hover="true">
                        <font-awesome-icon icon="ellipsis-v" />
                        <template #dropdown>
                            <li>
                                <a class="dropdown-item" href="#" @click="openModal()">
                                    <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />
                                    Manage
                                </a>
                            </li>
                        </template>
                    </drop-down-menu>
                </div>
            </template>
            <template #content>
                <hr class="divider">
                <div v-if="dataLoading" class="text-secondary">
                    Data Loading...
                </div>
                <ul v-else class="list-unstyled">
                    <li v-for="tag in tagList" :key="tag.name" class="d-flex px-2">
                        <div class="item-name flex-fill">
                            <a :href="tag.url">{{ tag.name }}</a>
                        </div>
                        <div class="item-value">
                            {{ tag.progress }}%
                        </div>
                    </li>
                    <li v-if="!tagList.length">
                        <a href="#" @click="openModal()">Add a tag</a>
                    </li>
                </ul>
            </template>
        </card>
    </div>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";
    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import SelectValue from "/front-end/vue/common/SelectValue.vue";
    import {SlickItem, SlickList} from "vue-slicksort";

    export default {
        components: {
            Card,
            DropDownMenu,
            FontAwesomeIcon,
            SelectValue,
            SlickItem,
            SlickList,
        },
        props: {
            getPinnedTagsUrl: {
                default: "",
                type: String,
            },
            pinTagUrl: {
                default: "",
                type: String,
            },
            unpinTagUrl: {
                default: "",
                type: String,
            },
            sortPinnedTagsUrl: {
                default: "",
                type: String,
            },
            tagSearchUrl: {
                default: "",
                type: String,
            },
        },
        setup(props) {
            const dataLoading = ref(true);
            const selectValuePinnedTag = ref(null);
            const tagList = ref([]);

            function handleSort(event) {
                if (event.oldIndex === event.newIndex) {
                    return;
                }
                const tagName = tagList.value[event.oldIndex].name;

                // The backend expects the ordering to begin
                // with 1, not 0, so add 1.
                const newPosition = event.newIndex + 1;

                doPost(
                    props.sortPinnedTagsUrl,
                    {
                        "tag_name": tagName,
                        "new_position": newPosition,
                    },
                    () => {},
                );
            };

            function getTagList() {
                doGet(
                    props.getPinnedTagsUrl,
                    (response) => {
                        tagList.value = response.data.tag_list;
                        dataLoading.value = false;
                    },
                    "Error getting pinned tags",
                );
            };

            function handleTagAdd(tag) {
                doPost(
                    props.pinTagUrl,
                    {
                        "tag": tag,
                    },
                    () => {
                        getTagList();
                    },
                );
            };

            function handleTagDelete(tagName) {
                doPost(
                    props.unpinTagUrl,
                    {
                        "tag": tagName,
                    },
                    () => {
                        getTagList();
                    },
                );
            };

            function handleTagSelect(selection) {
                handleTagAdd(selection.info.name);

                nextTick(() => {
                    selectValuePinnedTag.value.clearOptions();
                });
            };

            function openModal() {
                const modal = new Modal("#modalNewTag");
                modal.show();
                setTimeout(() => {
                    selectValuePinnedTag.value.focus();
                }, 500);
            };

            onMounted(() => {
                getTagList();
            });

            return {
                dataLoading,
                handleSort,
                handleTagDelete,
                handleTagSelect,
                openModal,
                selectValuePinnedTag,
                tagList,
            };
        },
    };

</script>
