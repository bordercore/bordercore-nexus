<template>
    <div class="hover-target" @mouseover="hover = true" @mouseleave="hover = false">
        <card class="backdrop-filter" :class="cardClass" title="">
            <template #title-slot>
                <div v-if="quoteOptions && quoteOptions.format !== 'minimal'" class="dropdown-height d-flex">
                    <div v-cloak class="card-title d-flex">
                        <div>
                            <font-awesome-icon icon="quote-left" class="text-primary me-3" />
                            Quote
                        </div>
                    </div>
                    <div class="dropdown-menu-container ms-auto">
                        <drop-down-menu :show-on-hover="true">
                            <template #dropdown>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleOpenQuoteModal">
                                        <span>
                                            <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />
                                        </span>
                                        Edit quote
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="handleQuoteRemove">
                                        <span>
                                            <font-awesome-icon icon="plus" class="text-primary me-3" />
                                        </span>
                                        Remove quote
                                    </a>
                                </li>
                            </template>
                        </drop-down-menu>
                    </div>
                    <hr class="divider">
                </div>
            </template>
            <template #content>
                <Transition enter-active-class="animate__animated animate__zoomIn">
                    <div v-if="quote" :key="quote.uuid">
                        <div>
                            {{ quote.quote }}
                        </div>
                        <div class="text-primary text-smaller">
                            <strong>{{ quote.source }}</strong>
                        </div>
                    </div>
                </Transition>
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
            nodeUuid: {
                type: String,
                default: "",
            },
            quoteOptionsInitial: {
                type: Object,
                default: function() {},
            },
            getAndSetQuoteUrl: {
                type: String,
                default: "",
            },
            getQuoteUrl: {
                type: String,
                default: "",
            },
            removeComponentUrl: {
                type: String,
                default: "",
            },
            editQuoteUrl: {
                type: String,
                default: "",
            },
        },
        emits: ["open-quote-edit-modal", "edit-layout"],
        setup(props, ctx) {
            const hover = ref(false);
            const quote = ref(null);
            const quoteOptions = ref(props.quoteOptionsInitial);
            let rotateInterval = null;

            function getQuote() {
                doGet(
                    props.getQuoteUrl,
                    (response) => {
                        quote.value = response.data;
                    },
                    "Error getting quote",
                );
            };

            function getRandomQuote() {
                doPost(
                    props.getAndSetQuoteUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "favorites_only": quoteOptions.value.favorites_only,
                    },
                    (response) => {
                        quote.value = response.data.quote;
                    },
                );
            };

            function handleQuoteRemove() {
                doPost(
                    props.removeComponentUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "uuid": props.uuid,
                    },
                    (response) => {
                        ctx.emit("edit-layout", response.data.layout);
                    },
                    "Quote removed",
                );
            };

            function editQuote(options) {
                doPost(
                    props.editQuoteUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "uuid": props.uuid,
                        "options": JSON.stringify(options),
                    },
                    (response) => {
                        quoteOptions.value = options;
                        setTimer();
                        ctx.emit("edit-layout", response.data.layout);
                    },
                );
            };

            function handleOpenQuoteModal() {
                ctx.emit("open-quote-edit-modal", editQuote, quoteOptions.value);
            };

            function setTimer() {
                if (!quoteOptions.value.rotate || quoteOptions.rotate === -1) {
                    return;
                }
                clearInterval(rotateInterval);
                rotateInterval = setInterval( () => {
                    getRandomQuote();
                }, quoteOptions.value.rotate * 1000 * 60);
            };

            onMounted(() => {
                getQuote();

                if (quoteOptions.value.rotate !== null && quoteOptions.value.rotate !== -1) {
                    setTimer();
                }

                hotkeys("m,right,u", function(event, handler) {
                    if (!hover.value) {
                        return;
                    }
                    switch (handler.key) {
                    case "m":
                        quoteOptions.value.format = quoteOptions.value.format === "minimal" ? "standard": "minimal";
                        break;
                    case "right":
                        getRandomQuote();
                        break;
                    case "u":
                        handleOpenQuoteModal();
                        break;
                    }
                });
            });

            onUnmounted(() => {
                clearInterval(rotateInterval);
            });

            const cardClass = computed(() => {
                return `node-color-${quoteOptions.value.color}`;
            });

            return {
                cardClass,
                handleOpenQuoteModal,
                handleQuoteRemove,
                hover,
                quote,
                quoteOptions,
            };
        },
    };

</script>
