<script lang="ts">
  import { onMount } from 'svelte';

  export let daysBack: number = 7;

  let loading = true;
  let error = '';
  let sessions: any[] = [];

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  onMount(async () => {
    try {
      const response = await fetch(`/api?endpoint=focus-sessions&days=${daysBack}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      sessions = await response.json();
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load sessions';
      loading = false;
    }
  });
</script>

<div class="w-full">
  <h3 class="text-xl font-bold mb-4 text-center">Focus Sessions</h3>

  {#if loading}
    <div class="flex items-center justify-center p-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {:else if sessions.length === 0}
    <div class="alert alert-info">
      <span>No focus sessions found (minimum 10 minutes of continuous work)</span>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th>Start Time</th>
            <th>Duration</th>
            <th>Keystrokes</th>
            <th>Applications</th>
          </tr>
        </thead>
        <tbody>
          {#each sessions.slice(0, 10) as session}
            <tr>
              <td>{formatTime(session.startTime)}</td>
              <td><span class="badge badge-primary">{formatDuration(session.duration)}</span></td>
              <td>{session.keystrokes.toLocaleString()}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  {#each session.apps.slice(0, 3) as app}
                    <span class="badge badge-sm">{app}</span>
                  {/each}
                  {#if session.apps.length > 3}
                    <span class="badge badge-sm badge-outline">+{session.apps.length - 3}</span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if sessions.length > 0}
      <div class="mt-4 stats shadow w-full">
        <div class="stat">
          <div class="stat-title">Total Sessions</div>
          <div class="stat-value text-2xl">{sessions.length}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Longest Session</div>
          <div class="stat-value text-2xl">{formatDuration(sessions[0].duration)}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Total Focus Time</div>
          <div class="stat-value text-2xl">{formatDuration(sessions.reduce((sum, s) => sum + s.duration, 0))}</div>
        </div>
      </div>
    {/if}
  {/if}
</div>
