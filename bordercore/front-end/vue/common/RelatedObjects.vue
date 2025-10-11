<template>
    <div v-if="objectList.length > 0 || showEmptyList" class="hover-reveal-target mb-3">
        <transition :name="transitionName">
            <card class="position-relative h-100 backdrop-filter z-index-positive">
                <template #title-slot>
                    <div class="d-flex">
                        <div class="card-title d-flex">
                            <font-awesome-icon icon="bookmark" class="text-primary me-3 mt-1" />
                            {{ title }}
                        </div>
                        <div class="dropdown-menu-container ms-auto">
                            <drop-down-menu class="d-none hover-reveal-object" :show-on-hover="false">
                                <template #dropdown>
                                    <li>
                                        <a class="dropdown-item" href="#" @click.prevent="openObjectSelectModal">
                                            <span>
                                                <font-awesome-icon icon="plus" class="text-primary me-3" />
                                            </span>
                                            New Object
                                        </a>
                                    </li>
                                </template>
                            </drop-down-menu>
                        </div>
                    </div>
                </template>

                <template #content>
                    <hr class="divider">
                    <ul class="list-group list-group-flush interior-borders">
                        <slick-list
                            v-model:list="objectList"
                            :distance="3"
                            helper-class="slicklist-helper"
                            @sort-end="handleSort"
                        >
                            <slick-item
                                v-for="(element, index) in objectList"
                                :key="element.uuid"
                                :index="index"
                                class="slicklist-item"
                                :style="'z-index: ' + (1000 - index)"
                            >
                                <div class="slicklist-list-item-inner">
                                    <li v-cloak :key="element.uuid" class="hover-target list-group-item list-group-item-secondary px-0" :data-uuid="element.uuid">
                                        <div class="dropdown-height d-flex align-items-start">
                                            <div class="d-flex flex-column">
                                                <div v-if="element.type === 'bookmark'" class="pe-2">
                                                    <img
                                                        :src="element.cover_url"
                                                        width="120"
                                                        height="67"
                                                        data-bs-toggle="popover"
                                                        :data-bs-html="true"
                                                        data-bs-placement="right"
                                                        data-bs-trigger="hover"
                                                        :data-bs-delay="1000"
                                                        :data-bs-content="`<img src='${element.cover_url_large}' />`"
                                                    >
                                                </div>
                                                <div v-else-if="element.type === 'blob'" class="pe-2">
                                                    <img :src="element.cover_url">
                                                </div>
                                                <div>
                                                    <a :href="element.url">{{ element.name }}</a>
                                                </div>
                                                <Transition name="fade" mode="out-in" @after-enter="handleInputTransition">
                                                    <div v-if="!element.noteIsEditable" class="node-object-note" @click="element.noteIsEditable = true">
                                                        {{ element.note }}
                                                    </div>
                                                    <div v-else>
                                                        <input ref="input" type="text" class="form-control form-control-sm" :value="element.note" placeholder="" autocomplete="off" @blur="handleEditNote(element, $event.target.value)" @keydown.enter="handleEditNote(element, $event.target.value)">
                                                    </div>
                                                </Transition>
                                            </div>
                                            <drop-down-menu :show-on-hover="true">
                                                <template #dropdown>
                                                    <li>
                                                        <a class="dropdown-item" href="#" @click.prevent="handleRemoveObject(element)">
                                                            <font-awesome-icon icon="trash-alt" class="text-primary me-3" />Remove
                                                        </a>
                                                        <a class="dropdown-item" :href="element.edit_url">
                                                            <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />Edit <span>{{ element.type }}</span>
                                                        </a>
                                                        <a class="dropdown-item" href="#" @click.prevent="element.noteIsEditable = true">
                                                            <font-awesome-icon :icon="element.note ? 'pencil-alt' : 'plus'" class="text-primary me-3" />{{ element.note ? 'Edit' : 'New' }} note
                                                        </a>
                                                    </li>
                                                </template>
                                            </drop-down-menu>
                                        </div>
                                    </li>
                                </div>
                            </slick-item>
                        </slick-list>
                        <div v-cloak v-if="objectList.length == 0" :key="1" class="text-muted">
                            No related objects
                        </div>
                    </ul>
                </template>
            </card>
        </transition>
    </div>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";
    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import {SlickList, SlickItem} from "vue-slicksort";

    export default {
        components: {
            Card,
            DropDownMenu,
            FontAwesomeIcon,
            SlickItem,
            SlickList,
        },
        props: {
            objectUuid: {
                default: "",
                type: String,
            },
            title: {
                default: "Related Objects",
                type: String,
            },
            nodeType: {
                default: "blob",
                type: String,
            },
            relatedObjectsUrl: {
                default: "",
                type: String,
            },
            newObjectUrl: {
                default: "",
                type: String,
            },
            removeObjectUrl: {
                default: "",
                type: String,
            },
            sortRelatedObjectsUrl: {
                default: "url",
                type: String,
            },
            editRelatedObjectNoteUrl: {
                default: "url",
                type: String,
            },
            transitionName: {
                default: "fade",
                type: String,
            },
            showEmptyList: {
                default: true,
                type: Boolean,
            },
            isNew: {
                default: false,
                type: Boolean,
            },
        },
        emits: ["open-object-select-modal"],
        setup(props, ctx) {
            const input = ref(null);
            const objectList = ref([]);

            function newObject(bcObject) {
                if (props.isNew) {
                    objectList.value.push(bcObject);
                    return;
                }

                doPost(
                    props.newObjectUrl,
                    {
                        "node_uuid": props.objectUuid,
                        "object_uuid": bcObject.uuid,
                        "node_type": props.nodeType,
                    },
                    (response) => {
                        getRelatedObjects();
                    },
                    "Object added",
                );
            };

            function getRelatedObjects() {
                doGet(
                    props.relatedObjectsUrl.replace(/00000000-0000-0000-0000-000000000000/, props.objectUuid),
                    (response) => {
                        objectList.value = response.data.related_objects;
                        nextTick(() => {
                            const popoverTriggerList = document.querySelectorAll("[data-bs-toggle='popover']");
                            [...popoverTriggerList].map((popoverTriggerEl) => new Popover(popoverTriggerEl));
                        });
                    },
                    "Error getting related objects",
                );
            };

            function handleEditNote(bcObject, note) {
                bcObject.noteIsEditable = false;

                // If the note hasn't changed, abort
                if (note == bcObject.note) {
                    return;
                }

                bcObject.note = note;
                doPost(
                    props.editRelatedObjectNoteUrl,
                    {
                        "node_uuid": props.objectUuid,
                        "object_uuid": bcObject.uuid,
                        "note": note,
                        "node_type": props.nodeType,
                    },
                    (response) => {
                        getRelatedObjects();
                    },
                );
            };

            function handleInputTransition(evt) {
                const input = evt.querySelector("input");
                if (input) {
                    input.focus();
                }
            };

            function handleRemoveObject(bcObject) {
                if (props.isNew) {
                    const newObjectList = objectList.value.filter((x) => x.uuid !== bcObject.uuid);
                    objectList.value = newObjectList;
                    return;
                }

                doPost(
                    props.removeObjectUrl,
                    {
                        "node_uuid": props.objectUuid,
                        "object_uuid": bcObject.uuid,
                        "node_type": props.nodeType,
                    },
                    (response) => {
                        getRelatedObjects();
                    },
                    "Object removed",
                );
            };

            function handleSort(event) {
                if (event.oldIndex === event.newIndex) {
                    return;
                }
                const blobUuid = objectList.value[event.oldIndex].uuid;
                // The backend expects the ordering to begin with 1, not 0, so add 1.
                const newPosition = event.newIndex + 1;

                if (props.isNew) {
                    return;
                }

                doPost(
                    props.sortRelatedObjectsUrl,
                    {
                        "node_uuid": props.objectUuid,
                        "object_uuid": blobUuid,
                        "new_position": newPosition,
                        "node_type": props.nodeType,
                    },
                    () => {},
                );
            };

            function openObjectSelectModal() {
                ctx.emit("open-object-select-modal");
            };

            onMounted(() => {
                if (!props.isNew) {
                    getRelatedObjects();
                }
            });

            return {
                newObject,
                input,
                objectList,
                handleEditNote,
                handleInputTransition,
                handleRemoveObject,
                handleSort,
                openObjectSelectModal,
            };
        },
    };

</script>
