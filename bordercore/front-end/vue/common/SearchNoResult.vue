<template>
    <div class="notice-big alert d-flex">
        <h3>
            <font-awesome-icon icon="magnifying-glass" />
        </h3>
        <div class="message ms-2">
            <h3>
                {{ title }}
            </h3>
            <slot name="message" />
        </div>
    </div>
</template>

<script>

    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

    export default {
        components: {
            FontAwesomeIcon,
        },
        props: {
            title: {
                default: "Nothing found",
                type: String,
            },
        },
    };

</script>
