<template>
    <div id="modalEditCollection" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        {{ action }} Collection
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div v-if="action === 'Add'">
                        <div class="form-section">
                            Type
                        </div>
                        <div class="row mt-3">
                            <div class="col-lg-4">
                                <div class="form-check d-flex align-items-center">
                                    <input id="id_type_new" v-model="collectionObjectList.collection_type" class="form-check-input" type="radio" name="type" value="ad-hoc" @change="handleCollectionTypeChange('ad-hoc')">
                                    <label class="form-check-label ms-2" for="id_type_new">
                                        New
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-lg-4">
                                <div class="form-check d-flex align-items-center">
                                    <input id="id_type_existing" v-model="collectionObjectList.collection_type" class="form-check-input" type="radio" name="type" value="permanent" @change="handleCollectionTypeChange('permanent')">
                                    <label class="form-check-label ms-2" for="id_type_existing">
                                        Existing
                                    </label>
                                </div>
                            </div>
                            <div class="col-lg-8">
                                <select-value
                                    ref="selectValue"
                                    :is-disabled-initial="true"
                                    label="name"
                                    place-holder="Search collections"
                                    :search-url="searchUrl"
                                    @select="handleCollectionSelect"
                                >
                                    <template #option="props">
                                        <div :class="{'suggestion-item-disabled': props.option_blob}" class="search-suggestion d-flex align-items-center">
                                            <div>
                                                <img class="me-2 mt-2" width="50" height="50" :src="props.option.cover_url">
                                            </div>
                                            <div class="d-flex flex-column">
                                                <div>
                                                    {{ props.option.name }}
                                                </div>
                                                <div class="text-secondary lh-1">
                                                    <small>{{ props.option.num_objects }} objects</small>
                                                </div>
                                                <div v-if="props.option_blob" class="text-warning ms-auto">
                                                    Added
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </select-value>
                            </div>
                        </div>
                        <hr class="my-3">
                    </div>
                    <div class="form-section">
                        Options
                    </div>
                    <Transition name="fade">
                        <div v-if="collectionObjectList.collection_type === 'ad-hoc'" class="row mb-3">
                            <label class="col-lg-4 col-form-label" for="inputTitle">
                                Name
                            </label>
                            <div class="col-lg-8">
                                <input v-model="collectionObjectList.name" type="text" class="form-control" autocomplete="off" maxlength="200" placeholder="Name" @keyup.enter="handleCollectionEdit">
                            </div>
                        </div>
                    </Transition>
                    <div class="row mt-3">
                        <label class="col-lg-4 col-form-label" for="inputTitle">
                            Display
                        </label>
                        <div class="col-lg-8">
                            <div class="d-flex flex-column">
                                <select v-model="collectionObjectList.display" class="form-control form-select">
                                    <option v-for="option in displayOptions" :key="option.value" :value="option.value">
                                        {{ option.display }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <Transition name="fade">
                        <div v-if="collectionObjectList.display === 'individual'" class="row mt-3">
                            <label class="col-lg-4 col-form-label" for="inputTitle">Rotate</label>
                            <div class="col-lg-8">
                                <div class="d-flex flex-column">
                                    <select v-model="collectionObjectList.rotate" class="form-control form-select">
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
                        <div v-else class="row mt-3">
                            <label class="col-lg-4 col-form-label" for="inputTitle">Limit</label>
                            <div class="col-lg-8">
                                <div>
                                    <input v-model="collectionObjectList.limit" type="number" class="form-control" autocomplete="off" maxlength="10" placeholder="Limit" @keyup.enter="handleCollectionEdit">
                                </div>
                            </div>
                        </div>
                    </Transition>
                    <div class="row align-items-center mt-2 mb-3">
                        <label class="col-lg-4 col-form-label" for="inputTitle">
                            Random Order
                        </label>
                        <div class="col-lg-8">
                            <o-switch v-model="collectionObjectList.random_order" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <input class="btn btn-primary" type="button" value="Save" @click="handleCollectionEdit">
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    import SelectValue from "/front-end/vue/common/SelectValue.vue";

    export default {
        name: "CollectionObjectListModal",
        components: {
            SelectValue,
        },
        props: {
            addCollectionUrl: {
                default: "",
                type: String,
            },
            nodeUuid: {
                type: String,
                default: "",
            },
            searchUrl: {
                default: "",
                type: String,
            },
        },
        emits: ["edit-layout"],
        setup(props, ctx) {
            const action = ref("Edit");
            const collectionObjectList = ref({});

            let callback = null;
            let collectionObjectListInitial = {};
            const displayOptions = [
                {
                    value: "list",
                    display: "List",
                },
                {
                    value: "individual",
                    display: "Individual",
                },
            ];
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
            let modal = null;

            const selectValue = ref(null);

            function handleCollectionTypeChange(type) {
                if (selectValue.value) {
                    selectValue.value.setDisabled(
                        type === "ad-hoc" ? true : false,
                    );
                }
            };

            function openModal(actionParam, callbackParam, collectionObjectListParam) {
                collectionObjectList.value = collectionObjectListParam;
                collectionObjectListInitial = {...collectionObjectList};
                action.value = actionParam;
                callback = callbackParam;
                modal.show();
                setTimeout( () => {
                    document.querySelector("#modalEditCollection input").focus();
                }, 500);
            };

            function handleCollectionSelect(collection) {
                collectionObjectList.value.uuid = collection.uuid;
            };

            function handleCollectionEdit() {
                // If any of the properties have changed, edit the collection
                if (collectionObjectList.value !== collectionObjectListInitial) {
                    if (action.value === "Edit") {
                        callback(collectionObjectList.value);
                        modal.hide();
                    } else {
                        doPost(
                            props.addCollectionUrl,
                            {
                                "node_uuid": props.nodeUuid,
                                "collection_name": collectionObjectList.value.name,
                                "collection_uuid": collectionObjectList.value.uuid,
                                "display": collectionObjectList.value.display,
                                "random_order": collectionObjectList.value.random_order,
                                "rotate": collectionObjectList.value.rotate,
                                "limit": collectionObjectList.value.limit,
                            },
                            (response) => {
                                ctx.emit("edit-layout", response.data.layout);
                                modal.hide();
                                nextTick(() => {
                                    selectValue.value.clearOptions();
                                });
                            },
                            "Collection added",
                        );
                    }
                }
            };

            onMounted(() => {
                modal = new Modal("#modalEditCollection");
            });

            return {
                action,
                collectionObjectList,
                displayOptions,
                handleCollectionTypeChange,
                handleCollectionSelect,
                handleCollectionEdit,
                openModal,
                rotateOptions,
                selectValue,
            };
        },
    };

</script>
