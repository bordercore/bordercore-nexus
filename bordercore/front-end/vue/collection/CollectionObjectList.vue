<template>
    <div class="hover-reveal-target" @mouseover="isHovered = true" @mouseleave="isHovered = false" @dragleave.prevent="handleObjectDragLeave" @dragover.prevent="handleObjectDragOver" @drop.prevent="handleObjectDrop" @dragenter.prevent>
        <card title="" class="backdrop-filter node-color-1 position-relative">
            <template #title-slot>
                <div class="card-title d-flex">
                    <div class="text-truncate">
                        <font-awesome-icon icon="splotch" class="text-primary me-3" />
                        {{ collectionObjectList.name }}
                    </div>
                    <div class="text-secondary text-small text-nowrap ms-3">
                        {{ objectCount }} <span>{{ pluralize("object", objectCount) }}</span>
                    </div>
                    <div class="dropdown-menu-container dropdown-menu-container-width ms-auto">
                        <drop-down-menu class="d-none hover-reveal-object" :show-on-hover="false">
                            <template #dropdown>
                                <li v-if="collectionObjectList.collection_type === 'ad-hoc'">
                                    <a class="dropdown-item" href="#" @click.prevent="openObjectSelectModal">
                                        <span>
                                            <font-awesome-icon icon="plus" class="text-primary me-3" />
                                        </span>
                                        Add Object
                                    </a>
                                </li>
                                <li v-if="collectionObjectList.collection_type !== 'ad-hoc'">
                                    <a class="dropdown-item" :href="collectionDetailUrl" target="_blank">
                                        <span>
                                            <font-awesome-icon icon="external-link-alt" class="text-primary me-3" />
                                        </span>
                                        Collection Detail
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleEditCollectionModal()">
                                        <span>
                                            <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />
                                        </span>
                                        Edit Collection
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleDeleteCollection()">
                                        <span>
                                            <font-awesome-icon icon="times" class="text-primary me-3" />
                                        </span>
                                        <span v-if="collectionObjectList.collection_type === 'ad-hoc'">Delete</span>
                                        <span v-else>
                                            Remove
                                        </span>
                                        Collection
                                    </a>
                                </li>
                            </template>
                        </drop-down-menu>
                    </div>
                </div>
            </template>

            <template #content>
                <hr class="divider">
                <div v-if="collectionObjectList.display === 'individual'" class="drag-target">
                    <img v-if="currentObjectIndex !== null && objectList.length > 0" :src="objectList[currentObjectIndex].cover_url_large" class="mw-100" @click="handleObjectClick()">
                    <span v-else class="text-muted">No objects</span>
                </div>
                <ul v-else class="drag-target list-group list-group-flush interior-borders">
                    <slick-list
                        v-model:list="limitedObjectList"
                        :distance="3"
                        helper-class="slicklist-helper"
                        @sort-end="handleSort"
                    >
                        <slick-item
                            v-for="(element, index) in limitedObjectList"
                            :key="element.uuid"
                            :index="index"
                            class="slicklist-item"
                        >
                            <div class="slicklist-list-item-inner">
                                <li v-cloak :key="element.uuid" class="hover-target list-group-item pe-0" :data-uuid="element.uuid">
                                    <div class="dropdown-height d-flex align-items-start">
                                        <div v-if="element.type === 'blob'" class="pe-2">
                                            <img :src="element.cover_url" height="75" width="70">
                                        </div>
                                        <div v-else class="pe-2" v-html="element.favicon_url" />

                                        <div>
                                            <a :href="element.url">{{ element.name }}</a>
                                            <Transition name="fade" mode="out-in" @after-enter="handleAfterEnterTransition">
                                                <div v-if="!element.noteIsEditable" class="node-object-note" @click="element.noteIsEditable = true" v-html="getNote(element.note)" />
                                                <span v-else>
                                                    <input ref="input" type="text" class="form-control form-control-sm" :value="element.note" placeholder="" @blur="handleEditNote(element, $event.target.value)" @keydown.enter="handleEditNote(element, $event.target.value)">
                                                </span>
                                            </Transition>
                                        </div>

                                        <drop-down-menu :show-on-hover="true">
                                            <template #dropdown>
                                                <li>
                                                    <a class="dropdown-item" href="#" @click.prevent="handleRemoveObject(element.uuid)">
                                                        <font-awesome-icon icon="trash-alt" class="text-primary me-3" />Remove
                                                    </a>
                                                </li>
                                                <li>
                                                    <a class="dropdown-item" href="#" @click.prevent="element.noteIsEditable = true">
                                                        <font-awesome-icon icon="pencil-alt" class="text-primary me-3" /><span v-if="element.note">Edit</span><span v-else>Add</span> Note
                                                    </a>
                                                </li>
                                            </template>
                                        </drop-down-menu>
                                    </div>
                                </li>
                            </div>
                        </slick-item>
                    </slick-list>
                    <div v-if="objectList.length == 0" v-cloak :key="1" class="text-muted">
                        No objects
                    </div>
                </ul>
            </template>
        </card>
    </div>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";
    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import {SlickList, SlickItem} from "vue-slicksort";

    export default {
        name: "CollectionObjectList",
        components: {
            Card,
            DropDownMenu,
            FontAwesomeIcon,
            SlickItem,
            SlickList,
        },
        props: {
            nodeUuid: {
                type: String,
                default: "",
            },
            collectionObjectListInitial: {
                type: Object,
                default: function() {},
            },
            uuid: {
                type: String,
                default: "",
            },
            addNewBookmarkUrl: {
                type: String,
                default: "",
            },
            collectionDetailUrl: {
                type: String,
                default: "",
            },
            editCollectionUrl: {
                type: String,
                default: "",
            },
            getObjectListUrl: {
                type: String,
                default: "",
            },
            editObjectNoteUrl: {
                type: String,
                default: "",
            },
            removeObjectUrl: {
                type: String,
                default: "",
            },
            sortObjectsUrl: {
                type: String,
                default: "",
            },
            deleteCollectionUrl: {
                type: String,
                default: "",
            },
        },
        emits: [
            "open-collection-edit-modal",
            "open-note-image-modal",
            "open-object-select-modal",
            "edit-layout",
        ],
        setup(props, ctx) {
            const collectionObjectList = ref({});
            const currentObjectIndex = ref();
            const objectCount = ref(0);
            const objectList = ref([]);

            const isHovered = ref(false);
            let rotateInterval = null;

            function handleEditNote(object, note) {
                // If the note hasn't changed, abort
                if (note === object.note) {
                    object.noteIsEditable = false;
                    return;
                }

                doPost(
                    props.editObjectNoteUrl,
                    {
                        "collection_uuid": props.uuid,
                        "object_uuid": object.uuid,
                        "note": note,
                    },
                    (response) => {
                        getObjectList();
                    },
                );
            };

            function handleObjectDragLeave(event) {
                event.currentTarget.querySelector(".drag-target").classList.remove("collection-drag-over");
            };

            function handleObjectDragOver(event) {
                event.currentTarget.querySelector(".drag-target").classList.add("collection-drag-over");
            };

            function handleObjectDrop(event) {
                event.currentTarget.querySelector(".drag-target").classList.remove("collection-drag-over");
                const url = event.dataTransfer.getData("URL");
                doPost(
                    props.addNewBookmarkUrl,
                    {
                        "collection_uuid": props.uuid,
                        "url": url,
                    },
                    (response) => {
                        getObjectList();
                    },
                    "Bookmark added",
                );
            };

            function getObjectList() {
                doGet(
                    `${props.getObjectListUrl}?random_order=${collectionObjectList.value.random_order}`,
                    (response) => {
                        objectList.value = response.data.object_list;
                        objectCount.value = response.data.paginator.count;
                        currentObjectIndex.value = 0;
                        if (collectionObjectList.value.rotate !== null && collectionObjectList.value.rotate !== -1) {
                            setTimer();
                        }
                    },
                    "Error getting object list",
                );
            };

            function getNote(note) {
                if (note) {
                    return markdown.render(note);
                }
            };

            function handleDeleteCollection() {
                doPost(
                    props.deleteCollectionUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "collection_uuid": props.uuid,
                        "collection_type": collectionObjectList.value.collection_type,
                    },
                    (response) => {
                        ctx.emit("edit-layout", response.data.layout);
                    },
                    "Collection deleted",
                );
            };

            function handleAfterEnterTransition(evt) {
                const input = evt.querySelector("input");
                if (input) {
                    input.focus();
                }
            };

            function handleRemoveObject(objectUuid) {
                doPost(
                    props.removeObjectUrl,
                    {
                        "collection_uuid": props.uuid,
                        "object_uuid": objectUuid,
                    },
                    (response) => {
                        getObjectList();
                    },
                    "Object removed",
                );
            };

            function handleEditCollection(collectionObjectListParam) {
                doPost(
                    props.editCollectionUrl,
                    {
                        "collection_uuid": props.uuid,
                        "node_uuid": props.nodeUuid,
                        "name": collectionObjectListParam.name,
                        "display": collectionObjectListParam.display,
                        "random_order": collectionObjectListParam.random_order,
                        "rotate": collectionObjectListParam.rotate,
                        "limit": collectionObjectListParam.limit,
                    },
                    (response) => {
                        collectionObjectList.value.name = collectionObjectListParam.name;
                        collectionObjectList.value.display = collectionObjectListParam.display;
                        setTimer();
                    },
                    "Collection edited",
                );
            };

            function handleObjectClick() {
                ctx.emit(
                    "open-note-image-modal",
                    objectList.value[currentObjectIndex.value].cover_url_large,
                );
            };

            function handleSort(event) {
                if (event.oldIndex === event.newIndex) {
                    return;
                }
                const uuid = objectList.value[event.oldIndex].uuid;

                // The backend expects the ordering to begin
                // with 1, not 0, so add 1.
                const newPosition = event.newIndex + 1;

                doPost(
                    props.sortObjectsUrl,
                    {
                        "collection_uuid": props.uuid,
                        "object_uuid": uuid,
                        "new_position": newPosition,
                    },
                    () => {},
                );
            };

            function handleEditCollectionModal() {
                ctx.emit(
                    "open-collection-edit-modal",
                    handleEditCollection,
                    collectionObjectList.value,
                );
            };

            function openObjectSelectModal() {
                ctx.emit(
                    "open-object-select-modal",
                    getObjectList,
                    {"collectionUuid": props.uuid},
                );
            };

            function showNextObject() {
                if (currentObjectIndex.value === objectList.value.length - 1) {
                    currentObjectIndex.value = 0;
                } else {
                    currentObjectIndex.value++;
                }
            };

            function showPreviousObject() {
                if (currentObjectIndex.value === 0) {
                    currentObjectIndex.value = objectList.value.length - 1;
                } else {
                    currentObjectIndex.value--;
                }
            };

            function setTimer() {
                if (!collectionObjectList.value.rotate || collectionObjectList.value.rotate == -1) {
                    return;
                }
                clearInterval(rotateInterval);
                rotateInterval = setInterval( () => {
                    showNextObject();
                }, collectionObjectList.value.rotate * 1000 * 60);
            };

            const limitedObjectList = computed({
                get() {
                    return collectionObjectList.value.limit ? objectList.value.slice(0, collectionObjectList.value.limit) : objectList.value;
                },
                set(newValue) {
                    objectList.value = newValue;
                },
            });

            onMounted(() => {
                collectionObjectList.value = props.collectionObjectListInitial;
                getObjectList();

                hotkeys("left,right", function(event, handler) {
                    if (!isHovered.value) {
                        return;
                    }
                    switch (handler.key) {
                    case "left":
                        showPreviousObject();
                        break;
                    case "right":
                        showNextObject();
                        break;
                    }
                });
            });

            onUnmounted(() => {
                clearInterval(rotateInterval);
            });

            return {
                collectionObjectList,
                currentObjectIndex,
                getNote,
                isHovered,
                limitedObjectList,
                handleAfterEnterTransition,
                handleDeleteCollection,
                handleEditNote,
                handleObjectClick,
                handleObjectDragOver,
                handleObjectDrop,
                handleObjectDragLeave,
                handleRemoveObject,
                handleEditCollection,
                handleEditCollectionModal,
                handleSort,
                objectCount,
                objectList,
                openObjectSelectModal,
                pluralize,
            };
        },
    };

</script>
