<template>
    <div id="modalUpdateTodo" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        Save Todo Task
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div>
                        <form @submit.prevent>
                            <div>
                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputName">Name</label>
                                    <div class="col-lg-9">
                                        <input id="id_name" v-model="todoInfo.name" type="text" name="name" class="form-control" autocomplete="off" maxlength="200" required>
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputPriority">Priority</label>
                                    <div class="col-lg-9">
                                        <select id="id_priority" v-model="todoInfo.priority" name="priority" class="form-control form-select">
                                            <option v-for="priority in priorityList" :key="priority[0]" :value="priority[0]">
                                                {{ priority[1] }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputNote">Note</label>
                                    <div
                                        class="col-lg-9"
                                        :class="{over: isDragOver}"
                                        @dragover.prevent="isDragOver = true"
                                        @dragleave.prevent="isDragOver = false"
                                        @drop="isDragOver = false"
                                        @drop.prevent="handleLinkDrop"
                                    >
                                        <textarea
                                            id="id_note"
                                            v-model="todoInfo.note"
                                            name="note"
                                            cols="40"
                                            rows="3"
                                            class="form-control"
                                            oninput="this.style.height = ''; this.style.height = this.scrollHeight + 3 + 'px'"
                                        />
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputTags">Tags</label>
                                    <div class="col-lg-9">
                                        <tags-input
                                            ref="tagsInput"
                                            :search-url="tagSearchUrl"
                                            @tags-changed="handleTagsChanged"
                                        />
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputUrl">Url</label>
                                    <div class="col-lg-9">
                                        <input id="id_url" v-model="todoInfo.url" type="text" name="url" class="form-control" autocomplete="off">
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="dueDate">Due Date</label>
                                    <div class="col-lg-9">
                                        <Datepicker
                                            id="id_due_date"
                                            v-model="todoInfo.due_date"
                                            input-format="yyyy-MM-dd"
                                            :typeable="true"
                                            name="due_date"
                                            class="form-control"
                                        >
                                            <span slot="afterDateInput" class="input-group-append">
                                                <div class="input-group-text h-100">
                                                    <font-awesome-icon icon="calendar-alt" />
                                                </div>
                                            </span>
                                        </Datepicker>
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-lg-9 offset-lg-3 d-flex">
                                        <button type="button" class="btn btn-outline-danger me-auto" @click="handleDelete">
                                            <font-awesome-icon icon="trash-alt" /> Delete
                                        </button>
                                        <div class="d-flex ms-auto">
                                            <input class="btn btn-secondary ms-4" type="button" value="Cancel" @click="handleCancel" />
                                            <input class="btn btn-primary ms-2" type="button" value="Save" @click.prevent="handleSubmit">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    import Datepicker from "vue3-datepicker";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import TagsInput from "/front-end/vue/common/TagsInput.vue";

    export default {
        components: {
            Datepicker,
            FontAwesomeIcon,
            TagsInput,
        },
        props: {
            priorityList: {
                default: () => [],
                type: Array,
            },
            updateTodoUrl: {
                default: "",
                type: String,
            },
            createTodoUrl: {
                default: "",
                type: String,
            },
            tagSearchUrl: {
                default: "",
                type: String,
            },
        },
        emits: ["add", "delete", "update"],
        setup(props, ctx) {
            const action = ref("Update");
            const isDragOver = ref(false);
            const todoInfo = ref({
                priority: 2,
                tags: [],
            });

            let modal = null;

            const tagsInput = ref(null);

            function handleLinkDrop(event) {
                // The "Note" field
                const link = `[link](${event.dataTransfer.getData("URL")})`;
                event.target.value = `${event.target.value}${link}`;
                const index = event.target.value.indexOf(link);
                event.target.setSelectionRange(index + 1, index + 5);
                todoInfo.value.note = event.target.value;
            };

            function handleSubmit() {
                const dueDate = document.getElementsByName("due_date")[0].value;
                if (action.value === "Update") {
                    doPut(
                        props.updateTodoUrl.replace(/00000000-0000-0000-0000-000000000000/, todoInfo.value.uuid),
                        {
                            "todo_uuid": todoInfo.value.uuid,
                            "name": todoInfo.value.name,
                            "priority": todoInfo.value.priority,
                            "note": todoInfo.value.note,
                            "tags": todoInfo.value.tags,
                            "url": todoInfo.value.url || "",
                            "due_date": dueDate,
                        },
                        (response) => {
                            ctx.emit("update", response.data.uuid);
                            const modal = Modal.getInstance(document.getElementById("modalUpdateTodo"));
                            modal.hide();
                        },
                        "Todo updated",
                    );
                } else {
                    doPost(
                        props.createTodoUrl,
                        {
                            "name": todoInfo.value.name,
                            "priority": todoInfo.value.priority,
                            "note": todoInfo.value.note || "",
                            "tags": todoInfo.value.tags,
                            "url": todoInfo.value.url || "",
                            "due_date": dueDate,
                        },
                        (response) => {
                            ctx.emit("add", response.data.uuid);
                            const modal = Modal.getInstance(document.getElementById("modalUpdateTodo"));
                            modal.hide();
                        },
                        "Todo task created.",
                    );
                }
            };

            function handleCancel() {
                const modal = Modal.getInstance(document.getElementById("modalUpdateTodo"));
                modal.hide();
            };

            function handleDelete() {
                ctx.emit("delete", todoInfo.value);
                const modal = Modal.getInstance(document.getElementById("modalUpdateTodo"));
                modal.hide();
            };

            function handleTagsChanged(newTags) {
                todoInfo.value.tags = newTags;
            };

            function openModal(actionParam, nodeTodoParam) {
                action.value = actionParam;
                if (nodeTodoParam) {
                    todoInfo.value = nodeTodoParam;
                }
                modal.show();
                setTimeout( () => {
                    document.querySelector("#modalUpdateTodo input").focus();
                }, 500);
            };

            function setAction(actionParam) {
                action.value = actionParam;
            };

            function setTags(tagList) {
                tagsInput.value.setTagList(tagList);
            };

            onMounted(() => {
                modal = new Modal("#modalUpdateTodo");
            });

            return {
                action,
                handleCancel,
                handleDelete,
                handleLinkDrop,
                handleTagsChanged,
                handleSubmit,
                isDragOver,
                openModal,
                setAction,
                setTags,
                tagsInput,
                todoInfo,
            };
        },
    };

</script>
