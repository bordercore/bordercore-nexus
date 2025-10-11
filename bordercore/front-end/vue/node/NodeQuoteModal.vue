<template>
    <div id="modalEditQuote" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        {{ action }} Quote
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div class="row mb-3">
                        <label class="col-lg-3 col-form-label" for="inputTitle">Color</label>
                        <div class="col-lg-9">
                            <div class="d-flex">
                                <div v-for="color in colors" :key="color" class="node-color flex-grow-1 mx-2" :class="getClass(color)" @click="handleColorSelect(color)" />
                            </div>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <label class="col-lg-3 col-form-label" for="inputTitle">Rotate</label>
                        <div class="col-lg-9">
                            <div class="d-flex flex-column">
                                <select v-model="options.rotate" class="form-control form-select">
                                    <option v-for="option in rotateOptions" :key="option.value" :value="option.value">
                                        {{ option.display }}
                                    </option>
                                </select>
                                <div class="d-flex align-items-center mt-1">
                                    <o-switch v-model="options.favorites_only" value="favorites-only" />
                                    <label class="ms-2">Favorites Only</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <label class="col-lg-3 col-form-label" for="inputTitle">Format</label>
                        <div class="col-lg-9">
                            <div class="d-flex flex-column">
                                <select v-model="options.format" class="form-control form-select">
                                    <option v-for="option in formatOptions" :key="option.value" :value="option.value">
                                        {{ option.display }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <input class="btn btn-primary" type="button" value="Save" @click="handleQuoteEdit">
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    export default {
        props: {
            nodeUuid: {
                default: "",
                type: String,
            },
            addNodeUrl: {
                default: "",
                type: String,
            },
        },
        emits: ["edit-layout"],
        setup(props, ctx) {
            const action = ref("Edit");

            let callback = null;
            const colors = [1, 2, 3, 4];
            const formatOptions = [
                {
                    value: "standard",
                    display: "Standard",
                },
                {
                    value: "minimal",
                    display: "Minimal",
                },
            ];
            let modal = null;
            const optionsDefault = {"format": "standard", "rotate": -1};
            const options = ref(optionsDefault);
            const rotateOptions = [
                {
                    value: -1,
                    display: "Never",
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

            function getClass(color) {
                const selectedColor = color === (options.value && options.value.color) ? "selected-color" : "";
                return `node-color-${color} ${selectedColor}`;
            };

            function handleQuoteEdit() {
                if (action.value === "Add") {
                    doPost(
                        props.addNodeUrl,
                        {
                            "node_uuid": props.nodeUuid,
                            "options": JSON.stringify(options.value),
                        },
                        (response) => {
                            ctx.emit("edit-layout", response.data.layout);
                            modal.hide();
                        },
                        "Quote added",
                    );
                } else {
                    callback(options.value);
                }
                modal.hide();
            };

            function openModal(actionParam, callbackParam, optionsParam) {
                action.value = actionParam;
                callback = callbackParam;
                options.value = optionsParam ? optionsParam : optionsDefault;
                modal.show();
            };

            function handleColorSelect(color) {
                options.value.color = color;
            };

            onMounted(() => {
                modal = new Modal("#modalEditQuote");
            });

            return {
                action,
                colors,
                formatOptions,
                getClass,
                handleColorSelect,
                handleQuoteEdit,
                openModal,
                options,
                rotateOptions,
            };
        },
    };

</script>
