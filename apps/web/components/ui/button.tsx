import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-2xl bg-clip-padding font-bold whitespace-nowrap outline-none select-none focus-visible:ring-4 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'sticker sticker-press bg-primary text-primary-foreground hover:brightness-105',
        outline: 'sticker sticker-press bg-card text-foreground hover:bg-muted',
        secondary: 'sticker sticker-press bg-secondary text-secondary-foreground hover:brightness-105',
        ghost: 'text-foreground hover:bg-ink/10 aria-expanded:bg-ink/10',
        destructive: 'sticker sticker-press bg-destructive text-ink hover:brightness-105',
        link: 'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 gap-1.5 px-4 text-sm',
        xs: "h-7 gap-1 rounded-xl px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-xl px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-12 gap-2 px-6 text-base',
        icon: 'size-10',
        'icon-xs': "size-7 rounded-xl [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-9 rounded-xl',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
