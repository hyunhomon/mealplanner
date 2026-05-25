<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  type ProgressProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    value?: number;
  };

  let { class: className, ref = $bindable(null), value = 0, ...restProps }: ProgressProps = $props();

  let normalizedValue = $derived(Math.min(100, Math.max(0, value)));
</script>

<div
  bind:this={ref}
  data-slot="progress"
  class={cn("bg-primary/10 relative h-2 w-full overflow-hidden rounded-full", className)}
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={normalizedValue}
  {...restProps}
>
  <div class="bg-primary h-full w-full flex-1 rounded-full transition-all" style={`transform: translateX(-${100 - normalizedValue}%);`}></div>
</div>
