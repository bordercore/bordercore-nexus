<template>
    <div class="hover-target">
        <card class="backdrop-filter" :class="cardClass">
            <template #title-slot>
                <div v-cloak class="card-title d-flex">
                    <div class="dropdown-height d-flex">
                        <div>
                            <font-awesome-icon icon="sticky-note" class="text-primary me-3" />
                        </div>
                        <div class="w-100">
                            <input v-if="isEditingName" v-model="nodeNote.name" class="form-control w-100" @blur="handleNameEdit" @keydown.enter="handleNameEdit">
                            <span v-else-if="note" @dblclick="handleNameEdit">
                                {{ nodeNote.name }}
                            </span>
                        </div>
                    </div>
                    <div v-if="note !== ''" class="dropdown-menu-container ms-auto">
                        <drop-down-menu :show-on-hover="true">
                            <template #dropdown>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleNoteEdit()">
                                        <span>
                                            <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />
                                        </span>
                                        Edit note
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="onOpenNoteMetadataModal()">
                                        <span>
                                            <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />
                                        </span>
                                        Edit note metadata
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleNoteDelete()">
                                        <span>
                                            <font-awesome-icon icon="times" class="text-primary me-3" />
                                        </span>
                                        Delete note
                                    </a>
                                </li>
                            </template>
                        </drop-down-menu>
                    </div>
                </div>
            </template>
            <template #content>
                <hr class="divider">
                <editable-text-area
                    ref="editableTextArea"
                    v-model="noteContents"
                    default-value="No content"
                    class="node-note"
                    :hide-add-button="true"
                />
            </template>
        </card>
    </div>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";
    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import EditableTextArea from "/front-end/vue/common/EditableTextArea.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

    export default {
        components: {
            Card,
            DropDownMenu,
            EditableTextArea,
            FontAwesomeIcon,
        },
        props: {
            nodeUuid: {
                type: String,
                default: "",
            },
            nodeNoteInitial: {
                type: Object,
                default: function() {},
            },
            deleteNoteUrl: {
                type: String,
                default: "",
            },
            noteUrl: {
                type: String,
                default: "",
            },
            setNoteColorUrl: {
                type: String,
                default: "",
            },
        },
        emits: ["delete-note", "open-note-metadata-modal", "edit-layout"],
        setup(props, ctx) {
            const colors = [1, 2, 3, 4];
            let nameCache = null;
            const action = ref("Edit");
            const isEditingName = ref(false);
            const nodeNote = ref({});
            const note = ref("");
            const noteContents = ref("");

            const editableTextArea = ref(null);

            watch(noteContents, (newValue) => {
                if (newValue) {
                    editNoteContents();
                }
            });

            function getClass(color) {
                const selectedColor = color === (nodeNote.value && nodeNote.value.color) ? "selected-color" : "";
                return `node-color-${color} ${selectedColor}`;
            };

            function handleNoteEdit() {
                editableTextArea.value.editNote(!note.value.content);
            };

            function handleNameEdit() {
                nameCache = note.value.name;
                isEditingName.value = true;
            };

            function onOpenNoteMetadataModal(actionValue) {
                ctx.emit("open-note-metadata-modal", editNoteMetadata, nodeNote.value);
            };

            function handleNameEdit() {
                isEditingName.value = false;
                // If the name hasn't changed, abort
                if (nameCache === nodeNote.value.name) {
                    return;
                }
                editNoteMetadata(nodeNote.value);
            };

            function handleNoteDelete() {
                doPost(
                    props.deleteNoteUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "note_uuid": note.value.uuid,
                    },
                    (response) => {
                        ctx.emit("edit-layout", response.data.layout);
                    },
                    "Note deleted",
                );

                ctx.emit("delete-note", note.value.uuid);
            };

            function editNoteMetadata(note) {
                doPost(
                    props.setNoteColorUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "note_uuid": note.uuid,
                        "color": note.color,
                    },
                    (response) => {
                        nodeNote.value.color = note.color;
                    },
                    "",
                    "",
                );
                editNoteContents();
            };

            function editNoteContents() {
                doPut(
                    props.noteUrl,
                    {
                        "uuid": nodeNote.value.uuid,
                        "name": nodeNote.value.name,
                        "content": noteContents.value,
                        "is_note": true,
                    },
                    (response) => {},
                    "",
                );
            };

            const cardClass = computed(() => {
                return `node-color-${nodeNote.value.color}`;
            });

            onMounted(() => {
                nodeNote.value = props.nodeNoteInitial;
                getNote();
            });

            function getNote() {
                doGet(
                    props.noteUrl,
                    (response) => {
                        note.value = response.data;
                        noteContents.value = response.data.content;
                    },
                    "Error getting note",
                );
            };

            return {
                action,
                cardClass,
                colors,
                editableTextArea,
                getClass,
                getNote,
                handleNameEdit,
                handleNameEdit,
                handleNoteDelete,
                handleNoteEdit,
                isEditingName,
                onOpenNoteMetadataModal,
                nodeNote,
                note,
                noteContents,
                editNoteContents,
                editNoteMetadata,
            };
        },
    };

</script>
