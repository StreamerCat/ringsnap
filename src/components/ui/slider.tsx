import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-4", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-cream border-2 border-primary/20 shadow-inner">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-primary to-primary/80 shadow-md" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-3 border-primary bg-white ring-offset-background transition-all duration-200 shadow-lg hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:scale-110 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing active:scale-105" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
