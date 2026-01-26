import React, { useRef, useEffect, useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import Chart from "chart.js/auto";
import Rainbow from "rainbowvis.js";
import { Card } from "../common/Card";
import { doGet } from "../utils/reactUtils";
import type { PlotInfo, PlotType } from "./types";

interface WorkoutGraphProps {
  getWorkoutDataUrl: string;
}

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function WorkoutGraph({ getWorkoutDataUrl }: WorkoutGraphProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [plotInfo, setPlotInfo] = useState<PlotInfo | null>(null);
  const [currentPlotType, setCurrentPlotType] = useState<PlotType>("reps");

  const hasNote = useMemo(() => {
    return plotInfo?.notes?.some((note) => note !== null) ?? false;
  }, [plotInfo]);

  const hasWeight = useMemo(() => {
    return plotInfo?.plot_data && "weight" in plotInfo.plot_data;
  }, [plotInfo]);

  const hasDuration = useMemo(() => {
    return plotInfo?.plot_data && "duration" in plotInfo.plot_data;
  }, [plotInfo]);

  function firstSet(workoutData: number[]): number {
    return workoutData[0];
  }

  function getGradient(numberOfItems: number): string[] | undefined {
    const styles = getComputedStyle(document.body);

    if (numberOfItems <= 1) {
      return undefined;
    }

    const rainbow = new Rainbow();
    rainbow.setNumberRange(1, numberOfItems);
    rainbow.setSpectrum(
      styles.getPropertyValue("--chart-gradient-start").trim(),
      styles.getPropertyValue("--chart-gradient-end").trim()
    );

    const colorArray: string[] = [];
    for (let i = 1; i <= numberOfItems; i++) {
      const hexColour = rainbow.colourAt(i);
      colorArray.push(`#${hexColour}`);
    }
    return colorArray;
  }

  function createChart(data: PlotInfo) {
    if (!chartRef.current) return;

    const scaleYText = capitalizeFirstLetter(currentPlotType);
    const styles = getComputedStyle(document.body);
    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    const gradient = getGradient(data.plot_data[currentPlotType]?.length || 0);

    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.plot_data[currentPlotType]?.map(firstSet) || [],
            barThickness: 40,
            backgroundColor: gradient,
          },
        ],
      },
      options: {
        elements: {
          bar: {
            borderRadius: 10,
          },
        },
        animation: {
          onProgress: function (chartInstance) {
            const ctx = this.ctx;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = styles.getPropertyValue("--chart-fill-color");
            ctx.font = "bold 18px Arial";

            this.data.datasets.forEach(function (dataset, i) {
              const meta = chartInstance.chart.getDatasetMeta(i);
              meta.data.forEach(function (bar, index) {
                const value = dataset.data[index] as number;
                const note = data.notes[index];
                ctx.fillText(value + (note ? "\n*" : ""), bar.x, bar.y + 30);
              });
            });
          },
        },
        plugins: {
          title: { display: false },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label() {
                return null as unknown as string;
              },
              title(tooltipItem) {
                const dataIndex = tooltipItem[0].dataIndex;
                const plotData = data.plot_data[currentPlotType]?.[dataIndex];
                const note = data.notes[dataIndex];
                return `${capitalizeFirstLetter(currentPlotType)}: ${plotData}${note ? `\nNote: ${note}` : ""}`;
              },
            },
            titleMarginBottom: 0,
            titleFont: { size: 18 },
          },
        },
        scales: {
          x: {
            grid: { color: "#21295c" },
            ticks: {
              color: styles.getPropertyValue("--chart-tick-color"),
              font: { family: "Poppins", size: 16 },
            },
          },
          y: {
            grid: { color: "#21295c" },
            title: {
              display: true,
              text: scaleYText,
              color: styles.getPropertyValue("--chart-title-color"),
              font: { family: "Poppins", size: 24 },
            },
            ticks: {
              color: styles.getPropertyValue("--chart-tick-color"),
              font: { family: "Poppins", size: 16 },
            },
          },
        },
        font: { size: 14 },
      },
    });
  }

  function updateChart() {
    if (!chartInstanceRef.current || !plotInfo) return;

    chartInstanceRef.current.data.labels = plotInfo.labels;
    chartInstanceRef.current.data.datasets[0].data =
      plotInfo.plot_data[currentPlotType]?.map(firstSet) || [];
    const styles = getComputedStyle(document.body);
    chartInstanceRef.current.options.scales = {
      ...chartInstanceRef.current.options.scales,
      y: {
        ...chartInstanceRef.current.options.scales?.y,
        title: {
          display: true,
          text: capitalizeFirstLetter(currentPlotType),
          color: styles.getPropertyValue("--chart-title-color"),
          font: { family: "Poppins", size: 24 },
        },
      },
    };
    chartInstanceRef.current.update();
  }

  function paginate(direction: "prev" | "next") {
    const pageNumber =
      plotInfo?.paginator?.[direction === "prev" ? "previous_page_number" : "next_page_number"] ?? 1;

    doGet(
      getWorkoutDataUrl + pageNumber,
      (response) => {
        const wd = response.data.workout_data;
        const newPlotInfo: PlotInfo = {
          labels: wd.labels,
          plot_data: wd.plot_data,
          paginator: wd.paginator,
          notes: wd.notes ?? [],
        };
        setPlotInfo(newPlotInfo);

        if (!chartInstanceRef.current) {
          createChart(newPlotInfo);
        } else {
          chartInstanceRef.current.data.labels = wd.labels;
          chartInstanceRef.current.data.datasets[0].data =
            wd.plot_data[currentPlotType]?.map(firstSet) || [];
          chartInstanceRef.current.update();
        }
      },
      "Error getting workout data"
    );
  }

  function switchPlot(dataset: PlotType) {
    setCurrentPlotType(dataset);
  }

  useEffect(() => {
    paginate("next");
    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (plotInfo && chartInstanceRef.current) {
      updateChart();
    }
  }, [currentPlotType]);

  return (
    <Card cardClassName="flex-grow-0 me-2 pt-3 mb-gutter backdrop-filter" title="">
      <div className="d-flex">
        <div className="d-flex w-100">
          <div className="btn-group" role="group" aria-label="Plot type selection">
            <button
              type="button"
              className={`btn btn-primary ${currentPlotType === "reps" ? "active" : ""}`}
              onClick={() => switchPlot("reps")}
            >
              Reps
            </button>
            {hasWeight && (
              <button
                type="button"
                className={`btn btn-primary ${currentPlotType === "weight" ? "active" : ""}`}
                onClick={() => switchPlot("weight")}
              >
                Weight
              </button>
            )}
            {hasDuration && (
              <button
                type="button"
                className={`btn btn-primary ${currentPlotType === "duration" ? "active" : ""}`}
                onClick={() => switchPlot("duration")}
              >
                Duration
              </button>
            )}
          </div>
          <div className="d-flex justify-content-center w-100">
            <h2 className="fw-semibold">Workout Data</h2>
          </div>
        </div>
        <h5 className="text-nowrap ms-auto">
          {plotInfo?.paginator?.has_previous ? (
            <a href="#" onClick={(e) => { e.preventDefault(); paginate("prev"); }}>
              <FontAwesomeIcon icon={faChevronLeft} className="text-emphasis glow icon-hover" />
            </a>
          ) : (
            <FontAwesomeIcon icon={faChevronLeft} className="text-emphasis icon-disabled" />
          )}
          {plotInfo?.paginator?.has_next ? (
            <a href="#" className="ms-1" onClick={(e) => { e.preventDefault(); paginate("next"); }}>
              <FontAwesomeIcon icon={faChevronRight} className="text-emphasis glow icon-hover" />
            </a>
          ) : (
            <FontAwesomeIcon icon={faChevronRight} className="text-emphasis icon-disabled" />
          )}
        </h5>
      </div>
      <canvas ref={chartRef} id="exercise-detail-chart" className="w-100" />
      {hasNote && <div id="fitness-has-note">* workout note</div>}
    </Card>
  );
}

export default WorkoutGraph;
