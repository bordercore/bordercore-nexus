<template>
    <div id="modalSelectNode" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        {{ action }} Node
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div v-if="action === 'Add'" class="mb-3">
                        <select-value
                            ref="selectValue"
                            label="name"
                            place-holder="Search nodes"
                            :search-url="searchUrl"
                            @select="handleNodeSelect"
                        >
                        </select-value>
                    </div>
                    <div class="form-section">
                        Options
                    </div>
                    <div class="row mt-3">
                        <label class="col-lg-4 col-form-label" for="inputTitle">Rotate</label>
                        <div class="col-lg-8">
                            <div class="d-flex flex-column">
                                <select v-model="options.rotate" class="form-control form-select">
                                    <option
                                        v-for="option in rotateOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.display }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <input class="btn btn-primary" type="button" value="Save" @click="handleNodeEdit">
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    import SelectValue from "/front-end/vue/common/SelectValue.vue";

    export default {
        components: {
            SelectValue,
        },
        props: {
            parentNodeUuid: {
                default: "",
                type: String,
            },
            addNodeUrl: {
                default: "",
                type: String,
            },
            searchUrl: {
                default: "",
                type: String,
            },
        },
        emits: ["select-node", "edit-layout"],
        setup(props, ctx) {
            const action = ref("Edit");
            let callback = null;
            let modal = null;
            const optionsDefault = {"rotate": -1};
            const options = ref(optionsDefault);
            let nodeUuid = null;

            const rotateOptions = [
                {
                    value: -1,
                    display: "Never",
                    default: true,
                },
                {
                    value: 1,
                    display: "Every Minute",
                },
                {
                    value: 5,
                    display: "Every 5 Minutes",
                },
                {
                    value: 10,
                    display: "Every 10 Minutes",
                },
                {
                    value: 30,
                    display: "Every 30 Minutes",
                },
                {
                    value: 60,
                    display: "Every Hour",
                },
                {
                    value: 1440,
                    display: "Every Day",
                },
            ];

            const selectValue = ref(null);

            function handleNodeEdit() {
                if (action.value === "Add") {
                    doPost(
                        props.addNodeUrl,
                        {
                            "parent_node_uuid": props.parentNodeUuid,
                            "node_uuid": nodeUuid,
                            "options": JSON.stringify(options.value),
                        },
                        (response) => {
                            ctx.emit("edit-layout", response.data.layout);
                            modal.hide();
                        },
                        "Node created",
                    );
                } else {
                    callback(options.value);
                    modal.hide();
                }
            };

            function handleNodeSelect(node) {
                nodeUuid = node.uuid;
            };

            function openModal(actionParam, callbackParam, optionsParam) {
                action.value = actionParam;
                callback = callbackParam;
                options.value = optionsParam ? optionsParam : optionsDefault;
                modal.show();
                if (action.value === "Add") {
                    setTimeout( () => {
                        document.querySelector("#modalSelectNode input").focus();
                    }, 500);
                }
            };

            onMounted(() => {
                modal = new Modal("#modalSelectNode");
            });

            return {
                action,
                handleNodeSelect,
                handleNodeEdit,
                options,
                openModal,
                rotateOptions,
                selectValue,
            };
        },
    };

</script>
