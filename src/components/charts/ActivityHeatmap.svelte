<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let daysBack: number = 30;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';
  let noData = false;

  interface HeatmapData {
    day: string;
    hour: number;
    activity: number;
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api?endpoint=heatmap&days=${daysBack}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: HeatmapData[] = await response.json();

      if (data.length === 0) {
        noData = true;
        loading = false;
        return;
      }

      // Get unique days and sort them
      const days = Array.from(new Set(data.map(d => d.day))).sort();
      const hours = Array.from({ length: 24 }, (_, i) => i);

      // Create matrix for heatmap
      const heatmapData = data.map(d => [
        days.indexOf(d.day),
        d.hour,
        d.activity
      ]);

      // Find max activity for color scaling
      const maxActivity = Math.max(...data.map(d => d.activity));

      chart = echarts.init(chartContainer);
      chart.setOption({
        title: {
          text: 'Activity Heatmap',
          left: 'center',
          top: 10,
        },
        tooltip: {
          position: 'top',
          formatter: (params: any) => {
            const day = days[params.value[0]];
            const hour = params.value[1];
            const activity = params.value[2];
            return `${day} ${hour}:00<br/>Activity: ${activity}`;
          }
        },
        grid: {
          left: '80px',
          right: '20px',
          bottom: '60px',
          top: '60px',
        },
        xAxis: {
          type: 'category',
          data: days.map(d => {
            const date = new Date(d);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }),
          splitArea: {
            show: true
          },
          axisLabel: {
            rotate: 45,
            interval: Math.floor(days.length / 10)
          }
        },
        yAxis: {
          type: 'category',
          data: hours.map(h => `${h}:00`),
          splitArea: {
            show: true
          }
        },
        visualMap: {
          min: 0,
          max: maxActivity,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '5px',
          inRange: {
            color: ['#f0f0f0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
          }
        },
        series: [{
          name: 'Activity',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: false
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }]
      });

      loading = false;

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
  <div bind:this={chartContainer} class="w-full h-96"></div>

  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if noData}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
      <div class="alert alert-info">
        <span>No activity data available for heatmap</span>
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
