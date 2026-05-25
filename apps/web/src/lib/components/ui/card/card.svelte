<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  type CardProps = WithElementRef<HTMLAttributes<HTMLElement>> & {
    children?: import("svelte").Snippet;
  };

  let { class: className, ref = $bindable(null), children, ...restProps }: CardProps = $props();
</script>

<section
  bind:this={ref}
  data-slot="card"
  class={cn("rounded-lg border bg-card text-card-foreground shadow-xs", className)}
  {...restProps}
>
  {@render children?.()}
</section>
