import { cn } from "@/lib/utils";

/**
 * DealFlow360 wordmark, set in the product's own type rather than rastered or drawn.
 *
 * A PNG cannot follow the theme and goes soft on high-DPI screens, so the mark is rendered as
 * real text: it inherits `--font-sans`, stays selectable and searchable, scales with the user's
 * text-size preference, and needs no second asset for dark mode. The design language holds that
 * hierarchy comes from type, proportion and thin rules rather than icons — the sidebar this sits
 * in has no icons at all — so the mark carries no glyph. Its one device is a hairline accent rule
 * beneath the wordmark, the same masthead rule the section headers use.
 *
 * "360" takes `--ink-accent`, preserving the raster's one piece of brand equity: the numerals are
 * the coloured, memorable half of the name. Both inks clear the AAA 7:1 body floor in both themes
 * (foreground 17.48:1 light / 15.20:1 dark, ink-accent 7.99:1 / 10.08:1), so the mark never leans
 * on the large-text exemption, and the rule clears the 3:1 graphic floor with room to spare.
 *
 * Sizing is driven by one font-size class, so a single lockup covers every call site:
 * the default `text-2xl` renders a 32px-tall mark for the sidebar and portal headers, and
 * `className="text-3xl"` renders a 38px one for the auth pages.
 *
 * Two structural details are load-bearing and must not be "tidied":
 *
 * 1. The "360" span stays a plain inline element. Giving it `inline-block`, `inline-flex` or any
 *    other non-inline display makes Chromium's accessible-name computation insert a space at the
 *    box boundary, silently turning every call site's name into "DealFlow 360".
 * 2. There is no whitespace between "DealFlow" and the span, for the same reason.
 *
 * The accent rule sits on this element's own border rather than under the numerals, so it is
 * contained by the mark's border box. `SidebarMenuButton` applies `overflow-hidden` and `truncate`
 * to its children, which would clip a rule painted outside the box, and the overflow of an inline
 * box depends on the platform font's descent — neither can affect a border on the root.
 */
type BrandLogoProps = {
  className?: string;
  /** Accepted for call-site compatibility with the previous `next/image` mark; inert for text. */
  height?: number;
  /** Accepted for call-site compatibility with the previous `next/image` mark; inert for text. */
  priority?: boolean;
  /** Accepted for call-site compatibility with the previous `next/image` mark; inert for text. */
  width?: number;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-block border-b-2 border-ink-accent pb-1.5 text-2xl leading-none font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      DealFlow<span className="text-ink-accent">360</span>
    </span>
  );
}
