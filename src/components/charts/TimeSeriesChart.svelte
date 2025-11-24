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
      const titleCase = (value: string) =>
        value
          .toLowerCase()
          .replace(/(^|\s|-|_)([a-z])/g, (match, prefix, char) => `${prefix}${char.toUpperCase()}`);

      const sanitizeAppName = (name?: string) => {
        if (!name) return 'Idle';
        const base = name.replace(/\.exe$/i, '').trim();
        if (!base) return 'Idle';
        return titleCase(base);
      };

      const appMap = new Map<string, Map<string, number>>();
      data.forEach((item) => {
        const sanitized = sanitizeAppName(item.appName);
        if (!appMap.has(sanitized)) {
          appMap.set(sanitized, new Map());
        }
        appMap.get(sanitized)!.set(item.hour, item.duration);
      });

      const pad = (value: number) => value.toString().padStart(2, '0');
      const formatHour = (dateValue: Date) => {
        const year = dateValue.getFullYear();
        const month = pad(dateValue.getMonth() + 1);
        const day = pad(dateValue.getDate());
        const hour = pad(dateValue.getHours());
        return `${year}-${month}-${day} ${hour}:00`;
      };

      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const hours: string[] = [];
      for (let cursor = new Date(startOfDay); cursor < endOfDay; cursor = new Date(cursor.getTime() + 60 * 60 * 1000)) {
        hours.push(formatHour(cursor));
      }

      // Get top 5 apps by total duration
      const sortedApps = Array.from(appMap.entries())
        .map(([app, hourMap]) => ({
          app,
          total: Array.from(hourMap.values()).reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.total - a.total);

      const topApps = sortedApps.slice(0, 5);
      const idleEntry = sortedApps.find((entry) => entry.app === 'Idle');
      if (idleEntry && !topApps.some((entry) => entry.app === 'Idle')) {
        topApps.push(idleEntry);
      }

      // Create series data
      const series = topApps.map(({ app }) => ({
        name: app,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: {
          type: app === 'Idle' ? 'dashed' : 'solid',
          width: 2,
        },
        areaStyle: app === 'Idle' ? { opacity: 0.2 } : undefined,
        itemStyle: {
          color: app === 'Idle' ? '#6b7280' : undefined,
        },
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
          data: topApps.map((a) => a.app),
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
          axisTick: {
            show: true,
          },
          axisLabel: {
            interval: 1,
            formatter: (value: string) => {
              const [, timePart] = value.split(' ');
              return timePart ?? '';
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
