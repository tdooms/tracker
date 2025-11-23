<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import StatsCard from './StatsCard.svelte';

  export let selectedDate: string = format(new Date(), 'yyyy-MM-dd');

  let loading = true;
  let error = '';
  let stats = {
    totalActiveTime: 0,
    totalKeystrokes: 0,
    topApps: [] as { name: string; duration: number }[],
    avgSessionLength: 0,
    sessionsToday: 0,
  };

  function formatDuration(seconds: number): string {
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

  async function fetchStats() {
    try {
      loading = true;
      const response = await fetch(`/api?endpoint=stats&date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch stats');

      stats = await response.json();
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load stats';
      loading = false;
    }
  }

  $: if (selectedDate) {
    fetchStats();
  }

  onMount(() => {
    // Initial fetch handled by reactive statement
  });
</script>

<div class="w-full">
  {#if loading}
    <div class="flex items-center justify-center p-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatsCard
        title="Active Time"
        value={formatDuration(stats.totalActiveTime)}
        description="total tracked activity"
        icon="clock"
      />

      <StatsCard
        title="Total Keystrokes"
        value={stats.totalKeystrokes.toLocaleString()}
        description="keys pressed today"
        icon="keyboard"
      />

      <StatsCard
        title="Sessions Today"
        value={stats.sessionsToday.toString()}
        description={`${formatDuration(stats.avgSessionLength)} per session`}
        icon="list-check"
      />
    </div>
  {/if}
</div>
