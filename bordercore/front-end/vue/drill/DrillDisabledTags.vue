<template>
    <div class="d-flex h-100">
        <div id="modalDisabledTags" class="modal fade" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 id="myModalLabel" class="modal-title">
                            Disabled Tags
                        </h4>
                        <button type="button" class="close-button btn-close" data-bs-dismiss="modal" />
                    </div>
                    <div class="modal-body">
                        <div class="form-row align-items-center">
                            <div class="form-row mx-1 w-100">
                                <select-value
                                    ref="selectValuePinnedTag"
                                    :search-url="tagSearchUrl + '?doctype=drill&query='"
                                    place-holder="Search Tag"
                                    @select="handleTagSelect"
                                />
                            </div>
                        </div>
                        <ul id="drill-pinned-tags" class="interior-borders p-2 mb-0 wide-list">
                            <div class="slicklist-list-item-inner">
                                <li v-for="tag in tagList" :key="tag.name" class="list-group-item px-2 py-1">
                                    <div class="d-flex">
                                        <div>
                                            {{ tag.name }}
                                        </div>
                                        <div class="ms-auto my-auto">
                                            <font-awesome-icon icon="times-circle" class="list-delete" @click="handleTagEnable(tag.name)" />
                                        </div>
                                    </div>
                                </li>
                            </div>
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
            title="Disabled Tags"
            class="backdrop-filter hover-target flex-grow-1"
        >
            <template #title-slot>
                <div class="card-title d-flex align-items-center">
                    <div>
                        Disabled Tags
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
                            <a :href="tag.url + '?filter=review'">{{ tag.name }}</a>
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

    export default {
        components: {
            Card,
            DropDownMenu,
            FontAwesomeIcon,
            SelectValue,
        },
        props: {
            getDisabledTagsUrl: {
                default: "",
                type: String,
            },
            disableTagUrl: {
                default: "",
                type: String,
            },
            enableTagUrl: {
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

            function getTagList() {
                doGet(
                    props.getDisabledTagsUrl,
                    (response) => {
                        tagList.value = response.data.tag_list;
                        dataLoading.value = false;
                    },
                    "Error getting disabled tags",
                );
            };

            function handleTagDisable(tag) {
                doPost(
                    props.disableTagUrl,
                    {
                        "tag": tag,
                    },
                    () => {
                        getTagList();
                    },
                );
            };

            function handleTagEnable(tagName) {
                doPost(
                    props.enableTagUrl,
                    {
                        "tag": tagName,
                    },
                    () => {
                        getTagList();
                    },
                );
            };

            function handleTagSelect(selection) {
                handleTagDisable(selection.info.name);

                nextTick(() => {
                    selectValuePinnedTag.value.clearOptions();
                });
            };

            function openModal() {
                const modal = new Modal("#modalDisabledTags");
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
                handleTagEnable,
                handleTagSelect,
                openModal,
                selectValuePinnedTag,
                tagList,
            };
        },
    };

</script>
