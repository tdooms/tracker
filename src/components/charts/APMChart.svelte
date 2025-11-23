<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import { format } from 'date-fns';

  export let selectedDate: string = format(new Date(), 'yyyy-MM-dd');

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';
  let noData = false;
  let resizeObserver: ResizeObserver;

  interface APMData {
    timestamp: string;
    keysPerMinute: number;
    mouseClicks: number;
    mouseDistance?: number;
  }

  async function fetchAndRenderChart() {
    loading = true;
    error = '';
    noData = false;

    try {
      // Fetch data for selected date
      const response = await fetch(`/api?endpoint=apm&date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: APMData[] = await response.json();

      if (data.length === 0) {
        noData = true;
        loading = false;
        return;
      }

      // Prepare data with minute precision
      const timestamps = data.map((d) => {
        const date = new Date(d.timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      });
      const keysData = data.map((d) => d.keysPerMinute);
      const clicksData = data.map((d) => d.mouseClicks);

      // Format date for display
      const displayDate = format(new Date(selectedDate), 'MMMM d, yyyy');

      // Initialize or update chart
      if (!chart) {
        chart = echarts.init(chartContainer);
      }

      chart.setOption({
        title: {
          text: 'Input Activity',
          left: 'center',
          top: 10,
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            let result = `${params[0].axisValue}<br/>`;
            params.forEach((param: any) => {
              result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
            });
            return result;
          },
        },
        legend: {
          top: 40,
          data: ['Keystrokes', 'Mouse Clicks'],
        },
        grid: {
          left: '60px',
          right: '60px',
          bottom: '60px',
          top: '80px',
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: timestamps,
          name: 'Time',
          nameLocation: 'middle',
          nameGap: 35,
          axisLabel: {
            rotate: 45,
            interval: Math.floor(data.length / 24) || 0, // Show ~24 labels for full day
          },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Keystrokes',
            nameLocation: 'middle',
            nameGap: 40,
            position: 'left',
          },
          {
            type: 'value',
            name: 'Mouse Clicks',
            nameLocation: 'middle',
            nameGap: 40,
            position: 'right',
          },
        ],
        series: [
          {
            name: 'Keystrokes',
            type: 'line',
            smooth: true,
            data: keysData,
            itemStyle: { color: '#5470c6' },
            lineStyle: { width: 2 },
          },
          {
            name: 'Mouse Clicks',
            type: 'line',
            smooth: true,
            yAxisIndex: 1,
            data: clicksData,
            itemStyle: { color: '#91cc75' },
            lineStyle: { width: 2 },
          },
        ],
      });

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load chart';
      loading = false;
    }
  }

  // React to selectedDate changes from parent
  $: if (selectedDate) {
    fetchAndRenderChart();
  }

  onMount(() => {
    // Handle resize
    resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });
    resizeObserver.observe(chartContainer);

    return () => {
      resizeObserver?.disconnect();
      chart?.dispose();
    };
  });
</script>

<div class="w-full h-full">
  <!-- Chart container - always rendered -->
  <div class="relative">
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
          <span>No data available for {format(new Date(selectedDate), 'MMMM d, yyyy')}. Try another date!</span>
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
</div>
