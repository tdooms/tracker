<script lang="ts">
  export let title: string;
  export let value: string;
  export let description: string = '';
  export let icon: string = '';
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="card-title text-base opacity-70">{title}</h3>
        <p class="text-3xl font-bold mt-2">{value}</p>
        {#if description}
          <p class="text-sm opacity-60 mt-1">{description}</p>
        {/if}
      </div>
      {#if icon}
        <div class="text-primary opacity-20">
          <i class="fas fa-{icon} text-5xl"></i>
        </div>
      {/if}
    </div>
  </div>
</div>
