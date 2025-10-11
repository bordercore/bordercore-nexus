<template>
    <div class="hover-target">
        <card class="backdrop-filter node-color-1">
            <template #title-slot>
                <div class="dropdown-height d-flex">
                    <div v-cloak class="card-title d-flex">
                        <div class="text-truncate">
                            <font-awesome-icon icon="box" class="text-primary me-3" />
                            <span v-if="nodeInfo"><a :href="nodeDetailUrl">{{ nodeInfo.name }}</a></span>
                        </div>
                    </div>
                    <div class="dropdown-menu-container ms-auto">
                        <drop-down-menu :show-on-hover="true">
                            <template #dropdown>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleOpenNodeModal">
                                        <span>
                                            <font-awesome-icon icon="external-link-alt" class="text-primary me-3" />
                                        </span>
                                        Edit Node
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleRemoveNode">
                                        <span>
                                            <font-awesome-icon icon="external-link-alt" class="text-primary me-3" />
                                        </span>
                                        Remove Node
                                    </a>
                                </li>
                            </template>
                        </drop-down-menu>
                    </div>
                </div>
            </template>
            <template #content>
                <div class="d-flex">
                    <div v-for="image in nodeInfo.images" :key="image.uuid" class="w-50 me-2">
                        <a :href="image.blob_url" target="_blank">
                            <img :src="image.cover_url" class="mw-100">
                        </a>
                    </div>
                </div>
                <div id="node-node-misc">
                    <div v-if="nodeInfo.note_count" :key="nodeInfo.random_note" class="text-truncate">
                        <div class="d-flex">
                            <div class="text-nowrap">
                                <strong>{{ nodeInfo.note_count }}</strong> {{ pluralize("note", nodeInfo.note_count) }}
                            </div>
                            <div class="text-truncate text-info ms-2">
                                {{ nodeInfo.random_note.name }}
                            </div>
                        </div>
                    </div>
                    <div v-if="nodeInfo.todo_count" :key="nodeInfo.random_todo">
                        <div class="d-flex">
                            <div class="text-nowrap">
                                <strong>{{ nodeInfo.todo_count }}</strong> {{ pluralize("todo", nodeInfo.todo_count) }}
                            </div>
                            <div class="text-truncate text-info ms-2">
                                {{ nodeInfo.random_todo.name }}
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </card>
    </div>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";
    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

    export default {
        components: {
            Card,
            DropDownMenu,
            FontAwesomeIcon,
        },
        props: {
            uuid: {
                type: String,
                default: "",
            },
            parentNodeUuid: {
                type: String,
                default: "",
            },
            nodeOptionsInitial: {
                type: Object,
                default: function() {},
            },
            getNodeInfoUrl: {
                type: String,
                default: "",
            },
            nodeDetailUrl: {
                type: String,
                default: "",
            },
            removeComponentUrl: {
                type: String,
                default: "",
            },
            editNodeUrl: {
                type: String,
                default: "",
            },
        },
        emits: ["open-node-modal", "edit-layout"],
        setup(props, ctx) {
            const nodeInfo = ref({"images": []});
            const nodeOptions = ref(props.nodeOptionsInitial);
            let rotateInterval = null;
            let rotateIntervalNotes = null;

            function adjustNodeMiscHeight() {
                // Adjust the height based on whether there are zero, one, or two lines of
                //  misc information. Explicity setting the height prevents screen shift
                //  from the transition effect.
                const div = document.querySelector("#node-node-misc");
                div.classList.remove("node-node-misc-one-line", "node-node-misc-two-lines");
                if (nodeInfo.value.note_count > 0 && nodeInfo.value.todo_count > 0) {
                    div.classList.add("node-node-misc-two-lines");
                } else if (nodeInfo.value.note_count > 0 || nodeInfo.value.todo_count > 0) {
                    div.classList.add("node-node-misc-one-line");
                }
            };

            function getNodeInfo(notesOnly=false) {
                doGet(
                    props.getNodeInfoUrl + `?notesOnly=${notesOnly}`,
                    (response) => {
                        if (notesOnly) {
                            nodeInfo.value.random_note = response.data.info.random_note;
                            nodeInfo.value.random_todo = response.data.info.random_todo;
                        } else {
                            nodeInfo.value = response.data.info;
                        }
                        adjustNodeMiscHeight();
                    },
                    "Error getting node info",
                );
            };

            function handleRemoveNode() {
                doPost(
                    props.removeComponentUrl,
                    {
                        "node_uuid": props.parentNodeUuid,
                        "uuid": props.uuid,
                    },
                    (response) => {
                        ctx.emit("edit-layout", response.data.layout);
                    },
                    "Node removed",
                );
            };

            function handleOpenNodeModal() {
                ctx.emit("open-node-modal", editNode, nodeOptions.value);
            };

            function setTimer() {
                if (nodeOptions.value.rotate && nodeOptions.value.rotate !== -1) {
                    clearInterval(rotateInterval);
                    rotateInterval = setInterval( () => {
                        getNodeInfo();
                    }, nodeOptions.value.rotate * 1000 * 60);
                }
                // Create a separate timer for notes and todos
                clearInterval(rotateIntervalNotes);
                rotateIntervalNotes = setInterval( () => {
                    getNodeInfo(true);
                }, 1000 * 60);
            };

            function editNode(options) {
                doPost(
                    props.editNodeUrl,
                    {
                        "parent_node_uuid": props.parentNodeUuid,
                        "uuid": props.uuid,
                        "options": JSON.stringify(options),
                    },
                    (response) => {
                        nodeOptions.value = options;
                        setTimer();
                        ctx.emit("edit-layout", response.data.layout);
                    },
                    "Node edited",
                );
            };

            onMounted(() => {
                getNodeInfo();
                setTimer();
            });

            onUnmounted(() => {
                clearInterval(rotateInterval);
                clearInterval(rotateIntervalNotes);
            });

            return {
                handleOpenNodeModal,
                handleRemoveNode,
                nodeInfo,
                pluralize,
            };
        },
    };

</script>
