<template>
    <div
        v-if="weatherIconType"
        class="weather-icon"
        :class="'icon-' + weatherIconType"
        :aria-label="weatherIconType"
        data-bs-toggle="tooltip"
        data-placement="bottom"
        :title="temperatureText"
    >
        <Vue3Lottie
            :animationData="animationData"
            :height="64"
            :width="64"
            :loop="true"
            :autoplay="true"
        />
    </div>
</template>

<script>
    import {Vue3Lottie} from "vue3-lottie";
    import clearDayAnimation from "../../assets/weather-icons/clear-day.json";
    import partlyCloudyDayAnimation from "../../assets/weather-icons/partly-cloudy-day.json";
    import overcastRainAnimation from "../../assets/weather-icons/overcast-rain.json";
    import snowAnimation from "../../assets/weather-icons/snow.json";

    export default {
        name: "Weather",
        components: {
            Vue3Lottie,
        },
        props: {
            weatherInfo: {
                type: Object,
                default: null,
            },
        },
        computed: {
            weatherIconType() {
                if (!this.weatherInfo || !this.weatherInfo.current || !this.weatherInfo.current.condition) {
                    return null;
                }

                const conditionText = this.weatherInfo.current.condition.text.toLowerCase();

                // Map weather conditions to icon types
                if (conditionText.includes("sunny") || conditionText.includes("clear")) {
                    return "sunny";
                } else if (conditionText.includes("rain") || conditionText.includes("drizzle") || conditionText.includes("shower")) {
                    return "rain";
                } else if (conditionText.includes("snow") || conditionText.includes("blizzard") || conditionText.includes("sleet")) {
                    return "snow";
                } else if (conditionText.includes("cloud") || conditionText.includes("overcast") || conditionText.includes("fog") || conditionText.includes("mist")) {
                    return "cloudy";
                }

                // Default to cloudy if condition doesn't match
                return "cloudy";
            },
            animationData() {
                const animations = {
                    "sunny": clearDayAnimation,
                    "cloudy": partlyCloudyDayAnimation,
                    "rain": overcastRainAnimation,
                    "snow": snowAnimation,
                };
                return animations[this.weatherIconType] || partlyCloudyDayAnimation;
            },
            temperatureText() {
                if (!this.weatherInfo || !this.weatherInfo.current || this.weatherInfo.current.temp_f === undefined) {
                    return "";
                }
                return `Temperature: ${this.weatherInfo.current.temp_f}° F`;
            },
        },
        mounted() {
            // Initialize Bootstrap tooltip for dynamically mounted component
            if (this.weatherIconType && this.temperatureText && window.BootstrapTooltip) {
                this.$nextTick(() => {
                    new window.BootstrapTooltip(this.$el);
                });
            }
        },
        beforeUnmount() {
            // Clean up tooltip instance to prevent memory leaks
            if (this.$el && this.$el._tooltip) {
                this.$el._tooltip.dispose();
            }
        },
    };
</script>

<style scoped>
.weather-icon {
    width: 64px;
    height: 64px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
}
</style>
