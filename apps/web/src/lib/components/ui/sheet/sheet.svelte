<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  type SheetProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    open?: boolean;
    children?: import("svelte").Snippet;
  };

  let { class: className, ref = $bindable(null), open = false, children, ...restProps }: SheetProps = $props();
</script>

{#if open}
  <div
    bind:this={ref}
    data-slot="sheet"
    class={cn("fixed inset-0 z-50", className)}
    {...restProps}
  >
    {@render children?.()}
  </div>
{/if}
