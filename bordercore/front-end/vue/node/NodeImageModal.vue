<template>
    <div id="node-image-modal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog modal-dialog-centered modal-fullscreen" role="document">
            <div class="modal-content">
                <div class="modal-body">
                    <div>
                        <img :src="imageUrl" class="w-100">
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    export default {
        setup() {
            const imageUrl = ref();
            let modal = null;

            function openModal(data) {
                imageUrl.value = data;
                modal.show();
            };

            onMounted(() => {
                modal = new Modal("#node-image-modal");
            });

            return {
                imageUrl,
                openModal,
            };
        },
    };

</script>
