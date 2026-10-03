# Design system

## Brand and palette

The storefront uses the original white Setup Ninja logo from the official Dooca CDN. The desktop and mobile variants are stored in `public/assets/setupninja-logo-white.webp` and `public/assets/setupninja-logo-white-mobile.webp`; their original URLs and capture date are recorded in `docs/UX.md`.

The interface follows the live storefront palette: near-black `#0e0e0e`, charcoal `#111315` and `#1a1d21`, dark gray `#222222`, white `#ffffff` and `#f0f0f0`, secondary gray `#888888` and `#aaaaaa`, and Setup Ninja orange `#ff7300` with `#fd7710` for nearby accents. Orange marks actions and selected states. Dark neutrals carry the page, cards, and controls.

## Typography

Use Syne for display headings, Open Sans for interface copy, and Inter for compact data. Keep product names and Portuguese labels readable at desktop and mobile sizes.

## Components and behavior

- The storefront header, departments, catalog, cart, builder, assistant, and operator panels share the dark palette.
- Use the CDN-provided logo files through the local copies; do not recreate the mark with SVG or text.
- The cart stores only catalog item IDs and display fields in local storage. It is a demonstrator with no order or payment action.
- The PC builder sends selected official catalog IDs to `/api/build`; the backend remains the authority for SKU availability, budget, and compatibility. Keep `UNKNOWN` visible as unknown.
- Orange action controls need a clear hover, focus, disabled, loading, and error state against the dark background.

