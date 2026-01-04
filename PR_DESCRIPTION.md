# Fix: Move Toasts to Top-Right to Avoid Vapi Widget Overlap

## Problem

System notifications (toasts) were appearing in the bottom-right corner, where they were frequently obscured by the floating Vapi chat widget. This resulted in poor UX as users could miss important success or error messages.

## Solution

Moved all toast notifications to the **Top-Right** of the screen.

- **Option A** selected: A consistent top-right position avoids the widget entirely.
- Added explicit top margin/padding to ensure toasts do not render underneath the fixed `SiteHeader`.

## Changes

1. **`src/components/ui/sonner.tsx`**:
    - Set `position="top-right"`.
    - Added `mt-16` className to clear the header.

2. **`src/components/ui/toast.tsx` (Shadcn)**:
    - Updated `ToastViewport` to use `sm:top-0` and `sm:right-0` on desktop.
    - Added `sm:pt-20` to verify safe header clearance.

## Assumptions

- `SiteHeader` is approximately `h-14` (56px).
- `mt-16` (64px) and `pt-20` (80px) provide sufficient safe area.

## Verification

- [x] **Desktop**: Verified toasts appear top-right and do not overlap the header.
- [x] **Mobile**: Verified toasts appear at the top and respect safe areas.
- [x] **Widget**: Confirmed no overlap with Vapi widget (bottom-right).
