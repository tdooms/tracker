<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let daysBack: number = 30;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';
  let noData = false;
  let totalStats = {
    keystrokes: 0,
    avgKeystrokes: 0,
    activeTime: 0
  };

  interface DailySummary {
    date: string;
    totalKeystrokes: number;
    totalClicks: number;
    mouseDistance: number;
    activeTime: number;
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api?endpoint=daily-summary&days=${daysBack}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: DailySummary[] = await response.json();

      if (data.length === 0) {
        noData = true;
        loading = false;
        return;
      }

      // Sort by date ascending for chart
      const sortedData = data.reverse();

      const dates = sortedData.map(d => {
        const date = new Date(d.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      });

      const keystrokesData = sortedData.map(d => d.totalKeystrokes);

      // Calculate stats
      totalStats.keystrokes = data.reduce((sum, d) => sum + d.totalKeystrokes, 0);
      totalStats.avgKeystrokes = Math.round(totalStats.keystrokes / data.length);
      totalStats.activeTime = data.reduce((sum, d) => sum + d.activeTime, 0);

      chart = echarts.init(chartContainer);
      chart.setOption({
        title: {
          text: 'Daily Keystroke Summary',
          left: 'center',
          top: 10,
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            return `${params[0].axisValue}<br/>Keystrokes: ${params[0].value.toLocaleString()}`;
          }
        },
        grid: {
          left: '60px',
          right: '20px',
          bottom: '80px',
          top: '60px',
        },
        xAxis: {
          type: 'category',
          data: dates,
          name: 'Date',
          nameLocation: 'middle',
          nameGap: 50,
          axisLabel: {
            rotate: 45,
            interval: Math.floor(dates.length / 15)
          }
        },
        yAxis: {
          type: 'value',
          name: 'Keystrokes',
          nameLocation: 'middle',
          nameGap: 40,
          axisLabel: {
            formatter: (value: number) => {
              if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
              return value.toString();
            }
          }
        },
        series: [{
          type: 'line',
          data: keystrokesData,
          smooth: true,
          itemStyle: {
            color: '#5470c6'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: 'rgba(84, 112, 198, 0.5)'
              }, {
                offset: 1,
                color: 'rgba(84, 112, 198, 0.1)'
              }]
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

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${Math.floor(seconds / 60)}m`;
  }
</script>

<div class="w-full">
  <div class="relative">
    <div bind:this={chartContainer} class="w-full h-80 mb-4"></div>

    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center bg-base-100">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {/if}

    {#if error}
      <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
        <div class="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    {/if}

    {#if noData}
      <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
        <div class="alert alert-info">
          <span>No daily summary data available</span>
        </div>
      </div>
    {/if}
  </div>

  {#if !loading && !error && !noData}
    <div class="stats shadow w-full">
      <div class="stat">
        <div class="stat-title">Total Keystrokes</div>
        <div class="stat-value text-2xl">{totalStats.keystrokes.toLocaleString()}</div>
        <div class="stat-desc">Last {daysBack} days</div>
      </div>
      <div class="stat">
        <div class="stat-title">Daily Average</div>
        <div class="stat-value text-2xl">{totalStats.avgKeystrokes.toLocaleString()}</div>
        <div class="stat-desc">Keystrokes per day</div>
      </div>
      <div class="stat">
        <div class="stat-title">Total Active Time</div>
        <div class="stat-value text-2xl">{formatDuration(totalStats.activeTime)}</div>
        <div class="stat-desc">Tracked activity</div>
      </div>
    </div>
  {/if}
</div>
