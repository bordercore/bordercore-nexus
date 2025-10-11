<template>
    <div id="modalEditor" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 id="myModalLabel" class="modal-title">
                        <span id="action-type" v-html="action" />
                        Playlist
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <div class="row mb-3">
                        <label class="col-lg-4 col-form-label" for="id_name">Name</label>
                        <div class="col-lg-8">
                            <input id="id_name" v-model="name" type="text" name="name" autocomplete="off" maxlength="200" required="required" class="form-control">
                        </div>
                    </div>
                    <div class="row">
                        <label class="col-lg-4 col-form-label" for="id_note">Note</label>
                        <div class="col-lg-8">
                            <textarea id="id_note" v-model="note" name="note" cols="40" rows="3" class="form-control" />
                        </div>
                    </div>
                    <div v-if="action !== 'Edit'" class="row mt-3">
                        <label class="col-lg-4 col-form-label pt-0" for="id_note">Type</label>
                        <div class="col-lg-8">
                            <div class="d-flex">
                                <div class="form-check">
                                    <input id="id_type_manual" v-model="playlistType" class="form-check-input mt-2" type="radio" name="type" value="manual">
                                    <label class="form-check-label d-flex" for="id_type_manual">
                                        Manual
                                    </label>
                                </div>
                                <div class="form-check ms-5">
                                    <input id="id_type_smart" v-model="playlistType" class="form-check-input mt-2" type="radio" name="type" value="smart">
                                    <label class="form-check-label d-flex" for="id_type_smart">
                                        Smart
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <transition name="fade">
                        <div v-if="playlistType === 'smart'">
                            <hr class="mb-1">
                            <div class="form-section">
                                Options
                            </div>
                            <div class="row mt-3">
                                <label class="col-lg-4 form-check-label">Tag</label>
                                <div class="col-lg-8">
                                    <tags-input
                                        id="smart-list-tag"
                                        ref="smartListTag"
                                        :search-url="tagSearchUrl + '&query='"
                                        name="tag"
                                        place-holder="Tag name"
                                        :max-tags="1"
                                    />
                                </div>
                            </div>
                            <div class="row mt-3">
                                <label class="col-lg-4 from-check-label text-nowrap">
                                    Time Period
                                </label>
                                <div class="col-lg-8 d-flex">
                                    <input v-model="startYear" class="form-control me-1" type="number" name="start_year" size="4" placeholder="Start Year" autocomplete="off" :disabled="false">
                                    <input v-model="endYear" class="form-control ms-1" type="number" name="end_year" size="4" placeholder="End Year" autocomplete="off" :disabled="false">
                                </div>
                            </div>
                            <div class="row mt-3">
                                <label class="col-lg-4 from-check-label">Rating</label>
                                <div class="col-lg-8">
                                    <div class="rating-container d-flex" :class="{'d-none': rating === ''}" @mouseleave="handleRatingMouseLeave">
                                        <span
                                            v-for="starCount in Array(5).fill().map((x,i)=>i)"
                                            :key="starCount"
                                            class="rating me-1"
                                            :class="{'rating-star-selected': parseInt(rating, 10) > starCount}"
                                            :data-rating="starCount"
                                            @click="handleSetRating($event, starCount)"
                                            @mouseover="handleRatingMouseOver($event, starCount)"
                                        >
                                            <font-awesome-icon icon="star" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="row mt-3">
                                <label class="col-lg-4 col-form-label">Exclude Recent Listens</label>
                                <div class="col-lg-8">
                                    <select v-model="excludeRecent" class="form-control form-select" name="exclude_recent">
                                        <option v-for="option in excludeRecentOptions" :key="option.value" :value="option.value">
                                            {{ option.display }}
                                        </option>
                                    </select>
                                </div>
                            </div>
                            <div class="row mt-3">
                                <label class="col-lg-4 col-form-label">Exclude Albums</label>
                                <div class="col-lg-8 d-flex align-items-center">
                                    <o-switch v-model="excludeAlbums" name="exclude_albums" :native-value="excludeAlbums" />
                                </div>
                            </div>
                            <input v-if="action === 'Edit'" type="hidden" name="type" :value="playlist.type">
                            <input type="hidden" name="rating" :value="rating">
                            <div v-if="playlistType !== 'manual'">
                                <div class="row mt-3">
                                    <label class="col-lg-4 col-form-label">Sort By</label>
                                    <div class="col-lg-8">
                                        <select class="form-control form-select" name="sort_by">
                                            <option value="recent">
                                                Recently Added
                                            </option>
                                            <option value="random">
                                                Random
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <label class="col-lg-4 col-form-label">Size</label>
                                    <div class="col-lg-8">
                                        <select v-model="size" class="form-control form-select" name="size">
                                            <option v-for="option in sizeOptions" :key="option.value" :value="option.value">
                                                {{ option.display }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <div v-if="action === 'Edit'" class="row mt-3">
                                    <label class="col-lg-4 col-form-label">Refresh Song List</label>
                                    <div class="col-lg-8 d-flex align-items-center">
                                        <o-switch v-model="refreshSongList" name="refresh_song_list" :native-value="refreshSongList" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>
                <div class="modal-footer justify-content-end">
                    <input id="btn-action" class="btn btn-primary" type="submit" name="Go" value="Save" :disabled="disabledCreateButton">
                </div>
            </div>
        </div>
    </div>
</template>

<script>

    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import mouseRating from "/front-end/useMouseRating.js";
    import TagsInput from "/front-end/vue/common/TagsInput.vue";

    export default {
        components: {
            FontAwesomeIcon,
            TagsInput,
        },
        props: {
            tagSearchUrl: {
                default: "",
                type: String,
            },
            action: {
                default: "Create",
                type: String,
            },
            playlist: {
                default: function() {
                },
                type: Object,
            },
        },
        setup(props) {
            const endYear = ref(getAttribute("end_year", undefined));
            const excludeAlbums = ref(getAttribute("exclude_albums", false));
            const excludeRecent = ref(getAttribute("exclude_recent", ""));
            const name = ref(getAttribute("name", ""));
            const note = ref(getAttribute("note", ""));
            const rating = ref(getAttribute("rating", undefined));
            const size = ref(getAttribute("size", 20));
            const playlistType = ref(getAttribute("type", "manual"));
            const startYear = ref(getAttribute("start_year", undefined));
            const tag = ref(getAttribute("tag", ""));
            const refreshSongList = ref(false);

            const {handleRatingMouseLeave, handleRatingMouseOver, setRating} = mouseRating();

            if (tag.value) {
                document.getElementById("initial-tags").textContent = `["${tag.value}"]`;
            } else {
                document.getElementById("initial-tags").textContent = "\"\"";
            }

            // The o-switch widget works with JavaScript true and false data types
            if (excludeAlbums.value == "true") {
                excludeAlbums.value = true;
            }

            const disabledCreateButton = computed(() => {
                return ( (startYear.value && !endYear.value) ||
                    (!startYear.value && endYear.value) ||
                    parseInt(endYear.value) < parseInt(startYear.value));
            });

            function getAttribute(attribute, defaultValue) {
                if (props.playlist) {
                    if (attribute in props.playlist) {
                        return props.playlist[attribute];
                    } else if (attribute in props.playlist.parameters ) {
                        return props.playlist.parameters[attribute];
                    }
                }
                return defaultValue;
            }

            function handleSetRating(event, starCount) {
                setRating(event, {rating: rating.value}, starCount);
                rating.value = starCount + 1;
            };

            function onClickCreate(evt) {
                const modal = new Modal("#modalAdd");
                modal.show();
                window.setTimeout(() => {
                    document.getElementById("id_name").focus();
                }, 500);
            }

            return {
                disabledCreateButton,
                endYear,
                excludeAlbums,
                excludeRecent,
                getAttribute,
                handleRatingMouseLeave,
                handleRatingMouseOver,
                handleSetRating,
                name,
                note,
                onClickCreate,
                rating,
                refreshSongList,
                setRating,
                size,
                playlistType,
                startYear,
                tag,
                fields: [
                    {
                        key: "year",
                    },
                    {
                        key: "artist",
                    },
                    {
                        key: "title",
                    },
                    {
                        key: "length",
                        tdClass: "text-center",
                        thClass: "text-center",
                    },
                ],
                sizeOptions: [
                    {
                        value: "",
                        display: "Unlimited",
                    },
                    {
                        value: 5,
                        display: "5",
                    },
                    {
                        value: 10,
                        display: "10",
                    },
                    {
                        value: 20,
                        display: "20",
                    },
                    {
                        value: 50,
                        display: "50",
                    },
                    {
                        value: 100,
                        display: "100",
                    },
                ],
                excludeRecentOptions: [
                    {
                        value: "",
                        display: "No limit",
                    },
                    {
                        value: 1,
                        display: "Past Day",
                    },
                    {
                        value: 2,
                        display: "Past Two Days",
                    },
                    {
                        value: 3,
                        display: "Past Three Days",
                    },
                    {
                        value: 7,
                        display: "Past Week",
                    },
                    {
                        value: 30,
                        display: "Past Month",
                    },
                    {
                        value: 90,
                        display: "Past 3 Months",
                    },
                ],
            };
        },
    };

</script>
