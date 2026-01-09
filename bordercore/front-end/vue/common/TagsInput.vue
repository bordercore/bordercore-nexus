<template>
    <div :class="[{ 'has-search': searchIcon }, classList]">
        <div v-if="searchIcon">
            <font-awesome-icon icon="magnifying-glass" />
        </div>
        <multiselect
            ref="multiselect"
            v-model="value"
            :searchable="searchable"
            :disabled="disabled"
            class="tags-input"
            label="label"
            track-by="label"
            :taggable="true"
            :options="options"
            :show-no-options="false"
            :internal-search="true"
            :multiple="true"
            select-label=""
            deselect-label=""
            :value="initialValue"
            :max-height="600"
            :min-length="2"
            :options-limit="optionsLimit"
            :placeholder="placeHolder"
            tag-placeholder=""
            autocomplete="off"
            @blur="handleBlur"
            @close="handleClose"
            @open="handleOpen"
            @remove="handleTagSelect"
            @search-change="onSearchChange"
            @select="handleTagSelect"
            @tag="handleTagAdd"
        >
            <template #caret>
                <div class="multiselect__select mt-1">
                    <font-awesome-icon icon="angle-down" class="align-middle" />
                </div>
            </template>
        </multiselect>
        <input type="hidden" :name="name" :value="tagsCommaSeparated">
    </div>
</template>

<script>

    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import Multiselect from "vue-multiselect";
    import debouncer from "../../debounce.js";

    export default {

        components: {
            FontAwesomeIcon,
            Multiselect,
        },
        props: {
            initialValue: {
                type: Object,
                default: function() {},
            },
            minLength: {
                default: 2,
                type: Number,
            },
            optionsLimit: {
                default: 20,
                type: Number,
            },
            searchIcon: {
                type: Boolean,
                default: false,
            },
            searchUrl: {
                type: String,
                default: "search-url",
            },
            placeHolder: {
                type: String,
                default: "",
            },
            name: {
                type: String,
                default: "tags",
            },
            autofocus: {
                type: Boolean,
                default: false,
            },
            classList: {
                type: String,
                default: "w-100",
            },
            disabled: {
                default: false,
                type: Boolean,
            },
            maxTags: {
                default: undefined,
                type: Number,
            },
        },
        emits: ["blur", "close", "open", "search-change", "tags-changed"],
        setup(props, ctx) {
            const options = ref([]);
            const tags = ref([]);
            const value = ref([]);
            const {debounce} = debouncer();

            const multiselect = ref(null);

            const searchable = computed(() => {
                return !props.maxTags || value.value.length <= props.maxTags - 1;
            });

            const tagsCommaSeparated = computed(() => {
                return value.value.map((x) => x.label).join(",");
            });

            function addTag(tagName) {
                value.value.push({"label": tagName});
            };

            function clearOptions() {
                options.value = [];
                value.value = [];
            };

            function focus() {
                const input = multiselect.value.$el.querySelector("input");
                if (input) {
                    input.focus();
                }
            };

            function handleTagAdd(tagName) {
                addTag(tagName);
            };

            function handleBlur(event) {
                ctx.emit("blur", event);
            };

            function handleClose(event) {
                ctx.emit("close", event);
            };

            function handleOpen(event) {
                ctx.emit("open", event);
            };

            function handleTagSelect() {
                ctx.emit("tags-changed", value.value.map( (x) => x.label ));
                options.value = [];
                nextTick(() => {
                    focus();
                });
            };

            function onSearchChange(query) {
                ctx.emit("search-change", query);
                if (multiselect.value.search.length <= props.minLength) {
                    options.value = [];
                    return;
                }

                try {
                    debounce(() => {
                        return axios.get(props.searchUrl + query)
                            .then((response) => {
                                options.value = response.data.map((a) => {
                                    return {label: a.label};
                                });
                            });
                    });
                } catch (error) {
                    console.log(`Error: ${error}`);
                }
            };

            function setTagList(tagList) {
                value.value = tagList.map( (x) => ({"label": x}) );
            };

            onMounted(() => {
                const initialTags = document.getElementById("initial-tags");
                if (initialTags && initialTags.textContent !== "\"\"") {
                    value.value = JSON.parse(initialTags.textContent).map( (x) => ({label: x}) );
                }

                if (props.autofocus) {
                    focus();
                }
            });

            return {
                addTag,
                clearOptions,
                focus,
                handleTagAdd,
                handleBlur,
                handleClose,
                handleOpen,
                handleTagSelect,
                multiselect,
                onSearchChange,
                options,
                searchable,
                setTagList,
                tags,
                tagsCommaSeparated,
                value,
            };
        },
    };

</script>
