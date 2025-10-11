<template>
    <card title="" class="w-50 backdrop-filter">
        <template #title-slot>
            <div class="card-title text-primary">
                New Workout Data
            </div>
        </template>
        <template #content>
            <form id="form-workout" class="form-inline" :action="addWorkoutUrl" method="post">
                <input type="hidden" name="workout-data" :value="workoutDataJson">
                <input type="hidden" name="csrfmiddlewaretoken" :value="csrfToken">
                <div class="d-flex">
                    <div class="w-50">
                        <div v-if="hasWeight" class="d-flex align-items-center my-2">
                            <label class="fitness-col-new-workout-data flex-shrink-0">Weight</label>
                            <input v-model="weight" class="form-control" type="text" name="weight" size="3" autocomplete="off">
                        </div>

                        <div v-if="hasDuration" class="d-flex align-items-center my-2">
                            <label class="fitness-col-new-workout-data flex-shrink-0">Duration</label>
                            <input v-model="duration" class="form-control" type="text" name="duration" size="3" autocomplete="off">
                        </div>

                        <div class="d-flex align-items-center my-2">
                            <label class="fitness-col-new-workout-data flex-shrink-0">Reps</label>
                            <input v-model="reps" class="form-control" type="text" name="reps" size="3" autocomplete="off">
                        </div>
                    </div>
                    <div class="my-2">
                        <input class="btn btn-secondary ms-4" type="button" name="Go" value="Save" :disabled="addIsDisabled" @click="handleSaveWorkoutData">
                        <input id="btn-submit" class="btn btn-primary ms-3" :class="{'d-none': submitIsHidden}" type="submit" name="Go" value="Submit">
                    </div>
                </div>
                <div class="d-flex align-items-center mb-2">
                    <label class="fitness-col-new-workout-data flex-shrink-0">Note</label>
                    <input class="form-control" type="text" name="note" autocomplete="off">
                </div>
            </form>
            <div class="row justify-content-center align-items-center">
                <div class="col-lg-12">
                    <hr>
                    <o-table
                        :data="items"
                        class="w-75 mx-auto"
                    >
                        <o-table-column
                            v-if="hasWeight"
                            v-slot="props"
                            field="weight"
                            label="Weight"
                            :td-attrs="() => ({ class: 'text-center w-50' })"
                            :th-attrs="() => ({ class: 'text-center cursor-pointer ps-4' })"
                        >
                            <input v-if="items[props.row.index - 1].isEdit && selectedCell === 'weight'" v-model="items[props.row.index - 1].weight" type="number" class="form-control text-center" size="3" @blur="onBlur(props.row.index - 1)">
                            <span v-else @click="editCellHandler(props.row.index - 1, 'weight')">
                                {{ props.row.weight }}
                            </span>
                        </o-table-column>

                        <o-table-column
                            v-if="hasDuration"
                            v-slot="props"
                            field="duration"
                            label="Duration"
                            :td-attrs="() => ({ class: 'text-center w-50' })"
                            :th-attrs="() => ({ class: 'text-center cursor-pointer ps-4' })"
                        >
                            <input v-if="items[props.row.index - 1].isEdit && selectedCell === 'duration'" v-model="items[props.row.index - 1].duration" type="number" class="form-control text-center" size="3" @blur="onBlur(props.row.index - 1)">
                            <span v-else @click="editCellHandler(props.row.index - 1, 'duration')">
                                {{ props.row.duration }}
                            </span>
                        </o-table-column>

                        <o-table-column
                            v-slot="props"
                            field="reps"
                            label="Reps"
                            :td-attrs="() => ({ class: 'text-center w-50' })"
                            :th-attrs="() => ({ class: 'text-center cursor-pointer ps-4' })"
                        >
                            <input v-if="items[props.row.index - 1].isEdit && selectedCell === 'reps'" v-model="items[props.row.index - 1].reps" type="number" class="form-control text-center" size="3" @blur="onBlur(props.row.index - 1)">
                            <span v-else @click="editCellHandler(props.row.index - 1, 'reps')">
                                {{ props.row.reps }}
                            </span>
                        </o-table-column>

                        <template #empty>
                            <div class="text-center">
                                No workout data
                            </div>
                        </template>
                    </o-table>
                </div>
            </div>
        </template>
    </card>
</template>

<script>

    import Card from "/front-end/vue/common/Card.vue";

    export default {
        components: {
            Card,
        },
        props: {
            csrfToken: {
                default: null,
                type: String,
            },
            initialWeight: {
                default: null,
                type: String,
            },
            initialReps: {
                default: null,
                type: String,
            },
            initialDuration: {
                default: null,
                type: String,
            },
            addWorkoutUrl: {
                default: "",
                type: String,
            },
            hasWeight: {
                default: true,
                type: Boolean,
            },
            hasDuration: {
                default: true,
                type: Boolean,
            },
        },
        setup(props) {
            const weight = ref(props.initialWeight);
            const reps = ref(props.initialReps);
            const duration = ref(props.initialDuration);
            const items = ref([]);
            const selectedCell = ref("");
            const setCount = ref(0);

            const workoutDataJson = computed(() => {
                return JSON.stringify(items.value);
            });

            const submitIsHidden = computed(() => {
                return items.value.length === 0;
            });

            const addIsDisabled = computed(() => {
                return weight == 0 && duration == 0 && reps == 0;
            });

            function onBlur(index) {
                items.value[index].isEdit = false;
            };

            function handleSaveWorkoutData(evt) {
                setCount.value += 1;
                items.value.push(
                    {
                        "index": setCount.value,
                        "weight": weight.value,
                        "duration": duration.value,
                        "reps": reps.value,
                    },
                );
            };

            function editCellHandler(index, name) {
                items.value = items.value.map((item) => ({...item, isEdit: false}));
                items.value[index].isEdit = true;
                selectedCell.value = name;
            };

            return {
                addIsDisabled,
                duration,
                editCellHandler,
                items,
                handleSaveWorkoutData,
                onBlur,
                reps,
                selectedCell,
                setCount,
                submitIsHidden,
                weight,
                workoutDataJson,
            };
        },
    };

</script>
