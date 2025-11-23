<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let daysBack: number = 7;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';

  interface HourlyData {
    hour: string;
    appName: string;
    duration: number;
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api/activity/hourly?days=${daysBack}`);
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

      // Initialize chart (container is always rendered)
      chart = echarts.init(chartContainer);
      chart.setOption({
        title: {
          text: 'Application Usage by Hour',
          left: 'center',
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
          top: 30,
          data: appTotals.map((a) => a.app),
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: hours,
          axisLabel: {
            rotate: 45,
            formatter: (value: string) => {
              // Format to show date and hour
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
            },
          },
        },
        yAxis: {
          type: 'value',
          name: 'Minutes',
        },
        series,
      });

      loading = false;

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        chart?.resize();
      });
      resizeObserver.observe(chartContainer);

      return () => {
        resizeObserver.disconnect();
        chart?.dispose();
      };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load chart';
      loading = false;
    }
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
