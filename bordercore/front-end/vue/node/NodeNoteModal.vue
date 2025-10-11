<template>
    <div id="modalEditNote" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        {{ action }} Note
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div class="row mb-3">
                        <label class="col-lg-3 col-form-label" for="inputTitle">Name</label>
                        <div class="col-lg-9">
                            <input id="id_name_note" v-model="nodeNote.name" type="text" class="form-control" autocomplete="off" maxlength="200" required @keyup.enter="handleNoteEdit">
                        </div>
                    </div>
                    <div class="row mb-3">
                        <label class="col-lg-3 col-form-label" for="inputTitle">Color</label>
                        <div class="col-lg-9">
                            <div class="d-flex">
                                <div v-for="color in colors" :key="color" class="node-color flex-grow-1 mx-2" :class="getClass(color)" @click="handleColorSelect(color)" />
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <input id="btn-action" class="btn btn-primary" type="button" value="Save" @click="handleNoteEdit">
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    export default {
        setup() {
            const action = ref("Edit");
            const colors = [1, 2, 3, 4];

            let callback = null;
            let modal = null;
            const nodeNote = ref({});
            let nodeNoteInitial = {};

            function getClass(color) {
                const selectedColor = color === (nodeNote.value && nodeNote.value.color) ? "selected-color" : "";
                return `node-color-${color} ${selectedColor}`;
            };

            function handleColorSelect(color) {
                nodeNote.value.color = color;
            };

            function handleNoteEdit() {
                // If any of the properties have changed, trigger the callback
                if (nodeNote.value !== nodeNoteInitial) {
                    callback(nodeNote.value);
                }
                modal.hide();
            };

            function openModal(actionParam, callbackParam, nodeNoteParam) {
                nodeNote.value = nodeNoteParam;
                nodeNoteInitial = {...nodeNoteParam};
                action.value = actionParam;
                callback = callbackParam;
                modal.show();
                setTimeout( () => {
                    document.querySelector("#modalEditNote input").focus();
                }, 500);
            };

            onMounted(() => {
                modal = new Modal("#modalEditNote");
            });

            return {
                action,
                callback,
                colors,
                getClass,
                modal,
                nodeNote,
                nodeNoteInitial: {},
                handleColorSelect,
                handleNoteEdit,
                openModal,
            };
        },
    };

</script>
