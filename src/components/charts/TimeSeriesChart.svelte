<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import * as echarts from 'echarts';

  export let selectedDate: string = format(new Date(), 'yyyy-MM-dd');

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';
  let resizeObserver: ResizeObserver;

  interface HourlyData {
    hour: string;
    appName: string;
    duration: number;
  }

  async function fetchAndRenderChart() {
    try {
      loading = true;
      const response = await fetch(`/api?endpoint=hourly&date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: HourlyData[] = await response.json();

      // Process data for ECharts
      // Group by app and create time series
      const appMap = new Map<string, Map<string, number>>();

      data.forEach((item) => {
        if (!appMap.has(item.appName)) {
          appMap.set(item.appName, new Map());
        }
        appMap.get(item.appName)!.set(item.hour, item.duration);
      });

      // Get unique hours
      const hours = Array.from(new Set(data.map((d) => d.hour))).sort();

      // Get top 5 apps by total duration
      const appTotals = Array.from(appMap.entries())
        .map(([app, hourMap]) => ({
          app,
          total: Array.from(hourMap.values()).reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Create series data
      const series = appTotals.map(({ app }) => ({
        name: app,
        type: 'line',
        smooth: true,
        data: hours.map((hour) => {
          const duration = appMap.get(app)?.get(hour) || 0;
          return Math.round(duration / 60); // Convert to minutes
        }),
      }));

      // Initialize or update chart
      if (!chart) {
        chart = echarts.init(chartContainer);
      }

      chart.setOption({
        title: {
          text: 'Application Usage',
          left: 'center',
          top: 10,
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            let result = `${params[0].axisValue}<br/>`;
            params.forEach((param: any) => {
              result += `${param.marker} ${param.seriesName}: ${param.value} min<br/>`;
            });
            return result;
          },
        },
        legend: {
          top: 40,
          data: appTotals.map((a) => a.app),
        },
        grid: {
          left: '60px',
          right: '20px',
          bottom: '60px',
          top: '100px',
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: hours,
          name: 'Time',
          nameLocation: 'middle',
          nameGap: 35,
          axisLabel: {
            rotate: 45,
            formatter: (value: string) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
            },
          },
        },
        yAxis: {
          type: 'value',
          name: 'Duration (minutes)',
          nameLocation: 'middle',
          nameGap: 40,
        },
        series,
      });

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load chart';
      loading = false;
    }
  }

  $: if (selectedDate) {
    fetchAndRenderChart();
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });
    resizeObserver.observe(chartContainer);

    return () => {
      resizeObserver.disconnect();
      chart?.dispose();
    };
  });
</script>

<div class="w-full h-full relative">
  <!-- Chart container - always rendered -->
  <div bind:this={chartContainer} class="w-full h-96"></div>

  <!-- Loading overlay -->
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  <!-- Error overlay -->
  {#if error}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
      <div class="alert alert-error">
        <span>{error}</span>
      </div>
    </div>
  {/if}
</div>
