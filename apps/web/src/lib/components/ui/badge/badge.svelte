<script lang="ts" module>
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";
  import { type VariantProps, tv } from "tailwind-variants";

  export const badgeVariants = tv({
    base: "focus-visible:border-ring focus-visible:ring-ring/50 inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-3 [&>svg]:size-3",
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  });

  export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
  export type BadgeProps = WithElementRef<HTMLAttributes<HTMLSpanElement>> & {
    variant?: BadgeVariant;
    children?: import("svelte").Snippet;
  };
</script>

<script lang="ts">
  let { class: className, variant = "default", ref = $bindable(null), children, ...restProps }: BadgeProps = $props();
</script>

<span bind:this={ref} data-slot="badge" class={cn(badgeVariants({ variant }), className)} {...restProps}>
  {@render children?.()}
</span>
