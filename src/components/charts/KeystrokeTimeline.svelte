<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts;
  let loading = true;
  let error = '';
  let noData = false;

  interface APMData {
    timestamp: string;
    keysPerMinute: number;
    mouseClicks: number;
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api/apm?days=1`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const allData: APMData[] = await response.json();

      if (allData.length === 0) {
        noData = true;
        loading = false;
        return;
      }

      // Filter to today only
      const today = new Date().toISOString().split('T')[0];
      const data = allData
        .filter(d => d.timestamp.startsWith(today))
        .reverse();

      if (data.length === 0) {
        noData = true;
        loading = false;
        return;
      }

      // Create barcode-style visualization
      const timestamps = data.map(d => {
        const date = new Date(d.timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      });

      const keystrokeData = data.map(d => d.keysPerMinute);

      chart = echarts.init(chartContainer);
      chart.setOption({
        title: {
          text: 'Today\'s Keystroke Activity',
          left: 'center',
          top: 10,
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            return `${params[0].axisValue}<br/>Keystrokes: ${params[0].value}`;
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
          data: timestamps,
          axisLabel: {
            rotate: 45,
            interval: Math.floor(data.length / 20)
          },
          name: 'Time',
          nameLocation: 'middle',
          nameGap: 35,
        },
        yAxis: {
          type: 'value',
          name: 'Keystrokes',
          nameLocation: 'middle',
          nameGap: 40,
        },
        series: [{
          type: 'bar',
          data: keystrokeData,
          itemStyle: {
            color: (params: any) => {
              const value = params.value;
              if (value > 200) return '#196127';
              if (value > 100) return '#239a3b';
              if (value > 50) return '#7bc96f';
              return '#c6e48b';
            }
          },
          barWidth: '100%',
          barCategoryGap: '0%'
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
  <div bind:this={chartContainer} class="w-full h-64"></div>

  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if noData}
    <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
      <div class="alert alert-info">
        <span>No keystroke data available for today</span>
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
