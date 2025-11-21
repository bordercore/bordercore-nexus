<template>
    <div v-if="weatherIconType" class="weather-icon" :class="'icon-' + weatherIconType" :aria-label="weatherIconType" data-bs-toggle="tooltip" data-placement="bottom" :title="temperatureText">
        <svg viewBox="0 0 48 48">
            <template v-if="weatherIconType === 'sunny'">
                <g class="sun-rays">
                    <line x1="24" y1="4" x2="24" y2="10" />
                    <line x1="24" y1="38" x2="24" y2="44" />
                    <line x1="4" y1="24" x2="10" y2="24" />
                    <line x1="38" y1="24" x2="44" y2="24" />
                    <line x1="10" y1="10" x2="14" y2="14" />
                    <line x1="34" y1="34" x2="38" y2="38" />
                    <line x1="10" y1="38" x2="14" y2="34" />
                    <line x1="34" y1="14" x2="38" y2="10" />
                </g>
                <circle class="sun-core" cx="24" cy="24" r="8" />
            </template>

            <template v-if="weatherIconType === 'cloudy'">
                <g class="cloud-back">
                    <ellipse cx="18" cy="26" rx="9" ry="6" />
                    <ellipse cx="28" cy="25" rx="10" ry="7" />
                    <ellipse cx="23" cy="22" rx="7" ry="5" />
                    <rect x="14" y="26" width="20" height="6" />
                </g>

                <g class="cloud-front-wrapper">
                    <g transform="translate(10, 6) scale(0.8)">
                        <ellipse cx="18" cy="26" rx="9" ry="6" />
                        <ellipse cx="28" cy="25" rx="10" ry="7" />
                        <ellipse cx="23" cy="22" rx="7" ry="5" />
                        <rect x="14" y="26" width="20" height="6" />
                    </g>
                </g>
            </template>

            <template v-if="weatherIconType === 'rain'">
                <g class="cloud-main">
                    <ellipse cx="18" cy="22" rx="9" ry="6" />
                    <ellipse cx="28" cy="21" rx="10" ry="7" />
                    <ellipse cx="23" cy="18" rx="7" ry="5" />
                    <rect x="14" y="22" width="20" height="6" />
                </g>
                <g transform="translate(0, 6)">
                    <line class="drop" x1="18" y1="24" x2="18" y2="30" />
                    <line class="drop" x1="24" y1="24" x2="24" y2="30" />
                    <line class="drop" x1="30" y1="24" x2="30" y2="30" />
                </g>
            </template>

            <template v-if="weatherIconType === 'snow'">
                <g class="cloud-main">
                    <ellipse cx="18" cy="22" rx="9" ry="6" />
                    <ellipse cx="28" cy="21" rx="10" ry="7" />
                    <ellipse cx="23" cy="18" rx="7" ry="5" />
                    <rect x="14" y="22" width="20" height="6" />
                </g>
                <g transform="translate(0, 7)">
                    <circle class="flake" cx="18" cy="24" r="1.4" />
                    <circle class="flake" cx="24" cy="26" r="1.4" />
                    <circle class="flake" cx="30" cy="24" r="1.4" />
                </g>
            </template>
        </svg>
    </div>
</template>

<script>

    export default {
        name: "Weather",
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
    :root {
        --sun-core: #ffffff;
        --sun-ray: #ffffff;
        --cloud: #ffffff;
        --rain: #ffffff;
        --snow: #ffffff;
    }

    .weather-icon {
        width: 64px;
        height: 64px;
        display: inline-flex;
        justify-content: center;
        align-items: center;
    }

    .weather-icon svg {
        width: 48px;
        height: 48px;
        overflow: visible;
        fill: #ffffff;
        stroke: #ffffff;
    }

    /* Animations */

    @keyframes spin-slow {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @keyframes float-soft {
        0%   { transform: translateX(0px); }
        50%  { transform: translateX(2px); }
        100% { transform: translateX(0px); }
    }

    /* NEW: Side to side motion for the front cloud */
    @keyframes pass-by {
        0%   { transform: translateX(-4px); }
        100% { transform: translateX(4px); }
    }

    @keyframes rain-fall {
        0%   { transform: translateY(-2px); opacity: 0; }
        10%  { opacity: 1; }
        100% { transform: translateY(10px); opacity: 0; }
    }

    @keyframes snow-fall {
        0%   { transform: translate(0px, -3px); opacity: 0; }
        15%  { opacity: 1; }
        100% { transform: translate(2px, 10px); opacity: 0; }
    }

    /* Sunny */

    .icon-sunny .sun-core {
        fill: var(--sun-core);
    }

    .icon-sunny .sun-rays {
        fill: none;
        stroke: var(--sun-ray);
        stroke-width: 2.3;
        stroke-linecap: round;
        transform-origin: 24px 24px;
        animation: spin-slow 24s linear infinite;
    }

    /* Cloudy (UPDATED) */

    .icon-cloudy .cloud-back {
        fill: var(--cloud);
        /* Make the back cloud semi-transparent so the front one pops */
        opacity: 0.4;
        /* Subtle float for the background */
        animation: float-soft 6s ease-in-out infinite reverse;
    }

    .icon-cloudy .cloud-front-wrapper {
        fill: var(--cloud);
        /* The small cloud is fully opaque */
        opacity: 1;
        /* Move back and forth */
        animation: pass-by 4s ease-in-out infinite alternate;
    }

    /* Rain */

    .icon-rain .cloud-main {
        fill: var(--cloud);
        animation: float-soft 6s ease-in-out infinite;
    }

    .icon-rain .drop {
        fill: none;
        stroke: var(--rain);
        stroke-width: 2;
        stroke-linecap: round;
        animation: rain-fall 1.3s linear infinite;
    }

    .icon-rain .drop:nth-child(2) {
        animation-delay: 0.2s;
    }

    .icon-rain .drop:nth-child(3) {
        animation-delay: 0.4s;
    }

    /* Snow */

    .icon-snow {
        animation: float-soft 8s ease-in-out infinite;
    }

    .icon-snow .cloud-main {
        fill: var(--cloud);
    }

    .icon-snow .flake {
        fill: var(--snow);
        animation: snow-fall 2.5s linear infinite;
    }

    .icon-snow .flake:nth-child(2) {
        animation-delay: 0.4s;
    }

    .icon-snow .flake:nth-child(3) {
        animation-delay: 0.8s;
    }
</style>
