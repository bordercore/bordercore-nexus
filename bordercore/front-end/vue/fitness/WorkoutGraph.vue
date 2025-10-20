<template>
    <card title="" class="flex-grow-0 me-2 pt-3 backdrop-filter">
        <template #content>
            <div class="d-flex">
                <div>
                    <div class="btn-group" role="group" aria-label="Basic example">
                        <button type="button" class="btn btn-primary" :class="{'active': currentPlotType === 'reps' }" @click="switchPlot('reps')">
                            Reps
                        </button>
                        <button v-if="plotInfo?.plot_data && 'weight' in plotInfo.plot_data" type="button" class="btn btn-primary" :class="{'active': currentPlotType === 'weight' }" @click="switchPlot('weight')">
                            Weight
                        </button>
                        <button v-if="plotInfo?.plot_data && 'duration' in plotInfo.plot_data" type="button" class="btn btn-primary" :class="{'active': currentPlotType === 'duration' }" @click="switchPlot('duration')">
                            Duration
                        </button>
                    </div>
                </div>
                <h5 class="ms-auto">
                    <a v-if="plotInfo && plotInfo.paginator.has_previous" href="#" @click.prevent="paginate('prev')">
                        <font-awesome-icon icon="chevron-left" class="text-emphasis glow icon-hover" />
                    </a>
                    <span v-else>
                        <font-awesome-icon icon="chevron-left" class="text-emphasis icon-disabled" />
                    </span>
                    <a v-if="plotInfo && plotInfo.paginator.has_next" href="#" class="ms-1" @click.prevent="paginate('next')">
                        <font-awesome-icon icon="chevron-right" class="text-emphasis glow icon-hover" />
                    </a>
                    <span v-else>
                        <font-awesome-icon icon="chevron-right" class="text-emphasis icon-disabled" />
                    </span>
                </h5>
            </div>
            <canvas id="exercise-detail-chart" class="w-100" />
            <div v-if="hasNote" id="fitness-has-note">
                * workout note
            </div>
        </template>
    </card>
</template>

<script>

    import {capitalizeFirstLetter} from "/front-end/util.js";
    import Card from "/front-end/vue/common/Card.vue";
    import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

    export default {
        components: {
            Card,
            FontAwesomeIcon,
        },
        props: {
            date: {
                default: "",
                type: String,
            },
            getWorkoutDataUrl: {
                default: "",
                type: String,
            },
        },
        setup(props) {
            const currentPlotType = ref("reps");
            let myChart = null;
            const plotInfo = ref(null);
            const hasNote = computed(() => {
                return plotInfo.value && plotInfo.value.notes.filter((x) => x !== null).length > 0;
            });

            function firstSet(workoutData) {
                return workoutData[0];
            }

            function getGradient(numberOfItems) {
                const styles = getComputedStyle(document.body);

                if (numberOfItems <= 1) {
                    return;
                }

                // The Rainbow object is from the RainbowVis-JS package
                const rainbow = new Rainbow();
                rainbow.setNumberRange(1, numberOfItems);
                // Use trim() to remove the whitespace preceding the CSS property value
                rainbow.setSpectrum(styles.getPropertyValue("--chart-gradient-start").trim(), styles.getPropertyValue("--chart-gradient-end").trim());

                const colorArray = [];
                for (let i = 1; i <= numberOfItems; i++) {
                    const hexColour = rainbow.colourAt(i);
                    colorArray.push(`#${hexColour}`);
                }
                return colorArray;
            };

            function paginate(direction) {
                const pageNumber =
                    plotInfo.value?.paginator?.[direction === "prev" ? "previous_page_number" : "next_page_number"] ?? 1;

                doGet(
                    props.getWorkoutDataUrl + pageNumber,
                    (response) => {
                        const wd = response.data.workout_data;
                        plotInfo.value = {
                            labels: wd.labels,
                            plot_data: wd.plot_data,
                            paginator: wd.paginator,
                            notes: wd.notes ?? [],
                        };

                        if (!myChart) {
                            createChart();
                            return;
                        }

                        myChart.data.labels = response.data.workout_data.labels;
                        myChart.data.datasets[0].data = response.data.workout_data.plot_data[currentPlotType.value].map(firstSet);
                        myChart.update();
                        plotInfo.value.paginator = response.data.workout_data.paginator;
                    },
                    "Error getting workout data",
                );
            };

            function switchPlot(dataset) {
                currentPlotType.value = dataset;
                myChart.data.datasets[0].data = plotInfo.value.plot_data[dataset].map(firstSet);
                myChart.options.scales.y.title.text = capitalizeFirstLetter(dataset);
                myChart.update();
            };

            function createChart() {
                const scaleYText = capitalizeFirstLetter(currentPlotType.value);
                const styles = getComputedStyle(document.body);
                const ctx = document.getElementById("exercise-detail-chart").getContext("2d");

                myChart = new Chart(ctx, {
                    type: "bar",
                    data: {
                        labels: plotInfo.value.labels,
                        datasets: [
                            {
                                data: plotInfo.value.plot_data[currentPlotType.value].map(firstSet),
                                barThickness: 40,
                                backgroundColor: function(context) {
                                    const chart = context.chart;
                                    const {ctx, chartArea} = chart;

                                    if (!chartArea) {
                                        // This case happens on initial chart load
                                        return;
                                    }
                                    return getGradient(plotInfo.value.plot_data[currentPlotType.value].length);
                                },
                            },
                        ],
                    },
                    options: {
                        borderRadius: 10,
                        animation: {
                            onProgress: function(chartInstance) {
                                const ctx = this.ctx;
                                ctx.textAlign = "center";
                                ctx.textBaseline = "bottom";
                                ctx.fillStyle = styles.getPropertyValue("--chart-fill-color");
                                ctx.font="bold 18px Arial";

                                this.data.datasets.forEach(function(dataset, i) {
                                    const meta = chartInstance.chart.getDatasetMeta(i);
                                    meta.data.forEach(function(bar, index) {
                                        const data = dataset.data[index];
                                        const note = plotInfo.value.notes[index];
                                        ctx.fillText(data + (note ? "\n*" : ""), bar.x, bar.y + 30);
                                    });
                                });
                            },
                        },
                        plugins: {
                            title: {
                                display: true,
                                text: "Workout Data",
                                color: styles.getPropertyValue("--chart-title-color"),
                                font: {
                                    family: "Lato",
                                    size: 48,
                                    weight: "normal",
                                },
                            },
                            legend: {
                                display: false,
                            },
                            tooltip: {
                                callbacks: {
                                    label(tooltipItem) {
                                        return null;
                                    },
                                    title(tooltipItem) {
                                        const data = plotInfo.value.plot_data[currentPlotType.value][tooltipItem[0].dataIndex];
                                        const note = plotInfo.value.notes[tooltipItem[0].dataIndex];
                                        return `${capitalizeFirstLetter(currentPlotType.value)}: ${data}` + (note ? `\nNote: ${note}` : "");
                                    },
                                },
                                titleMarginBottom: 0,
                                titleFont: {
                                    size: 18,
                                },
                            },
                        },
                        scales: {
                            x: {
                                grid: {
                                    color: "#21295c",
                                },
                                ticks: {
                                    color: styles.getPropertyValue("--chart-tick-color"),
                                    font: {
                                        family: "Poppins",
                                        size: 16,
                                    },
                                },
                            },
                            y: {
                                grid: {
                                    color: "#21295c",
                                },
                                title: {
                                    display: true,
                                    text: scaleYText,
                                    color: styles.getPropertyValue("--chart-title-color"),
                                    font: {
                                        family: "Poppins",
                                        size: 24,
                                    },
                                },
                                ticks: {
                                    color: styles.getPropertyValue("--chart-tick-color"),
                                    font: {
                                        family: "Poppins",
                                        size: 16,
                                    },
                                },
                            },
                        },
                        font: {
                            size: 14,
                        },
                    },
                });
            };

            onMounted(() => {
                paginate("next");
            });

            return {
                currentPlotType,
                hasNote,
                paginate,
                plotInfo,
                switchPlot,
            };
        },
    };

</script>
