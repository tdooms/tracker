<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let daysBack: number = 7;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';

  interface WebsiteData {
    website: string;
    duration: number;
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api/activity/websites?days=${daysBack}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: WebsiteData[] = await response.json();

      if (data.length === 0) {
        error = 'No website data available';
        loading = false;
        return;
      }

      // Initialize chart (container is always rendered)
      chart = echarts.init(chartContainer);

      // Take top 15 websites
      const topWebsites = data.slice(0, 15);

      chart.setOption({
        title: {
          text: 'Top Websites Visited',
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          formatter: (params: any) => {
            const minutes = Math.round(params[0].value / 60);
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            return `${params[0].name}<br/>Time: ${timeStr}`;
          },
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: 60,
          containLabel: true,
        },
        xAxis: {
          type: 'value',
          name: 'Minutes',
          axisLabel: {
            formatter: (value: number) => Math.round(value / 60),
          },
        },
        yAxis: {
          type: 'category',
          data: topWebsites.map((w) => w.website),
          axisLabel: {
            width: 200,
            overflow: 'truncate',
          },
        },
        series: [
          {
            type: 'bar',
            data: topWebsites.map((w) => w.duration),
            itemStyle: {
              color: '#5470c6',
            },
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

  <!-- Error overlay -->
  {#if error}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
      <div class="alert alert-error">
        <span>{error}</span>
      </div>
    </div>
  {/if}
</div>
