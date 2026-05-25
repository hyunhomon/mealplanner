<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLInputAttributes } from "svelte/elements";

  type InputProps = WithElementRef<HTMLInputAttributes> & {
    type?: HTMLInputAttributes["type"];
  };

  let { class: className, ref = $bindable(null), type = "text", ...restProps }: InputProps = $props();
</script>

<input
  bind:this={ref}
  data-slot="input"
  class={cn(
    "border-input bg-background placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-10 w-full min-w-0 rounded-lg border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
    className
  )}
  {type}
  {...restProps}
/>
