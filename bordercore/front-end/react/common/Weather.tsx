import React, { useEffect, useRef } from "react";
import Lottie from "lottie-react";
import clearDayAnimation from "../../assets/weather-icons/clear-day.json";
import partlyCloudyDayAnimation from "../../assets/weather-icons/partly-cloudy-day.json";
import overcastRainAnimation from "../../assets/weather-icons/overcast-rain.json";
import snowAnimation from "../../assets/weather-icons/snow.json";

interface WeatherInfo {
  current?: {
    condition?: {
      text?: string;
    };
    temp_f?: number;
  };
}

interface WeatherProps {
  weatherInfo: WeatherInfo | null;
}

export function Weather({ weatherInfo }: WeatherProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  const getWeatherIconType = (): string | null => {
    if (!weatherInfo || !weatherInfo.current || !weatherInfo.current.condition) {
      return null;
    }

    const conditionText = weatherInfo.current.condition.text?.toLowerCase() || "";

    if (conditionText.includes("sunny") || conditionText.includes("clear")) {
      return "sunny";
    } else if (
      conditionText.includes("rain") ||
      conditionText.includes("drizzle") ||
      conditionText.includes("shower")
    ) {
      return "rain";
    } else if (
      conditionText.includes("snow") ||
      conditionText.includes("blizzard") ||
      conditionText.includes("sleet")
    ) {
      return "snow";
    } else if (
      conditionText.includes("cloud") ||
      conditionText.includes("overcast") ||
      conditionText.includes("fog") ||
      conditionText.includes("mist")
    ) {
      return "cloudy";
    }

    return "cloudy";
  };

  const getAnimationData = () => {
    const iconType = getWeatherIconType();
    const animations: Record<string, any> = {
      sunny: clearDayAnimation,
      cloudy: partlyCloudyDayAnimation,
      rain: overcastRainAnimation,
      snow: snowAnimation,
    };
    return animations[iconType || "cloudy"] || partlyCloudyDayAnimation;
  };

  const getTemperatureText = (): string => {
    if (!weatherInfo || !weatherInfo.current || weatherInfo.current.temp_f === undefined) {
      return "";
    }
    return `Temperature: ${weatherInfo.current.temp_f}° F`;
  };

  const weatherIconType = getWeatherIconType();
  const temperatureText = getTemperatureText();

  useEffect(() => {
    if (
      weatherIconType &&
      temperatureText &&
      tooltipRef.current &&
      (window as any).BootstrapTooltip
    ) {
      const tooltip = new (window as any).BootstrapTooltip(tooltipRef.current);
      return () => {
        if (tooltip) {
          tooltip.dispose();
        }
      };
    }
  }, [weatherIconType, temperatureText]);

  if (!weatherIconType) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className={`weather-icon icon-${weatherIconType}`}
      aria-label={weatherIconType}
      data-bs-toggle="tooltip"
      data-placement="bottom"
      title={temperatureText}
    >
      <Lottie animationData={getAnimationData()} className="weather-lottie" loop={true} />
    </div>
  );
}

export default Weather;
