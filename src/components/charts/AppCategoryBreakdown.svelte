<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  export let daysBack: number = 7;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let resizeObserver: ResizeObserver | null = null;
  let loading = true;
  let error = '';
  let noData = false;

  interface HourlyActivity {
    hour: string;
    appName: string;
    duration: number;
  }

  // Categorize applications
  function categorizeApp(appName: string): string {
    const name = appName.toLowerCase();

    if (name.includes('code') || name.includes('studio') || name.includes('vim') ||
        name.includes('sublime') || name.includes('intellij') || name.includes('pycharm')) {
      return 'Development';
    }
    if (name.includes('chrome') || name.includes('firefox') || name.includes('edge') ||
        name.includes('safari') || name.includes('browser')) {
      return 'Web Browsing';
    }
    if (name.includes('slack') || name.includes('teams') || name.includes('discord') ||
        name.includes('zoom') || name.includes('skype') || name.includes('outlook')) {
      return 'Communication';
    }
    if (name.includes('terminal') || name.includes('cmd') || name.includes('powershell') ||
        name.includes('bash')) {
      return 'Terminal';
    }
    if (name.includes('spotify') || name.includes('music') || name.includes('vlc') ||
        name.includes('media')) {
      return 'Entertainment';
    }
    if (name.includes('excel') || name.includes('word') || name.includes('powerpoint') ||
        name.includes('sheets') || name.includes('docs')) {
      return 'Productivity';
    }

    return 'Other';
  }

  function formatDurationLabel(seconds: number): string {
    const rounded = Math.max(0, Math.round(seconds));
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  onMount(() => {
    const loadChart = async () => {
      try {
        const response = await fetch(`/api?endpoint=hourly&days=${daysBack}`);
        if (!response.ok) throw new Error('Failed to fetch data');

        const data: HourlyActivity[] = await response.json();

        if (data.length === 0) {
          noData = true;
          loading = false;
          return;
        }

        const categoryMap = new Map<string, { total: number; apps: Map<string, number> }>();

        for (const item of data) {
          const appName = item.appName || 'Unknown';
          const category = categorizeApp(appName);
          const entry = categoryMap.get(category) ?? { total: 0, apps: new Map<string, number>() };
          entry.total += item.duration;
          entry.apps.set(appName, (entry.apps.get(appName) || 0) + item.duration);
          categoryMap.set(category, entry);
        }

        const sunburstData = Array.from(categoryMap.entries())
          .map(([category, { total, apps }]) => ({
            name: category,
            value: Math.round(total),
            children: Array.from(apps.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([appName, duration]) => ({
                name: appName,
                value: Math.round(duration),
              })),
          }))
          .sort((a, b) => b.value - a.value);

        chart = echarts.init(chartContainer);
        chart.setOption({
          title: {
            text: 'Time by Category',
            left: 'center',
            top: 10,
          },
          tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
              const value = Number(params.value) || 0;
              const timeLabel = formatDurationLabel(value);
              const percent = params.percent ? `${params.percent.toFixed(1)}%` : '0%';
              return `${params.name}<br/>Time: ${timeLabel} (${percent})`;
            }
          },
          breadcrumb: {
            show: true,
            top: 40,
            left: 'center',
            textStyle: {
              fontSize: 12,
            },
          },
          series: [{
            type: 'sunburst',
            radius: [0, '80%'],
            data: sunburstData,
            sort: (a: any, b: any) => {
              return (b?.value || 0) - (a?.value || 0);
            },
            label: {
              rotate: 'radial',
            },
            emphasis: {
              focus: 'ancestor',
            },
            nodeClick: 'zoomToNode',
            levels: [
              {},
              {
                r0: '15%',
                r: '70%',
                label: {
                  rotate: 'tangential',
                },
              },
            ],
          }]
        });

        loading = false;

        resizeObserver = new ResizeObserver(() => {
          chart?.resize();
        });
        resizeObserver.observe(chartContainer);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to load chart';
        loading = false;
      }
    };

    loadChart();

    return () => {
      resizeObserver?.disconnect();
      chart?.dispose();
    };
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
        <span>No activity data available</span>
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
