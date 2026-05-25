<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  type CardContentProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    children?: import("svelte").Snippet;
  };

  let { class: className, ref = $bindable(null), children, ...restProps }: CardContentProps = $props();
</script>

<div bind:this={ref} data-slot="card-content" class={cn("p-4", className)} {...restProps}>
  {@render children?.()}
</div>
