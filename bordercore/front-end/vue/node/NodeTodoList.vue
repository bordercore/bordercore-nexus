<template>
    <div class="hover-reveal-target">
        <card title="" class="backdrop-filter node-color-1 position-relative">
            <template #title-slot>
                <div class="card-title d-flex">
                    <div>
                        <font-awesome-icon icon="tasks" class="text-primary me-3" />
                        Todo Tasks
                    </div>
                    <div class="dropdown-menu-container ms-auto">
                        <drop-down-menu class="d-none hover-reveal-object" :show-on-hover="false">
                            <template #dropdown>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleTodoCreate">
                                        <span>
                                            <font-awesome-icon icon="plus" class="text-primary me-3" />
                                        </span>
                                        Add Task
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="onDeleteTodoList">
                                        <span>
                                            <font-awesome-icon icon="plus" class="text-primary me-3" />
                                        </span>
                                        Remove Todo List
                                    </a>
                                </li>
                            </template>
                        </drop-down-menu>
                    </div>
                </div>
            </template>

            <template #content>
                <hr class="divider">
                <ul id="sort-container-tags" class="list-group list-group-flush interior-borders">
                    <VueDraggable
                        v-model="todoList"
                        :distance="3"
                        ghost-class="slicklist-helper"
                        @end="handleSort"
                        tag="div"
                    >
                        <div
                            v-for="(element, index) in todoList"
                            :key="element.uuid"
                            class="slicklist-item"
                        >
                            <div class="slicklist-list-item-inner">
                                <li v-cloak :key="element.uuid" class="hover-target list-group-item pe-0" :data-uuid="element.uuid">
                                    <div class="dropdown-height d-flex align-items-start">
                                        <div>
                                            {{ element.name }}
                                            <div v-if="element.url" class="node-url">
                                                <a :href="element.url">Link</a>
                                            </div>
                                            <div v-if="element.note" class="node-object-note">
                                                {{ element.note }}
                                            </div>
                                        </div>

                                        <drop-down-menu :show-on-hover="true">
                                            <template #dropdown>
                                                <li>
                                                    <a class="dropdown-item" href="#" @click.prevent="handleTodoEdit(element)">
                                                        <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />Edit
                                                    </a>
                                                </li>
                                                <li>
                                                    <a class="dropdown-item" href="#" @click.prevent="handleTodoRemove(element.uuid)">
                                                        <font-awesome-icon icon="trash-alt" class="text-primary me-3" />Remove
                                                    </a>
                                                </li>
                                            </template>
                                        </drop-down-menu>
                                    </div>
                                </li>
                            </div>
                        </div>
                    </VueDraggable>
                    <div v-if="todoList.length == 0" v-cloak :key="1" class="text-muted">
                        No tasks
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
    import {VueDraggable} from "vue-draggable-plus";

    export default {
        components: {
            Card,
            DropDownMenu,
            FontAwesomeIcon,
            VueDraggable,
        },
        props: {
            nodeUuid: {
                type: String,
                default: "",
            },
            getTodoListUrl: {
                type: String,
                default: "",
            },
            addNodeTodoUrl: {
                type: String,
                default: "",
            },
            removeNodeTodoUrl: {
                type: String,
                default: "",
            },
            sortNodeTodosUrl: {
                type: String,
                default: "",
            },
            deleteTodoListUrl: {
                type: String,
                default: "",
            },
        },
        emits: ["open-create-edit-todo-modal", "edit-layout"],
        setup(props, ctx) {
            const todoList = ref([]);

            function addNodeTodo(todoUuid) {
                doPost(
                    props.addNodeTodoUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "todo_uuid": todoUuid,
                    },
                    () => {
                        getTodoList();
                    },
                );
            };

            function getTodoList() {
                doGet(
                    props.getTodoListUrl,
                    (response) => {
                        todoList.value = response.data.todo_list;
                    },
                    "Error getting todo list",
                );
            };

            function handleTodoCreate() {
                ctx.emit("open-todo-editor-modal", "Create");
            };

            function handleTodoEdit(todoInfo) {
                ctx.emit("open-todo-editor-modal", "Edit", todoInfo);
            };

            function onDeleteTodoList() {
                doPost(
                    props.deleteTodoListUrl,
                    {
                        "node_uuid": props.nodeUuid,
                    },
                    (response) => {
                        ctx.emit("edit-layout", response.data.layout);
                    },
                    "Todo list deleted",
                );
            };

            function handleTodoRemove(todoUuid) {
                // Delete the todo item, and the NodeTodo object
                //  will automatically be deleted as well
                axios.delete(props.removeNodeTodoUrl.replace("00000000-0000-0000-0000-000000000000", todoUuid))
                    .then((response) => {
                        EventBus.$emit(
                            "toast",
                            {
                                "body": "Todo task deleted",
                                "variant": "info",
                            },
                        );
                        getTodoList();
                    }, (error) => {
                        console.log(error);
                    });
            };

            function handleSort(event) {
                if (event.oldIndex === event.newIndex) {
                    return;
                }
                // v-model has already updated the array, so the dragged item is now at newIndex
                const todoUuid = todoList.value[event.newIndex].uuid;

                // The backend expects the ordering to begin
                // with 1, not 0, so add 1.
                const newPosition = event.newIndex + 1;

                doPost(
                    props.sortNodeTodosUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "todo_uuid": todoUuid,
                        "new_position": newPosition,
                    },
                    () => {},
                );
            };

            onMounted(() => {
                getTodoList();
            });

            return {
                addNodeTodo,
                getTodoList,
                handleSort,
                handleTodoCreate,
                handleTodoRemove,
                onDeleteTodoList,
                handleTodoEdit,
                todoList,
            };
        },
    };

</script>
