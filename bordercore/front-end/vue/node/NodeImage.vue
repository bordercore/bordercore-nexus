<template>
    <div class="hover-target">
        <card class="backdrop-filter node-color-1">
            <template #title-slot>
                <div class="dropdown-height d-flex">
                    <div v-cloak class="card-title d-flex">
                        <div>
                            <font-awesome-icon icon="image" class="text-primary me-3" />
                            {{ imageTitle }}
                        </div>
                    </div>
                    <div class="dropdown-menu-container ms-auto">
                        <drop-down-menu :show-on-hover="true">
                            <template #dropdown>
                                <li>
                                    <a class="dropdown-item" :href="imageDetailUrl" target="_blank">
                                        <span>
                                            <font-awesome-icon icon="external-link-alt" class="text-primary me-3" />
                                        </span>
                                        Media detail
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="#" @click.prevent="onRemoveImage()">
                                        <span>
                                            <font-awesome-icon icon="times" class="text-primary me-3" />
                                        </span>
                                        Remove media
                                    </a>
                                </li>
                            </template>
                        </drop-down-menu>
                    </div>
                </div>
            </template>
            <template #content>
                <img :src="imageUrl" class="mw-100" @click="onClick">
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
            imageTitle: {
                type: String,
                default: "",
            },
            imageDetailUrl: {
                type: String,
                default: "",
            },
            imageUrl: {
                type: String,
                default: "",
            },
            removeComponentUrl: {
                type: String,
                default: "",
            },
        },
        setup(props, ctx) {
            function onClick() {
                ctx.emit("open-modal-note-image", props.imageUrl);
            };

            function onRemoveImage() {
                doPost(
                    props.removeComponentUrl,
                    {
                        "node_uuid": props.nodeUuid,
                        "uuid": props.uuid,
                    },
                    (response) => {
                        ctx.emit("edit-layout", response.data.layout);
                    },
                    "Image removed",
                );
            };

            return {
                onClick,
                onRemoveImage,
            };
        },
    };

</script>
