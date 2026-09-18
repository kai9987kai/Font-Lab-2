# Security policy

## Supported versions

Font Lab is a single static HTML file with no dependencies and no server
component. Only the current release on the default branch is supported; there is
nothing to back-port to.

| Version | Supported |
| ------- | --------- |
| 2.x     | yes       |
| 1.x     | no — `main.html` forwards to the current app |

## Threat model

The app runs entirely in the browser. It has no backend, stores nothing off the
device, and makes exactly one kind of outbound request: the Google Fonts
stylesheet for a family you select. Fonts you load from disk are read with
`FontFace` and never leave the page.

The inputs that come from outside the person using the app are therefore the
interesting ones:

- **Share links** (`#type=…`) and **preset JSON files**, which may have been
  written by someone else.
- **Font files**, which are parsed as binary data.
- **Free-text CSS fields** (`text-shadow`, `filter`) and the raw
  `font-feature-settings` field, whose values are written into the live preview
  and into exported stylesheets.

All of these pass through a schema that drops unknown keys and coerces every
known key into its declared type and range. CSS values additionally have
rule-escaping characters removed and are then validated with `CSS.supports()`,
so a value the browser will not accept for that property is discarded rather
than emitted. `url()`, `expression()`, `image-set()`, `element()` and `attr()`
are refused outright. Preview links are limited to `http`, `https`, `mailto` and
`tel`. The JavaScript sandbox runs in a cross-origin `sandbox="allow-scripts"`
frame and receives only a copy of the current state.

Findings we are interested in include: a way to escape a CSS declaration or
inject a rule, a share link or preset that executes script or exfiltrates data,
a font file that causes something worse than a parse error, a way for the
sandboxed frame to reach the host page, or a request to a host other than
`fonts.googleapis.com` and `fonts.gstatic.com`.

## Reporting a vulnerability

Please report privately through GitHub's
[security advisories](https://github.com/kai9987kai/Font-Lab-2/security/advisories/new)
rather than opening a public issue.

Include what you did, what happened, and which browser and version you used. A
share link or a minimal file that reproduces the problem is the fastest route to
a fix.

You can expect an acknowledgement within a week. If the report is accepted, a
fix ships on the default branch and the advisory is published with credit unless
you would rather stay anonymous. If it is declined you will get the reasoning,
and you are welcome to disagree.

Because the app is a static file, "upgrading" means re-downloading `index.html`
or reloading the page you are serving it from.
