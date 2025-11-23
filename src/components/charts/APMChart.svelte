<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let daysBack: number = 7;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';
  let noData = false;

  interface APMData {
    timestamp: string;
    keysPerMinute: number;
    mouseClicks: number;
    mouseDistance?: number;
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api/apm?days=${daysBack}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: APMData[] = await response.json();

      if (data.length === 0) {
        noData = true;
        loading = false;
        return;
      }

      // Prepare data
      const timestamps = data.map((d) => new Date(d.timestamp).toLocaleString());
      const keysData = data.map((d) => d.keysPerMinute);
      const clicksData = data.map((d) => d.mouseClicks);

      // Initialize chart (container is always rendered)
      chart = echarts.init(chartContainer);
      chart.setOption({
        title: {
          text: 'APM Metrics (Keys & Mouse Activity)',
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
        },
        legend: {
          top: 30,
          data: ['Keys/Min', 'Mouse Clicks'],
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
          data: timestamps,
          axisLabel: {
            rotate: 45,
          },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Keys/Min',
            position: 'left',
          },
          {
            type: 'value',
            name: 'Clicks',
            position: 'right',
          },
        ],
        series: [
          {
            name: 'Keys/Min',
            type: 'line',
            smooth: true,
            data: keysData,
            itemStyle: { color: '#5470c6' },
          },
          {
            name: 'Mouse Clicks',
            type: 'line',
            smooth: true,
            yAxisIndex: 1,
            data: clicksData,
            itemStyle: { color: '#91cc75' },
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
  <div bind:this={chartContainer} class="w-full h-96"></div>

  <!-- Loading overlay -->
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  <!-- No data overlay -->
  {#if noData}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
      <div class="alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="stroke-current shrink-0 w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <span>No APM data available yet. Start tracking to see metrics!</span>
      </div>
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
