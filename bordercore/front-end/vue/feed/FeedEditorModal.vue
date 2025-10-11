<template>
    <div id="modalEditFeed" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        {{ action }} Feed
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div>
                        <form @submit.prevent>
                            <div>
                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputTitle">Name</label>
                                    <div class="col-lg-9">
                                        <input id="id_name" v-model="feedInfo.name" type="text" name="name" class="form-control" autocomplete="off" maxlength="200" required>
                                    </div>
                                </div>

                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputTitle">Url</label>
                                    <div class="col-lg-9">
                                        <input id="id_url" v-model="feedInfo.url" type="text" name="url" class="form-control" required autocomplete="off" @blur="onBlur">
                                    </div>
                                </div>

                                <div class="row mb-3">
                                    <label class="fw-bold col-lg-3 col-form-label text-end" for="inputTitle">Homepage</label>
                                    <div class="col-lg-9">
                                        <input id="id_homepage" v-model="feedInfo.homepage" type="text" name="name" class="form-control" autocomplete="off" maxlength="200" required>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                <div class="modal-footer row g-0">
                    <div class="col-offset-3 col-lg-9 d-flex align-items-center ps-3">
                        <div id="feed-status">
                            <div class="d-flex align-items-center">
                                <div v-if="checkingStatus" class="d-flex align-items-center">
                                    <div class="spinner-border ms-2 text-secondary" role="status">
                                        <span class="sr-only">Checking feed status...</span>
                                    </div>
                                    <div class="ms-3">
                                        Checking feed status...
                                    </div>
                                </div>
                                <font-awesome-icon v-else :class="statusMsg.class" class="me-2" :icon="statusMsg.icon" />
                                <div v-html="status" />
                            </div>
                        </div>
                        <input class="btn btn-primary ms-auto" type="submit" value="Save" @click="onAction">
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    import {getReasonPhrase, StatusCodes} from "http-status-codes";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

    export default {
        components: {
            FontAwesomeIcon,
        },
        props: {
            editFeedUrl: {
                default: "",
                type: String,
            },
            newFeedUrl: {
                default: "",
                type: String,
            },
            feedCheckUrl: {
                default: "",
                type: String,
            },
        },
        emits: ["add-feed"],
        setup(props, ctx) {
            const action = ref("Action");
            const checkingStatus = ref(false);
            const feedInfo = ref({});
            const lastResponseCode = ref("");
            const status = ref("");

            const statusMsg = computed(() => {
                if (status.value === "") {
                    return {
                        "class": "d-none",
                        "icon": "check",
                    };
                } else if (!lastResponseCode.value || lastResponseCode.value === StatusCodes.OK) {
                    return {
                        "class": "d-block text-success",
                        "icon": "check",
                    };
                } else {
                    return {
                        "class": "d-block text-danger",
                        "icon": "exclamation-triangle",
                    };
                }
            });

            function editModal(actionParam, feedInfoParam) {
                action.value = actionParam;
                feedInfo.value = feedInfoParam;
                status.value = "";
            }

            function onAction() {
                if (action.value === "Edit") {
                    doPut(
                        props.editFeedUrl.replace(/00000000-0000-0000-0000-000000000000/, feedInfo.value.uuid),
                        {
                            "feed_uuid": feedInfo.value.uuid,
                            "homepage": feedInfo.value.homepage,
                            "name": feedInfo.value.name,
                            "url": feedInfo.value.url,
                        },
                        () => {
                            const modal = Modal.getInstance(document.getElementById("modalEditFeed"));
                            modal.hide();
                        },
                        "Feed edited",
                    );
                } else {
                    doPost(
                        props.newFeedUrl,
                        {
                            "homepage": feedInfo.value.homepage,
                            "name": feedInfo.value.name,
                            "url": feedInfo.value.url,
                        },
                        (response) => {
                            ctx.emit("add-feed", response.data.feed_info);
                            const modal = Modal.getInstance(document.getElementById("modalEditFeed"));
                            modal.hide();
                        },
                        "Feed added. Please wait up to an hour for the feed to refresh.",
                    );
                }
            }

            function onBlur(evt) {
                checkingStatus.value = true;

                let feedUrl = document.getElementById("id_url").value;
                if ( !feedUrl ) {
                    return;
                }

                const homepage = document.getElementById("id_homepage").value;
                if ( !homepage ) {
                    const baseUrl = document.getElementById("id_url").value.match(/^(https?:\/\/.*?)\//);
                    if (baseUrl) {
                        feedInfo.value.homepage = baseUrl[1];
                    }
                }

                feedUrl = encodeURIComponent(feedUrl).replace(/%/g, "%25");

                doGet(
                    props.feedCheckUrl.replace(/666/, feedUrl),
                    (response) => {
                        checkingStatus.value = false;
                        lastResponseCode.value = response.data.status_code;
                        if (!response || response.data.status_code != StatusCodes.OK) {
                            status.value = "Feed error. Status: <strong>" + getReasonPhrase(response.data.status) + "</strong>";
                        } else if (response.data.entry_count == 0) {
                            status.value = "Feed error. Found no feed items.";
                        } else {
                            status.value = "Feed <strong>OK</strong>. Found <strong>" + response.data.entry_count + "</strong> feed items.";
                        }
                    },
                    "Error getting feed info",
                );
            }

            return {
                action,
                checkingStatus,
                feedInfo,
                lastResponseCode,
                editModal,
                onAction,
                onBlur,
                status,
                statusMsg,
            };
        },
    };

</script>
