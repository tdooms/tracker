<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let daysBack: number = 30;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';

  interface DailyData {
    date: string;
    totalActive: number;
    productive: number;
    category: 'productive' | 'neutral' | 'idle';
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api/activity/heatmap?days=${daysBack}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: DailyData[] = await response.json();

      // Prepare data for calendar heatmap
      const heatmapData = data.map((item) => {
        const hours = Math.round(item.totalActive / 3600);
        return [item.date, hours];
      });

      // Get date range
      const dates = data.map((d) => d.date).sort();
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];

      // Initialize chart (container is always rendered)
      chart = echarts.init(chartContainer);
      chart.setOption({
        title: {
          text: 'Daily Activity Heatmap',
          left: 'center',
        },
        tooltip: {
          formatter: (params: any) => {
            const hours = params.value[1];
            return `${params.value[0]}<br/>${hours} hours active`;
          },
        },
        visualMap: {
          min: 0,
          max: 12,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 20,
          inRange: {
            color: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
          },
          text: ['High', 'Low'],
        },
        calendar: {
          top: 80,
          left: 50,
          right: 30,
          cellSize: ['auto', 20],
          range: [startDate, endDate],
          itemStyle: {
            borderWidth: 0.5,
          },
          yearLabel: { show: false },
        },
        series: [
          {
            type: 'heatmap',
            coordinateSystem: 'calendar',
            data: heatmapData,
          },
        ],
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
  <div bind:this={chartContainer} class="w-full h-64"></div>

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
