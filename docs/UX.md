# UX audit and implementation notes

## Reference reviewed

On 2026-10-03, the live Setup Ninja home page was opened in a browser. The captured desktop header shows the original white Setup Ninja logo on black, a two-row black navigation, an orange search action and orange department icons. The page body uses `#0e0e0e`, `#111315`, `#1a1d21` and `#222222`, with white/gray text and orange `#ff7300` / `#fd7710` actions. The observed font families are Inter, Open Sans and Syne. The desktop capture used for this review is `/tmp/setupninja-original-desktop.png`.

The exact logo images are served from the official CDN at `https://cdn.dooca.store/174137/files/logobrancopng.png?v=1759242139` and `https://cdn.dooca.store/174137/files/logobrancomobilepng.png?v=1759242261`. The app includes local WebP responses from those same image resources in `public/assets/`, so the logo does not depend on runtime access to the CDN.

The requested `/monte-seu-pc` route did not return a usable DOM in this audit: browser navigation timed out, and a direct HTML fetch returned an Azion default error page. The `monte-seu-pc.setupninja.com.br` root opened, but resource pressure prevented a full interaction pass there. Those are access limitations during this audit, not evidence of a defect in the live builder. No claim about the live builder's interaction quality is made here.

## Issues found in this demo

These findings come from the implementation under review, not the live store:

- The cart button opened NinjaRUDEUS chat, and the “Monte seu PC” navigation button opened chat as well.
- Adding an item only incremented a number; there was no product list, quantity control, removal, subtotal, or persistence.
- The builder accepted a budget and broad CPU/GPU preferences, but its refine button repeated the existing request without identifying a replacement SKU. A changed configuration therefore could not be reviewed before validation.
- Switching between the store and builder unmounted the builder, discarding its form and result.
- The current demo used a light background and a violet identity that did not match the live store's black, gray, white, and orange palette.

## Changes made

- The cart now has a separate drawer with product names, quantities, unit prices, item totals, removal, stock-limited quantity controls, and a subtotal. It persists only catalog item display data in browser local storage. It presents no checkout or payment action.
- The header cart and assistant controls now open separate surfaces. “Monte seu PC” selects the builder tab.
- The builder loads available component options from `/api/build/options`, with the existing catalog endpoint as a compatibility fallback. People can request a suggestion by purpose and budget, choose a CPU/GPU, and change a component by its official catalog ID. Each change is submitted through `/api/build` with the prior build ID so backend stock, budget, and compatibility checks stay authoritative.
- The builder shows the current proposal total, remaining budget, selected component count, SKU, queried stock, and compatibility result. Backend `UNKNOWN` rules remain explicitly unresolved. If form values change, it labels the existing result as the last validated proposal until the user submits again.
- A validated proposal can add its official SKUs to the demonstrative cart only when every line still maps to a catalog item and the form has no pending edits. The cart carries each validated quantity and unit price; it remains a local preview without an order action.
- The builder stays mounted while the visitor switches tabs, preserving its form and result.
- The storefront now uses the original white logo variants and the live dark neutral/orange palette and type families.

## Limits

The cart is a local demonstration and does not reserve stock or create an order. Builder prices and stock are snapshots from the catalog API and can change; the backend's latest validation and any `UNKNOWN` compatibility rules remain visible. The live builder route was not available for an end-to-end comparison in this audit.
