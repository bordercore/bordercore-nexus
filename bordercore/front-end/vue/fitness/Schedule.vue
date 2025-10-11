<template>
    <div>
        <div id="modalSwitchExercise" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 id="myModalLabel" class="modal-title">
                            Switch Exercise
                        </h4>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3 text-primary">
                            <small>
                                Selecting an exercise from the list below will make it <em>active</em> and make the exercise <strong>{{ exerciseName }}</strong> <em>inactive</em>.
                            </small>
                        </div>
                        <o-table
                            :data="exerciseStore.relatedExercises"
                            :columns="relatedExercisesFields"
                            hoverable
                            @click="handleSelectRelatedExercise"
                        >
                            <template #empty>
                                <div class="text-center">
                                    No related exercises
                                </div>
                            </template>
                        </o-table>
                    </div>
                </div>
            </div>
        </div>
        <div id="modalChangeSchedule" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 id="myModalLabel" class="modal-title">
                            Change Exercise Schedule
                        </h4>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="d-flex">
                            <div class="text-nowrap">Workout every</div>
                            <div class="ms-3">
                                <div v-for="(day, index) in daysOfTheWeek" :key="index" class="d-flex">
                                    <div id="fitness-schedule-d-o-t-w" class="text-info me-2">
                                        {{ day }}
                                    </div>
                                    <div class="d-flex align-items-center">
                                        <o-switch v-model="exerciseStore.activityInfo.schedule[index]" />
                                    </div>
                                </div>
                            </div>
                            <div class="ms-5 mt-2">
                                <button type="button" class="btn btn-primary" @click="handleScheduleChange">
                                    Change
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div :class="{'hover-target': exerciseStore.activityInfo}">
            <card title="" class="z-index-positive flex-grow-0 position-relative backdrop-filter">
                <template #content>
                    <div class="d-flex flex-column">
                        <div v-if="isActive" class="mb-2 d-flex flex-column">
                            <div class="d-flex">
                                <div class="item-name">
                                    Started
                                </div>
                                <div class="item-value d-flex flex-column ms-2">
                                    <div>
                                        <strong>
                                            {{ exerciseStore.activityInfo.started }}
                                        </strong>
                                    </div>
                                    <div>
                                        <span class="text-small ms-1">
                                            {{ exerciseStore.activityInfo.relative_date }}
                                        </span>
                                    </div>
                                </div>
                                <drop-down-menu :show-on-hover="true">
                                    <template #dropdown>
                                        <li>
                                            <a class="dropdown-item" href="#" @click.prevent="openModal('#modalSwitchExercise')">
                                                <font-awesome-icon icon="exchange-alt" class="text-primary me-3" />Switch Exercise
                                            </a>
                                        </li>
                                        <li>
                                            <a class="dropdown-item" href="#" @click.prevent="openModal('#modalChangeSchedule')">
                                                <font-awesome-icon icon="calendar-alt" class="text-primary me-3" />Change Schedule
                                            </a>
                                        </li>
                                    </template>
                                </drop-down-menu>
                            </div>
                            <hr class="m-2">
                            <div class="d-flex">
                                <div class="item-name">
                                    Schedule
                                </div>
                                <div class="item-value fw-bold ms-2">
                                    <div v-if="scheduleDays">
                                        every {{ scheduleDays }}
                                    </div>
                                    <div v-else>
                                        Not scheduled
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-else>
                            Exercise not active.
                        </div>
                        <div class="mt-3">
                            <button v-cloak type="submit" class="btn btn-primary" @click="handleStatusChange">
                                <font-awesome-icon v-if="isActive" icon="check" class="me-2" />{{ activeButtonValue }}
                            </button>
                        </div>
                    </div>
                </template>
            </card>
        </div>
    </div>
</template>


<script>

    import Card from "/front-end/vue/common/Card.vue";
    import DropDownMenu from "/front-end/vue/common/DropDownMenu.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
    import {useExerciseStore} from "/front-end/vue/stores/ExerciseStore.js";

    export default {
        components: {
            Card,
            DropDownMenu,
            FontAwesomeIcon,
        },
        props: {
            changeActiveStatusUrl: {
                default: "",
                type: String,
            },
            exerciseName: {
                default: "",
                type: String,
            },
            editScheduleUrl: {
                default: "",
                type: String,
            },
        },
        setup(props) {
            const exerciseStore = useExerciseStore();
            const isActive = ref(exerciseStore.activityInfo.started ? true : false);

            const daysOfTheWeek = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ];

            const relatedExercisesFields = [
                {
                    field: "name",
                    label: "Exercise",
                },
                {
                    field: "last_active",
                    label: "Last Active",
                },
            ];

            function openModal(id) {
                const modal = new Modal(id);
                modal.show();
            };

            function handleScheduleChange() {
                doPost(
                    props.editScheduleUrl,
                    {
                        "uuid": exerciseStore.uuid,
                        "schedule": exerciseStore.activityInfo.schedule,
                    }
                    ,
                    () => {
                        const modal = Modal.getInstance(document.getElementById("modalChangeSchedule"));
                        modal.hide();
                        EventBus.$emit(
                            "toast",
                            {
                                "body": `Exercise schedule changed to ${scheduleDays.value}`,
                            },
                        );
                    },
                );
            };

            function handleSelectRelatedExercise(event) {
                const uuid = event.uuid;
                const name = event.name;
                doPost(
                    props.changeActiveStatusUrl,
                    {
                        "uuid": uuid,
                        "remove": false,
                    },
                    () => {
                        const modal = Modal.getInstance(document.getElementById("modalSwitchExercise"));
                        modal.hide();
                        EventBus.$emit(
                            "toast",
                            {
                                "body": `Exercise '${name}' added to active list`,
                            },
                        );

                        doPost(
                            props.changeActiveStatusUrl,
                            {
                                "uuid": exerciseStore.uuid,
                                "remove": true,
                            },
                            () => {
                                isActive.value = false;
                                EventBus.$emit(
                                    "toast",
                                    {
                                        "body": `Exercise '${props.exerciseName}' is now inactive`,
                                    },
                                );
                            },
                        );
                    },
                );
            };

            function handleStatusChange() {
                const payload = {
                    "remove": isActive.value,
                    "uuid": exerciseStore.uuid,
                };
                doPost(
                    props.changeActiveStatusUrl,
                    payload,
                    (response) => {
                        isActive.value = !isActive.value;
                        exerciseStore.activityInfo = response.data.info;
                    },
                );
            };

            const scheduleDays = computed(() => {
                const schedule = exerciseStore.activityInfo.schedule;
                const days = [];

                // JavaScript's Date object starts from Sunday as 0
                const baseDate = new Date(2023, 0, 2); // January is 0 in JavaScript

                for (let index = 0; index < schedule.length; index++) {
                    if (schedule[index]) {
                        // Clone the base date and add the index days to it
                        const targetDate = new Date(baseDate.getTime());
                        targetDate.setDate(targetDate.getDate() + index);
                        // Get the day name
                        days.push(targetDate.toLocaleString("en-US", {weekday: "long"}));
                    }
                }

                return days.join(" and ");
            });

            const activeButtonValue = computed(() => {
                return isActive.value ? "Active" : "Activate Exercise";
            });

            return {
                activeButtonValue,
                daysOfTheWeek,
                exerciseStore,
                handleScheduleChange,
                handleSelectRelatedExercise,
                handleStatusChange,
                isActive,
                openModal,
                relatedExercisesFields,
                scheduleDays,
            };
        },
    };

</script>
