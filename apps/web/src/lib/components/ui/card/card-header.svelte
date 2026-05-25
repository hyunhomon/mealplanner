<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  type CardHeaderProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    children?: import("svelte").Snippet;
  };

  let { class: className, ref = $bindable(null), children, ...restProps }: CardHeaderProps = $props();
</script>

<div bind:this={ref} data-slot="card-header" class={cn("grid gap-1.5 p-4 pb-2", className)} {...restProps}>
  {@render children?.()}
</div>
