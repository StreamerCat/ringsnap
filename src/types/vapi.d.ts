import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare namespace JSX {
  interface IntrinsicElements {
    "vapi-widget": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}
