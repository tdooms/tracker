<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import * as echarts from 'echarts';

  export let selectedDate: string = format(new Date(), 'yyyy-MM-dd');

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';
  let noData = false;
  let resizeObserver: ResizeObserver;

  interface IdleData {
    hour: number;
    totalIdleTime: number;
    idleCount: number;
  }

  async function fetchAndRenderChart() {
    try {
      loading = true;
      noData = false;
      error = '';
      const response = await fetch(`/api?endpoint=idle-distribution&date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: IdleData[] = await response.json();

      if (data.length === 0) {
        noData = true;
        loading = false;
        return;
      }

      // Create full 24-hour array with zeros for missing hours
      const hourlyData = Array.from({ length: 24 }, (_, i) => {
        const found = data.find(d => d.hour === i);
        return found ? Math.round(found.totalIdleTime / 60) : 0; // Convert to minutes
      });

      const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

      if (!chart) {
        chart = echarts.init(chartContainer);
      }
      chart.setOption({
        title: {
          text: 'Idle Time Distribution',
          left: 'center',
          top: 10,
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const minutes = params[0].value;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            return `${params[0].axisValue}<br/>Idle Time: ${timeStr}`;
          }
        },
        grid: {
          left: '60px',
          right: '20px',
          bottom: '60px',
          top: '60px',
        },
        xAxis: {
          type: 'category',
          data: hours,
          name: 'Hour of Day',
          nameLocation: 'middle',
          nameGap: 35,
          axisLabel: {
            interval: 2
          }
        },
        yAxis: {
          type: 'value',
          name: 'Idle Time (minutes)',
          nameLocation: 'middle',
          nameGap: 40,
        },
        series: [{
          type: 'bar',
          data: hourlyData,
          itemStyle: {
            color: '#ee6666'
          }
        }]
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
  <div bind:this={chartContainer} class="w-full h-80"></div>

  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if noData}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
      <div class="alert alert-info">
        <span>No idle periods recorded</span>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
      <div class="alert alert-error">
        <span>{error}</span>
      </div>
    </div>
  {/if}
</div>
