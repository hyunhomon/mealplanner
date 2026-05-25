<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  type SheetContentProps = WithElementRef<HTMLAttributes<HTMLElement>> & {
    children?: import("svelte").Snippet;
  };

  let { class: className, ref = $bindable(null), children, ...restProps }: SheetContentProps = $props();
</script>

<aside
  bind:this={ref}
  data-slot="sheet-content"
  class={cn(
    "absolute right-0 top-0 flex h-full w-[min(22rem,calc(100vw-2rem))] flex-col border-l bg-background p-4 shadow-xl",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</aside>
