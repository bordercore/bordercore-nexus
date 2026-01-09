<template>
    <div :class="[{ 'has-search': searchIcon }, wrapperClass]">
        <div v-if="searchIcon">
            <font-awesome-icon icon="magnifying-glass" />
        </div>
        <multiselect
            ref="multiselect"
            v-model="value"
            :disabled="isDisabled"
            :track-by="label"
            :label="label"
            :options="options"
            :show-no-options="false"
            :internal-search="false"
            select-label=""
            deselect-label=""
            :value="initialValue"
            :accesskey="accesskey"
            :max-height="600"
            :min-length="2"
            :options-limit="optionsLimit"
            :placeholder="placeHolder"
            autocomplete="off"
            @search-change="handleSearchChange"
            @select="select"
            @close="handleClose"
            @keyup.enter="handleEnter"
        >
            <template #option="props">
                <slot name="option" v-bind="props">
                    <div v-if="props.option[label] !== emptyLabel">
                        <div v-if="boldenOptions" v-html="boldenOption(props.option[label], props.search)" />
                    </div>
                    <div v-else class="d-none" />
                </slot>
            </template>
            <template #caret>
                <div class="multiselect__select d-flex align-items-center">
                    <font-awesome-icon icon="angle-down" class="ms-2" />
                </div>
            </template>
            <template #afterList="props">
                <slot name="afterList" v-bind="props" />
            </template>
            <template #noResult>
                <div v-show="showNoResult">
                    <span class="multiselect__option">
                        Nothing found
                    </span>
                </div>
            </template>
        </multiselect>
        <input :id="id" type="hidden" :name="name" :value="getValueComputed">
    </div>
</template>

<script>

    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import {boldenOption} from "/front-end/util.js";
    import Multiselect from "vue-multiselect";
    import debouncer from "../../debounce.js";

    export default {
        components: {
            FontAwesomeIcon,
            Multiselect,
        },
        props: {
            label: {
                type: String,
                default: "label",
            },
            initialValue: {
                type: Object,
                default: function() {},
            },
            minLength: {
                default: 2,
                type: Number,
            },
            accesskey: {
                type: String,
                default: null,
            },
            id: {
                type: String,
                default: null,
            },
            isDisabledInitial: {
                type: Boolean,
                default: false,
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
                default: "Name",
            },
            name: {
                type: String,
                default: "search",
            },
            boldenOptions: {
                type: Boolean,
                default: true,
            },
            wrapperClass: {
                type: String,
                default: "",
            },
        },
        emits: ["close", "search", "search-change", "select"],
        setup(props, ctx) {
            const options = ref([]);
            const showNoResult = ref(false);
            const value = ref("");

            const emptyLabel = "____";
            let isDisabled = false;

            const multiselect = ref(null);

            const {debounce} = debouncer();

            function clearOptions() {
                options.value = [];
                value.value = null;
            };

            function focus() {
                multiselect.value.$el.querySelector("input").focus();
            };

            function getValue() {
                if (typeof value.value === "object" && value.value !== null) {
                    return value.value[props.label];
                } else {
                    return "";
                }
            };

            function handleClose(evt) {
                ctx.emit("close", evt);
            };

            function handleEnter(event) {
                // Term search -- let the parent handle it
                ctx.emit("search", multiselect.value.search);
                setValue(multiselect.value.search);
                multiselect.value.$refs.search.blur();
            };

            function handleSearchChange(query) {
                ctx.emit("search-change", query);
                if (multiselect.value.search.length <= props.minLength) {
                    options.value = [];
                    return;
                }

                try {
                    debounce(() => {
                        return axios.get(props.searchUrl + query)
                            .then((response) => {
                                options.value = response.data;
                                if (response.data.length > 0) {
                                    showNoResult.value = false;
                                    options.value.unshift({"label": emptyLabel, "name": ""});
                                } else {
                                    showNoResult.value = true;
                                }
                            });
                    });
                } catch (error) {
                    console.log(`Error: ${error}`);
                }
            };

            function select(option) {
                // Once a value has been selected, emit an event to let the
                //  parent component handle it.
                // If the first option is highlighted, which is always the special
                //  empty label, assume the user hit "Enter" and wants to do a
                //  term search rather than select an option.
                if (option.label === emptyLabel) {
                    ctx.emit("search", multiselect.value.search);
                    clearOptions();
                } else {
                    ctx.emit("select", option);
                }
                options.value = [];
            };

            function setDisabled(value) {
                isDisabled = value;
            };

            function setValue(newValue) {
                const newOption = {
                    [props.label]: newValue,
                };
                options.value.push(newOption);
                value.value = newOption;
            };

            const getValueComputed = computed(() => {
                return getValue();
            });

            onMounted(() => {
                // If given an initial value, add it to the options list
                //  and pre-select it.
                if (props.initialValue) {
                    options.value = [props.initialValue];
                    value.value = props.initialValue;
                }
                if (props.isDisabledInitial) {
                    isDisabled = true;
                }
            });

            return {
                boldenOption,
                clearOptions,
                emptyLabel,
                focus,
                handleClose,
                handleEnter,
                handleSearchChange,
                isDisabled,
                getValue,
                getValueComputed,
                multiselect,
                options,
                showNoResult,
                select,
                setDisabled,
                setValue,
                value,
            };
        },
    };

</script>
