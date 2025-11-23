<script lang="ts">
  export let title: string;
  export let value: string;
  export let description: string = '';
  export let trend: 'up' | 'down' | 'neutral' = 'neutral';
  export let icon: string = '';
</script>

<div class="stats shadow">
  <div class="stat">
    {#if icon}
      <div class="stat-figure text-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="inline-block w-8 h-8 stroke-current"
        >
          {#if icon === 'clock'}
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
            ></path>
          {:else if icon === 'chart'}
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            ></path>
          {:else if icon === 'activity'}
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            ></path>
          {/if}
        </svg>
      </div>
    {/if}
    <div class="stat-title">{title}</div>
    <div class="stat-value">{value}</div>
    {#if description}
      <div class="stat-desc">{description}</div>
    {/if}
  </div>
</div>
