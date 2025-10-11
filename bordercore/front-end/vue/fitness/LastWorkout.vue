<template>
    <div class="d-flex flex-column h-100">
        <card title="" class="flex-grow-0 backdrop-filter">
            <template #title-slot>
                <div class="card-title text-primary">
                    Last Workout
                </div>
            </template>
            <template #content>
                <div class="mb-4">
                    <div v-if="date">
                        <strong>
                            {{ date }} - {{ interval }} {{ pluralize("day", interval) }} ago
                        </strong>
                    </div>
                    <div v-else>
                        No previous workout found.
                    </div>
                    <canvas v-show="weight[0] > 0" id="last_workout_weights" class="mt-3" />
                    <canvas v-show="duration[0] > 0" id="last_workout_duration" class="mt-3" />
                    <canvas id="last_workout_reps" class="mt-3" />
                </div>
            </template>
        </card>
        <div class="hover-target h-100 mb-3">
            <card id="description" title="" class="z-index-positive position-relative h-100 backdrop-filter">
                <template #content>
                    <div class="d-flex flex-column">
                        <div class="d-flex flex-column">
                            <div class="d-flex">
                                <div class="card-title text-primary">
                                    Description
                                </div>
                                <drop-down-menu :show-on-hover="true">
                                    <template #dropdown>
                                        <li>
                                            <a class="dropdown-item" href="#" @click.prevent="handleNoteAdd()">
                                                <font-awesome-icon icon="pencil-alt" class="text-primary me-3" />
                                                <span v-html="note ? 'Edit' : 'Add'" /> note
                                            </a>
                                        </li>
                                        <li>
                                            <a v-if="note" class="dropdown-item" href="#" @click.prevent="note=''">
                                                <font-awesome-icon icon="trash-alt" class="text-primary me-3" />
                                                Delete note
                                            </a>
                                        </li>
                                        <li>
                                            <a class="dropdown-item" href="#" @click="handleAskChatbot">
                                                <span>
                                                    <font-awesome-icon icon="comment" class="text-primary me-3" />
                                                </span>
                                                Ask ChatBot
                                            </a>
                                        </li>
                                    </template>
                                </drop-down-menu>
                            </div>
                            <div v-html="description" />
                        </div>
                        <hr v-if="description && note" class="m-2">
                        <editable-text-area
                            ref="editableTextArea"
                            v-model="note"
                            extra-class=""
                            :hide-add-button="true"
                        >
                            <template #:title>
                                <div class="card-title text-primary mt-3">
                                    Note
                                </div>
                            </template>
                        </editable-text-area>
                    </div>
                </template>
            </card>
        </div>
    </div>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";
    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import EditableTextArea from "/front-end/vue/common/EditableTextArea.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

    export default {
        components: {
            Card,
            DropDownMenu,
            EditableTextArea,
            FontAwesomeIcon,
        },
        props: {
            date: {
                default: "",
                type: String,
            },
            description: {
                default: "",
                type: String,
            },
            exerciseUuid: {
                default: "",
                type: String,
            },
            initialNote: {
                default: "",
                type: String,
            },
            duration: {
                default: () => [],
                type: Array,
            },
            reps: {
                default: () => [],
                type: Array,
            },
            weight: {
                default: () => [],
                type: Array,
            },
            interval: {
                default: undefined,
                type: Number,
            },
            editNoteUrl: {
                default: "",
                type: String,
            },
        },
        setup(props) {
            const editableTextArea = ref(null);
            const note = ref(props.initialNote);

            const sets = Array.apply(0, Array(props.weight.length)).map(function(_, b) {
                return b + 1;
            });

            const labels = sets.map((x) => `Set ${x}`);

            function createChart(id, data, label) {
                const styles = getComputedStyle(document.body);
                const context = document.getElementById(id).getContext("2d");
                new Chart(context, {
                    type: "bar",
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                backgroundColor: styles.getPropertyValue("--chart-bg"),
                                data: data,
                                label: label,
                            },
                        ],
                    },
                    options: getGraphOptions(label),
                });
            };

            function getGraphOptions(label) {
                const styles = getComputedStyle(document.body);

                return {
                    events: [], // Disable 'on-hover' events
                    borderRadius: "10",
                    animation: {
                        onComplete: function(chartInstance) {
                            const ctx = this.ctx;
                            ctx.textAlign = "center";
                            ctx.textBaseline = "bottom";
                            ctx.fillStyle = styles.getPropertyValue("--chart-fill-color");
                            ctx.font = "bold 24px Arial";
                            this.data.datasets.forEach(function(dataset, i) {
                                const meta = chartInstance.chart.getDatasetMeta(i);
                                meta.data.forEach(function(bar, index) {
                                    const data = dataset.data[index];
                                    ctx.fillText(data, bar.x, bar.y + 40);
                                });
                            });
                        },
                    },
                    plugins: {
                        legend: {
                            display: false,
                        },
                        title: {
                            display: true,
                            text: label,
                            color: styles.getPropertyValue("--chart-title-color"),
                            font: {
                                size: "16px",
                            },
                        },
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: styles.getPropertyValue("--chart-tick-color"),
                            },
                        },
                        y: {
                            ticks: {
                                color: styles.getPropertyValue("--chart-tick-color"),
                            },
                        },
                    },
                };
            };

            function handleAskChatbot() {
                EventBus.$emit("chat", {"exerciseUuid": props.exerciseUuid});
            };

            function handleNoteAdd() {
                editableTextArea.value.editNote(!note.value);
            };

            function handleNoteEdit() {
                doPost(
                    props.editNoteUrl,
                    {
                        "uuid": props.exerciseUuid,
                        "note": note.value,
                    },
                    () => {},
                );
            };

            watch(note, (newValue) => {
                if (newValue !== null) {
                    handleNoteEdit();
                }
            });

            onMounted(() => {
                createChart("last_workout_weights", props.weight, "Weight");
                createChart("last_workout_reps", props.reps, "Reps");
                createChart("last_workout_duration", props.duration, "Duration");

                // Notify the user if a note exists
                if (note.value) {
                    const element = document.querySelector("#description");
                    element.classList.add("animate__animated", "animate__wobble", "animate__delay-1s");
                }
            });

            return {
                editableTextArea,
                handleAskChatbot,
                handleNoteAdd,
                note,
                pluralize,
            };
        },
    };

</script>
