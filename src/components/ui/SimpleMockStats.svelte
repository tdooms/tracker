<script lang="ts">
  import { onMount } from 'svelte';
  import StatsCard from './StatsCard.svelte';

  let loading = true;
  let error = '';
  let stats = {
    totalActiveTime: 0,
    topApps: [] as { name: string; duration: number }[],
    avgSessionLength: 0,
    sessionsToday: 0,
  };

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  onMount(async () => {
    try {
      const response = await fetch('/api/mock-stats');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      stats = await response.json();
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load stats';
      console.error('Stats fetch error:', err);
      loading = false;
    }
  });
</script>

<div class="w-full">
  {#if loading}
    <div class="flex items-center justify-center p-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>Error: {error}</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Active Time Today"
        value={formatDuration(stats.totalActiveTime)}
        description="Total tracked activity"
        icon="clock"
      />

      <StatsCard
        title="Sessions Today"
        value={stats.sessionsToday.toString()}
        description={`Avg: ${formatDuration(stats.avgSessionLength)}`}
        icon="activity"
      />

      <StatsCard
        title="Top Application"
        value={stats.topApps[0]?.name || 'N/A'}
        description={stats.topApps[0]
          ? formatDuration(stats.topApps[0].duration)
          : 'No data'}
        icon="chart"
      />

      <StatsCard
        title="2nd Most Used"
        value={stats.topApps[1]?.name || 'N/A'}
        description={stats.topApps[1]
          ? formatDuration(stats.topApps[1].duration)
          : 'No data'}
        icon="chart"
      />
    </div>
  {/if}
</div>
