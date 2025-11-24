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

      const minuteKey = (date: Date) => {
        const copy = new Date(date);
        copy.setSeconds(0);
        copy.setMilliseconds(0);
        return copy.toISOString();
      };

      const byMinute = new Map<string, { keys: number; clicks: number }>();
      data.forEach((entry) => {
        const ts = new Date(entry.timestamp);
        if (Number.isNaN(ts.getTime())) return;
        const key = minuteKey(ts);
        const existing = byMinute.get(key);
        if (existing) {
          existing.keys += entry.keysPerMinute;
          existing.clicks += entry.mouseClicks;
        } else {
          byMinute.set(key, {
            keys: entry.keysPerMinute,
            clicks: entry.mouseClicks,
          });
        }
      });

      const dayStart = new Date(`${selectedDate}T00:00:00`);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const timestamps: string[] = [];
      const keysData: number[] = [];
      const clicksData: number[] = [];
      const minuteStep = 60 * 1000;
      const intervalMs = 30 * 60 * 1000;

      for (let cursor = new Date(dayStart); cursor < dayEnd; cursor = new Date(cursor.getTime() + intervalMs)) {
        const bucketEnd = new Date(Math.min(cursor.getTime() + intervalMs, dayEnd.getTime()));
        let keySum = 0;
        let clickSum = 0;
        for (let minuteCursor = new Date(cursor); minuteCursor < bucketEnd; minuteCursor = new Date(minuteCursor.getTime() + minuteStep)) {
          const entry = byMinute.get(minuteKey(minuteCursor));
          if (entry) {
            keySum += entry.keys;
            clickSum += entry.clicks;
          }
        }
        const label = `${cursor.getHours().toString().padStart(2, '0')}:${cursor
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        timestamps.push(label);
        keysData.push(Math.round(keySum));
        clicksData.push(Math.round(clickSum));
      }

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
            interval: 1,
            formatter: (value: string) => (value.endsWith(':00') ? value : ''),
          },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Keystrokes',
            nameLocation: 'middle',
            nameGap: 40,
            position: 'left',
            splitLine: {
              show: true,
            },
          },
          {
            type: 'value',
            name: 'Mouse Clicks',
            nameLocation: 'middle',
            nameGap: 40,
            position: 'right',
            axisLine: {
              show: false,
            },
            axisTick: {
              show: false,
            },
            splitLine: {
              show: false,
            },
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
            showSymbol: false,
          },
          {
            name: 'Mouse Clicks',
            type: 'line',
            smooth: true,
            yAxisIndex: 1,
            data: clicksData,
            itemStyle: { color: '#91cc75' },
            lineStyle: { width: 2 },
            showSymbol: false,
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
