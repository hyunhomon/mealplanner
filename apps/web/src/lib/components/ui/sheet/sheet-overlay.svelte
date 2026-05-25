<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import { fade } from "svelte/transition";
  import type { HTMLAttributes } from "svelte/elements";

  type SheetOverlayProps = WithElementRef<HTMLAttributes<HTMLButtonElement>>;

  let { class: className, ref = $bindable(null), ...restProps }: SheetOverlayProps = $props();
</script>

<button
  bind:this={ref}
  data-slot="sheet-overlay"
  transition:fade={{ duration: 140 }}
  class={cn("absolute inset-0 bg-black/20 backdrop-blur-[1px]", className)}
  type="button"
  aria-label="메뉴 닫기"
  {...restProps}
></button>
