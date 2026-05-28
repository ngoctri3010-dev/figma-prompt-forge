/* =====================================================================
   PROMPT FORGE — app.js
   Figma → cleaned JSON → LLM-ready prompt. 100% client-side.
   --------------------------------------------------------------------- */

(() => {
  "use strict";

  // ===================================================================
  // CONSTANTS
  // ===================================================================

  const FIGMA_API = "https://api.figma.com/v1";
  const TOKEN_STORAGE_KEY = "pf.figma_token";
  const RULE_FILE_STORAGE_KEY = "pf.rule_file_overrides";
  const PROMPT_VERSION = "1.1";

  // Default rule-file name per platform. User can override per-session.
  const DEFAULT_RULE_FILES = {
    android_xml: "SYSTEM_RULE_MCP_FIGMA_ANDROID_XML_FINAL.md",
    compose: "SYSTEM_RULE_MCP_FIGMA_COMPOSE_FINAL.md",
    swiftui: "SYSTEM_RULE_MCP_FIGMA_SWIFTUI_FINAL.md",
    react_tsx: "SYSTEM_RULE_MCP_FIGMA_REACT_FINAL.md",
    flutter: "SYSTEM_RULE_MCP_FIGMA_FLUTTER_FINAL.md",
    raw: "",
  };

  // i18n / long-text safety rules per platform. Inserted when toggle is on.
  const I18N_RULES = {
    android_xml: `## i18n & long-text safety (CRITICAL)

The Figma design is in the source language only. Generated layouts MUST tolerate translations where the text grows 30–80% (German, Finnish, Russian) or wraps differently (Chinese, Japanese, Arabic RTL). Follow every rule below:

1. **Never use \`wrap_content\` for text inside a horizontal LinearLayout with siblings.** Use \`android:layout_width="0dp"\` + \`android:layout_weight\` to share space, or wrap in a ConstraintLayout chain with \`app:layout_constrainedWidth="true"\`.
2. **Single-line text must always specify ellipsize:** \`android:maxLines="1"\` + \`android:ellipsize="end"\`. Without these, long translations push siblings off-screen.
3. **Multi-line text must cap lines:** \`android:maxLines="N"\` (use design intent + 1 as headroom) plus \`android:ellipsize="end"\`.
4. **Containers holding text use \`android:minHeight\`, not fixed \`android:layout_height\`.** A fixed height clips wrapped text.
5. **Buttons & chips: \`android:minWidth\` + \`wrap_content\`, never fixed width.** Material baseline is \`android:minWidth="88dp"\`.
6. **For text that must fit a fixed area:** use \`app:autoSizeTextType="uniform"\`, \`app:autoSizeMinTextSize="12sp"\`, \`app:autoSizeMaxTextSize="<design_size>sp"\` on \`MaterialTextView\`/\`AppCompatTextView\`.
7. **RTL-safe attributes only:** \`paddingStart/paddingEnd\`, \`layout_marginStart/layout_marginEnd\`, \`drawableStart/drawableEnd\`. Never use \`left/right\` equivalents.
8. **Use \`android:textAlignment\` instead of \`android:gravity\`** for text alignment so RTL flips correctly.
9. **Icon + text rows:** put the icon in a fixed-width wrapper (\`android:layout_width="24dp"\`). Never apply \`layout_weight\` to the icon. Prefer \`app:icon\` on \`MaterialButton\` so the icon-text relationship is managed by the component.
10. **Every user-visible string must come from \`res/values/strings.xml\`** — \`@string/...\`. No hardcoded literals in layout XML. Provide \`tools:text\` for design-time preview if helpful.
11. **TextView inside ScrollView/RecyclerView item:** allow vertical growth via \`wrap_content\` height and \`maxLines\` to bound, never \`fixed\` height.
12. **Pseudo-localization sanity check:** mentally pseudo-localize each string (e.g. "Sign in" → "[Šîgñ ïñ — verify the layout still holds]"). If a string is in a row with a sibling, it must be flex-constrained.
`,
    compose: `## i18n & long-text safety (CRITICAL)

Generated Compose UI MUST tolerate translations that grow 30–80% (DE/FI/RU) or wrap differently (CJK, RTL). Follow every rule below:

1. **Text inside \`Row\` shares space via \`Modifier.weight(1f)\`** — never let a Text default to \`wrapContentWidth\` next to siblings that can also grow.
2. **Always specify \`maxLines\` and \`overflow\`:** \`maxLines = 1, overflow = TextOverflow.Ellipsis\` for single-line; pick a sensible \`maxLines\` plus ellipsis for multi-line.
3. **Use intrinsic / min sizing** rather than fixed \`width\`/\`height\` on text containers: \`Modifier.heightIn(min = ...)\` and \`widthIn(min = ...)\`.
4. **Buttons:** rely on Material3 defaults (\`Modifier.defaultMinSize\`) — don't pin \`Modifier.width(...)\` unless the design language genuinely requires it.
5. **For text that must fit a fixed box:** combine \`maxLines\` with \`AutoSizeText\` (custom) or \`onTextLayout\` shrink logic. Document the assumption.
6. **RTL-safe modifiers:** use \`Modifier.padding(start = ..., end = ...)\` (start/end aware) — never \`PaddingValues\` from \`left/right\`. Test with \`CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl)\` in Previews.
7. **Use \`TextAlign.Start\`/\`TextAlign.End\`** instead of \`Left\`/\`Right\`.
8. **Icon + text in \`Row\`:** put the icon in its own sized \`Box\`/\`Icon\` with \`Modifier.size(24.dp)\`, not weighted. Use Material3 \`Button(leadingIcon = ...)\` where applicable.
9. **All user-visible strings via \`stringResource(R.string.*)\`.** No literals.
10. **Add a Preview with the longest known translation** (e.g. a 60-char fake) for every screen-level composable.
11. **Set \`softWrap = true\`** (the default) on multi-line text; never disable softWrap on text that could be translated.
`,
    swiftui: `## i18n & long-text safety (CRITICAL)

Generated SwiftUI must tolerate translations that grow 30–80% (DE/FI/RU) or wrap differently (CJK, RTL). Follow every rule:

1. **Always set \`.lineLimit(_:)\`** on Text. Use a number for hard cap, \`nil\` only when growth is acceptable.
2. **Pair \`.lineLimit\` with \`.truncationMode(.tail)\`** for single-line.
3. **For text that must shrink to fit:** \`.minimumScaleFactor(0.7)\` plus \`.lineLimit(1)\`.
4. **In HStack:** use \`.layoutPriority(1)\` on the text that must keep its space, and \`.layoutPriority(0)\` (default) on flexible siblings. Combine with \`Spacer()\` and \`.frame(maxWidth: .infinity, alignment: .leading)\`.
5. **Allow vertical growth** in VStack: \`.fixedSize(horizontal: false, vertical: true)\` on Text containers that should expand.
6. **Never hardcode \`.frame(width:)\` on Text.** Use \`.frame(minWidth:, maxWidth:)\` with sensible bounds.
7. **Use \`LocalizedStringKey\` everywhere:** \`Text("Sign in")\` should resolve via String Catalog — don't pass raw \`String\` for user-visible copy.
8. **RTL-safe:** prefer \`.padding(.leading, .trailing)\` (which honor layout direction) over \`.padding(.horizontal)\` only when you need symmetry — both are fine. Avoid raw \`.offset(x:)\` for direction-sensitive positioning; use \`Environment(\\\\.layoutDirection)\`.
9. **Icon + text:** \`Label(_, systemImage:)\` or \`HStack { Image; Text }\` with the image given a fixed \`.frame(width: 24, height: 24)\`. Do not let the image flex.
10. **Add Previews with \`.environment(\\\\.locale, Locale(identifier: "de"))\`** plus a long pseudo-translated string for every screen.
11. **Never break long strings with \`\\n\` literals** for layout reasons — let SwiftUI wrap.
`,
    react_tsx: `## i18n & long-text safety (CRITICAL)

Generated React must tolerate translations that grow 30–80% (DE/FI/RU) or wrap differently (CJK, RTL). Follow every rule:

1. **Every flex child that contains text needs \`min-w-0\`.** Without it, text refuses to shrink and overflows the flex container. This is the most common i18n bug. Apply: \`<div className="flex-1 min-w-0">\`.
2. **Single-line text:** use Tailwind \`truncate\` (which is shorthand for \`overflow-hidden text-ellipsis whitespace-nowrap\`). Apply on the text node, not a wrapper.
3. **Multi-line clamp:** \`line-clamp-N\` (Tailwind v3+). For variable clamps use \`[--clamp:3] line-clamp-[var(--clamp)]\`.
4. **Long unbreakable strings** (URLs, IDs): add \`break-words\` or \`break-all\` so they don't break the layout horizontally; default to \`overflow-wrap: anywhere\` in global CSS for body copy.
5. **Buttons:** \`whitespace-nowrap\` only when the design truly requires a single line. Otherwise allow wrap and use \`min-h-[40px]\` instead of fixed height.
6. **\`flex-1\` over \`flex-grow flex-shrink-0\`** unless you genuinely want no shrink.
7. **RTL-safe utilities:** use Tailwind logical properties — \`ps-*\` (padding-inline-start), \`pe-*\`, \`ms-*\`, \`me-*\`, \`start-0\`, \`end-0\` — never \`pl-*\`/\`pr-*\` for direction-sensitive spacing.
8. **Set \`dir="auto"\`** on root text containers that might receive RTL content.
9. **All user-visible strings via i18n keys** (\`t("login.submit")\`) — no hardcoded literals in JSX. Pass the t function as a prop or via \`useTranslation()\`.
10. **Test with a pseudo-locale** that adds 40% length and accents, e.g. "[Ŝīgņ īņ — pseudo length test]". Snapshot must still fit.
11. **Icon + text:** wrap the icon in a fixed-size shrink-0 element: \`<Icon className="h-4 w-4 shrink-0" />\`, then text in \`<span className="truncate">\`.
`,
    flutter: `## i18n & long-text safety (CRITICAL)

Generated Flutter must tolerate translations that grow 30–80% (DE/FI/RU) or wrap differently (CJK, RTL). Follow every rule:

1. **Text in \`Row\` must be wrapped in \`Expanded\` or \`Flexible\`.** Bare \`Text\` next to siblings in a Row overflows when translated.
2. **Always set \`maxLines\` and \`overflow\`:** \`Text(s, maxLines: 1, overflow: TextOverflow.ellipsis)\`. For multi-line use the same with \`maxLines: N\`.
3. **\`softWrap: true\`** (the default) — never disable unless you have a single-line UI element.
4. **Fixed sizes on containers with text are forbidden.** Use \`ConstrainedBox(constraints: BoxConstraints(minHeight: ...))\` or \`IntrinsicHeight\`.
5. **For text that must fit a fixed area:** add the \`auto_size_text\` package (\`AutoSizeText(s, maxLines: 1, minFontSize: 12)\`). Document the dependency.
6. **RTL-safe:** use \`EdgeInsetsDirectional.only(start: ..., end: ...)\` and \`AlignmentDirectional\`, NOT \`EdgeInsets.only(left:, right:)\`. Read \`Directionality.of(context)\` when manual handling is needed.
7. **Use \`TextAlign.start\`/\`TextAlign.end\`** instead of \`left\`/\`right\`.
8. **Icon + text in Row:** \`SizedBox(width: 24, height: 24, child: Icon(...))\` then \`Expanded(child: Text(...))\` — do not put the icon in an Expanded.
9. **All user-visible strings via \`AppLocalizations.of(context)!.*\`.** Strings live in \`lib/l10n/intl_*.arb\`. No literals in widget code.
10. **Add Golden tests with the longest known translation** for every screen widget.
11. **Buttons:** rely on \`MaterialButton\` / \`ElevatedButton\` default sizing; don't pin \`width\` unless mandated.
`,
    raw: "",
  };

  const TEMPLATES = {
    android_xml: `{{ruleFileSection}}# Task — Android XML layout generation

You are a senior Android engineer (10+ years, Kotlin + XML). Produce production-grade code from the Figma extraction below.

## Target stack
- Language: Kotlin
- UI: XML layouts
- Min SDK: 24
- Material Components: Material3 (com.google.android.material:material)
- Layout root: ConstraintLayout unless the auto-layout strongly implies LinearLayout
- Naming: snake_case for IDs and resource names
- Dimensions: dp / sp
- Strings: extract every user-visible string to res/values/strings.xml

## Output format
Return each file as a separate code block, prefixed with its full project path. Required files:

1. \`app/src/main/res/layout/<screen_name>.xml\`
2. \`app/src/main/res/values/colors.xml\` — only NEW colors (don't redefine existing ones)
3. \`app/src/main/res/values/dimens.xml\` — extracted dimensions
4. \`app/src/main/res/values/styles.xml\` — repeated text styles
5. \`app/src/main/res/values/strings.xml\` — all user-visible strings
6. **Asset list** — drawable resources that must be exported manually from Figma

{{i18nRules}}

## Rules
- Match Figma component instances to Material3 widgets when possible (MaterialButton, TextInputLayout, MaterialCardView, etc.)
- For nodes typed \`INSTANCE\`, prefer \`<include layout="@layout/..."/>\` and emit a separate layout file
- Use \`android:elevation\` for simple shadows; fall back to layer-list drawables for complex shadow specs
- Make all text accessible: \`android:contentDescription\` on ImageViews, semantic \`android:labelFor\` where appropriate
- Do not invent colors or sizes — use values from the JSON below

## Figma extraction (Android-optimized JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

{{androidSuggestions}}

## Additional requirements

{{notes}}

## Final checklist
Before responding, verify: (a) every text node in the JSON is wired to \`@string/\`, (b) every horizontal sibling pair with text has a flex strategy (weight or constrained chain), (c) every single-line text has \`maxLines="1"\` + \`ellipsize="end"\`, (d) every \`*Start/*End\` attribute is used in place of \`*Left/*Right\`, (e) project rule file conventions are honored.
`,

    compose: `{{ruleFileSection}}# Task — Jetpack Compose UI generation

You are a senior Android engineer specialized in Jetpack Compose. Produce production-grade Compose code from the Figma extraction below.

## Target stack
- Language: Kotlin
- UI: Jetpack Compose (BOM 2024.x or later)
- Compose Material3
- Min SDK: 24
- State hoisting + stateless composables
- Theme tokens via MaterialTheme.colorScheme / typography / shapes when they map cleanly

## Output format
Return each file as a separate code block with full path:

1. \`ui/screens/<ScreenName>Screen.kt\` — top-level composable
2. \`ui/components/*.kt\` — one file per reusable component
3. \`ui/theme/Color.kt\` — new colors only
4. \`ui/theme/Type.kt\` — text style additions if any
5. \`ui/preview/<ScreenName>Previews.kt\` — \`@Preview\` (Light + Dark, phone + tablet, **plus a long-text locale**)
6. **Asset list** — drawables / vectors to add to \`res/drawable/\`

{{i18nRules}}

## Rules
- Modifier chain order: layout → behavior → appearance
- Prefer \`Spacer\` + \`Modifier.padding\` over magic margins
- For auto-layout HORIZONTAL → \`Row\`, VERTICAL → \`Column\`, NONE → \`Box\` or \`ConstraintLayout\`
- INSTANCE nodes → invoke a dedicated composable
- All hardcoded text strings: \`stringResource(R.string.*)\`
- No \`!!\` or unchecked casts

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

{{androidSuggestions}}

## Additional requirements

{{notes}}
`,

    swiftui: `{{ruleFileSection}}# Task — SwiftUI view generation

You are a senior iOS engineer with deep SwiftUI experience. Produce production-grade SwiftUI code.

## Target stack
- Swift 5.9+, SwiftUI
- iOS 16+ deployment target
- No third-party dependencies
- Localization via String catalogs / \`LocalizedStringKey\`

## Output format
Return each file as a separate code block with full path:

1. \`Views/<Name>View.swift\` — main screen
2. \`Components/*.swift\` — reusable subviews
3. \`Theme/Colors.swift\` — color definitions (asset catalog references preferred)
4. \`Theme/Typography.swift\` — text styles as \`Font\` extensions
5. \`Previews/<Name>Previews.swift\` — \`#Preview\` blocks (Light + Dark, **plus \`de\` locale with long text**)

{{i18nRules}}

## Rules
- HORIZONTAL auto-layout → \`HStack\`, VERTICAL → \`VStack\`, NONE → \`ZStack\` or \`overlay/background\`
- Use \`spacing:\` parameter from auto-layout itemSpacing
- Corner radius via \`.clipShape(RoundedRectangle(cornerRadius:))\`
- Shadows via \`.shadow(color:radius:x:y:)\`
- INSTANCE nodes → dedicated \`View\` struct

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

{{androidSuggestions}}

## Additional requirements

{{notes}}
`,

    react_tsx: `{{ruleFileSection}}# Task — React + Tailwind component generation

You are a senior frontend engineer. Produce production-grade React + TypeScript code.

## Target stack
- React 18 + TypeScript (strict)
- Tailwind CSS v3.x
- Headless UI / Radix primitives for interactive components
- Accessibility: WCAG 2.1 AA
- No inline styles unless absolutely necessary

## Output format
Return each file as a separate code block with full path:

1. \`src/components/<Name>/<Name>.tsx\`
2. \`src/components/<Name>/index.ts\` — barrel export
3. \`tailwind.config.ts\` — additions to the theme; mark as "no changes" if none
4. Subcomponents under \`src/components/<Name>/parts/*.tsx\`

{{i18nRules}}

## Rules
- Strongly typed Props interfaces, exported
- Use Tailwind's spacing scale; fall back to arbitrary values only when justified
- Auto-layout HORIZONTAL → \`flex flex-row\`, VERTICAL → \`flex flex-col\` with \`gap-*\`
- Corner radius → \`rounded-*\`
- Map colors to Tailwind theme extensions with semantic names

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

{{androidSuggestions}}

## Additional requirements

{{notes}}
`,

    flutter: `{{ruleFileSection}}# Task — Flutter widget generation

You are a senior Flutter engineer. Produce production-grade Dart code.

## Target stack
- Flutter 3.16+, Dart 3+
- Material 3 (\`useMaterial3: true\`)
- Null-safe
- No third-party dependencies unless strictly necessary

## Output format
Return each file as a separate code block with full path:

1. \`lib/screens/<name>_screen.dart\`
2. \`lib/widgets/*.dart\` — reusable widgets
3. \`lib/theme/colors.dart\` — color additions
4. \`lib/theme/typography.dart\` — text style additions
5. \`lib/l10n/intl_en.arb\` snippet — string additions

{{i18nRules}}

## Rules
- StatelessWidget by default; StatefulWidget only when state is needed
- HORIZONTAL auto-layout → \`Row\`, VERTICAL → \`Column\`, NONE → \`Stack\`
- Use \`Theme.of(context).colorScheme.*\` when colors map cleanly
- Const constructors wherever possible

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

{{androidSuggestions}}

## Additional requirements

{{notes}}
`,

    raw: `{{ruleFileSection}}# Task — UI code generation from Figma data

Below is a cleaned extraction of a Figma node. Generate UI code from it.

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

{{androidSuggestions}}

## Requirements

{{notes}}
`,
  };

  // ===================================================================
  // FIGMA API CLIENT
  // ===================================================================

  function parseFigmaUrl(url) {
    const m = url.match(/figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/);
    if (!m) throw new Error("URL Figma không hợp lệ");
    const fileKey = m[1];
    const nodeMatch = url.match(/node-id=([^&]+)/);
    const nodeId = nodeMatch
      ? decodeURIComponent(nodeMatch[1]).replace(/-/g, ":")
      : null;
    if (!nodeId) {
      throw new Error(
        "URL phải chứa node-id — chọn 1 frame trong Figma rồi copy link"
      );
    }
    return { fileKey, nodeId };
  }

  async function fetchNode(token, fileKey, nodeId) {
    const res = await fetch(
      `${FIGMA_API}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
      { headers: { "X-Figma-Token": token } }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Figma API ${res.status}: ${t || res.statusText}`);
    }
    const data = await res.json();
    const nodeData = data.nodes?.[nodeId];
    if (!nodeData) throw new Error(`Không tìm thấy node ${nodeId}`);
    return nodeData.document;
  }

  async function fetchNodeImage(token, fileKey, nodeId, scale = 2) {
    const res = await fetch(
      `${FIGMA_API}/images/${fileKey}?ids=${encodeURIComponent(
        nodeId
      )}&format=png&scale=${scale}`,
      { headers: { "X-Figma-Token": token } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const imgUrl = data.images?.[nodeId];
    if (!imgUrl) return null;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;
    return await imgRes.blob();
  }

  // ===================================================================
  // CLEANER
  // ===================================================================

  const LAYOUT_MAP = {
    HORIZONTAL: "LinearLayout(horizontal) / Row",
    VERTICAL: "LinearLayout(vertical) / Column",
    NONE: "FrameLayout / Box / ConstraintLayout",
  };
  const ALIGN_MAP = {
    MIN: "start",
    CENTER: "center",
    MAX: "end",
    SPACE_BETWEEN: "space_between",
  };

  function rgbaToHex(c, opacity = 1) {
    if (!c) return null;
    const r = Math.round((c.r || 0) * 255);
    const g = Math.round((c.g || 0) * 255);
    const b = Math.round((c.b || 0) * 255);
    const a = (c.a ?? 1) * opacity;
    const hex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
    if (a < 0.999)
      return `#${hex(Math.round(a * 255))}${hex(r)}${hex(g)}${hex(b)}`;
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  function px(n) {
    return `${Math.round(n)}dp`;
  }

  // Heuristic: text that's just digits / symbols / single chars is rarely translated
  function isTranslatableText(s) {
    if (!s || typeof s !== "string") return false;
    const trimmed = s.trim();
    if (!trimmed) return false;
    if (trimmed.length < 2) return false;
    // Pure digits / decimals / currency-like
    if (/^[\d\s.,$€£¥%+\-/:]+$/.test(trimmed)) return false;
    // Single non-letter symbols
    if (/^[^\p{L}]+$/u.test(trimmed)) return false;
    return true;
  }

  class Cleaner {
    constructor() {
      this.colors = new Map();
      this.textStyles = [];
      this.translatableCount = 0;
      this.horizontalContainerCount = 0;
    }

    trackColor(hex, hint) {
      if (!hex || this.colors.has(hex)) return;
      const slug =
        (hint || "color")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 24) || "color";
      this.colors.set(hex, slug);
    }

    clean(node, depth = 0, parentLayoutMode = null) {
      if (!node || node.visible === false) return null;
      if (depth > 14)
        return { name: node.name, type: node.type, _truncated: true };

      const out = { name: node.name || "", type: node.type || "" };

      const bb = node.absoluteBoundingBox;
      if (bb) {
        out.bounds = {
          x: Math.round(bb.x || 0),
          y: Math.round(bb.y || 0),
          w: Math.round(bb.width || 0),
          h: Math.round(bb.height || 0),
        };
      }

      if (node.layoutMode && node.layoutMode !== "NONE") {
        if (node.layoutMode === "HORIZONTAL") this.horizontalContainerCount++;
        out.layout = {
          mapping: LAYOUT_MAP[node.layoutMode] || "LinearLayout",
          orientation: node.layoutMode.toLowerCase(),
          spacing: px(node.itemSpacing || 0),
          padding: {
            left: px(node.paddingLeft || 0),
            top: px(node.paddingTop || 0),
            right: px(node.paddingRight || 0),
            bottom: px(node.paddingBottom || 0),
          },
          main_align:
            ALIGN_MAP[node.primaryAxisAlignItems || "MIN"] || "start",
          cross_align:
            ALIGN_MAP[node.counterAxisAlignItems || "MIN"] || "start",
        };
      }

      const fills = (node.fills || []).filter((f) => f.visible !== false);
      for (const f of fills) {
        if (f.type === "SOLID") {
          const hex = rgbaToHex(f.color, f.opacity ?? 1);
          out.background = hex;
          this.trackColor(hex, node.name);
          break;
        }
        if (f.type && f.type.startsWith("GRADIENT")) {
          out.background_gradient = {
            type: f.type,
            stops: (f.gradientStops || []).map((s) => ({
              pos: s.position,
              color: rgbaToHex(s.color),
            })),
          };
          break;
        }
        if (f.type === "IMAGE") {
          out.background_image = {
            scaleMode: f.scaleMode,
            hint: "export from Figma; use ImageView/AsyncImage",
          };
          break;
        }
      }

      const strokes = (node.strokes || []).filter((s) => s.visible !== false);
      if (strokes.length && strokes[0].type === "SOLID") {
        const hex = rgbaToHex(strokes[0].color, strokes[0].opacity ?? 1);
        out.border = {
          color: hex,
          width: px(node.strokeWeight || 1),
        };
        this.trackColor(hex, (node.name || "") + "_border");
      }

      if (typeof node.cornerRadius === "number")
        out.corner_radius = px(node.cornerRadius);
      else if (Array.isArray(node.rectangleCornerRadii)) {
        const [tl, tr, br, bl] = node.rectangleCornerRadii;
        out.corner_radius = {
          tl: px(tl),
          tr: px(tr),
          br: px(br),
          bl: px(bl),
        };
      }

      const shadows = (node.effects || [])
        .filter((e) => e.visible !== false)
        .filter((e) => e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW")
        .map((e) => ({
          type: e.type,
          dx: px(e.offset?.x || 0),
          dy: px(e.offset?.y || 0),
          blur: px(e.radius || 0),
          color: rgbaToHex(e.color),
        }));
      if (shadows.length) out.shadows = shadows;

      if (node.type === "TEXT") {
        const s = node.style || {};
        const tf = (node.fills || [])[0];
        let color = null;
        if (tf && tf.type === "SOLID") {
          color = rgbaToHex(tf.color, tf.opacity ?? 1);
          this.trackColor(color, (node.name || "") + "_text");
        }
        const text = node.characters || "";
        const translatable = isTranslatableText(text);
        if (translatable) this.translatableCount++;

        const ts = {
          text,
          is_translatable: translatable,
          // Hint to AI: if true, this text sits next to siblings horizontally
          // → must use weight/flex strategy, never wrap_content with siblings.
          in_horizontal_container: parentLayoutMode === "HORIZONTAL",
          fontFamily: s.fontFamily || null,
          fontSize: s.fontSize ? Math.round(s.fontSize) : null,
          fontWeight: s.fontWeight || null,
          italic: !!s.italic,
          lineHeight: s.lineHeightPx ? Math.round(s.lineHeightPx) : null,
          letterSpacing: s.letterSpacing ?? null,
          align: (s.textAlignHorizontal || "LEFT").toLowerCase(),
          color,
        };
        out.text = ts;

        const sig = `${ts.fontFamily}|${ts.fontSize}|${ts.fontWeight}|${ts.color}`;
        if (!this.textStyles.find((t) => t._sig === sig)) {
          this.textStyles.push({
            fontFamily: ts.fontFamily,
            fontSize: ts.fontSize,
            fontWeight: ts.fontWeight,
            color: ts.color,
            _sig: sig,
          });
        }
        delete out.background;
      }

      if (node.type === "INSTANCE") {
        out.instance_of = node.componentId || null;
        out.hint = "reuse via <include/> or dedicated component";
      } else if (node.type === "COMPONENT") {
        out.hint = "Figma component — emit as separate file";
      }

      const VECTOR_TYPES = [
        "VECTOR",
        "BOOLEAN_OPERATION",
        "STAR",
        "ELLIPSE",
        "REGULAR_POLYGON",
        "LINE",
      ];
      if (VECTOR_TYPES.includes(node.type)) {
        out.asset = "export from Figma → vector drawable / SVG";
        return out;
      }

      const kids = node.children || [];
      if (kids.length) {
        const cleaned = kids
          .map((c) => this.clean(c, depth + 1, node.layoutMode || null))
          .filter(Boolean);
        if (cleaned.length) out.children = cleaned;
      }
      return out;
    }

    designTokens() {
      return {
        colors: Array.from(this.colors.entries()).map(([hex, name]) => ({
          name,
          value: hex,
        })),
        text_styles: this.textStyles.map(({ _sig, ...r }) => r),
      };
    }

    summary() {
      return {
        translatable_text_nodes: this.translatableCount,
        horizontal_containers: this.horizontalContainerCount,
        unique_colors: this.colors.size,
        unique_text_styles: this.textStyles.length,
      };
    }
  }

  // ===================================================================
  // PROMPT BUILDER
  // ===================================================================

  function buildRuleFileSection(ruleFile) {
    if (!ruleFile || !ruleFile.trim()) return "";
    const f = ruleFile.trim();
    return `## ⚠️ CRITICAL — Read project conventions first

Before generating ANY code or making any decision, **read carefully** the file:

\`${f}\`

It is located in the project root. This file defines team-wide conventions (naming, structure, accessibility, theming, dependency-injection patterns, code style) that **supersede every default suggested in this prompt**. Follow ALL rules stated there.

**If the file does not exist or is unreadable:** stop immediately and tell the user — do not guess.

---

`;
  }

  function walkCleanTree(node, visit, depth = 0) {
    if (!node) return;
    visit(node, depth);
    (node.children || []).forEach((child) =>
      walkCleanTree(child, visit, depth + 1)
    );
  }

  function buildAndroidSuggestions({ cleaned, tokens, summary, platform }) {
    if (!["android_xml", "compose"].includes(platform)) return "";

    const stats = {
      nodes: 0,
      textNodes: 0,
      horizontalTextNodes: 0,
      assets: 0,
      instances: 0,
      rounded: 0,
      shadows: 0,
      maxDepth: 0,
      layouts: new Set(),
    };

    walkCleanTree(cleaned, (node, depth) => {
      stats.nodes++;
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      if (node.layout?.orientation) stats.layouts.add(node.layout.orientation);
      if (node.text) {
        stats.textNodes++;
        if (node.text.in_horizontal_container) stats.horizontalTextNodes++;
      }
      if (node.asset || node.background_image) stats.assets++;
      if (node.instance_of) stats.instances++;
      if (node.corner_radius) stats.rounded++;
      if (node.shadows?.length) stats.shadows += node.shadows.length;
    });

    const root = cleaned || {};
    const bounds = root.bounds
      ? `${root.bounds.w}dp x ${root.bounds.h}dp`
      : "unknown size";
    const rootLayout = root.layout?.orientation || "freeform / absolute";
    const colorCount = tokens?.colors?.length ?? summary?.unique_colors ?? 0;
    const textStyleCount =
      tokens?.text_styles?.length ?? summary?.unique_text_styles ?? 0;
    const textCount = summary?.translatable_text_nodes ?? stats.textNodes;

    if (platform === "compose") {
      return `## Android code suggestions

Use these as implementation hints before writing code:

- Root composable: create a screen-level composable sized from the Figma root (${bounds}); map root layout "${rootLayout}" to Column, Row, Box, or ConstraintLayout as appropriate.
- State shape: expose a stateless \`@Composable\` with callback parameters; keep ViewModel/repository logic outside this generated UI.
- Layout safety: ${stats.horizontalTextNodes} text node(s) sit in horizontal containers, so use \`Modifier.weight(1f)\`, \`maxLines\`, and \`TextOverflow.Ellipsis\` where siblings can compete for width.
- Theme split: map ${colorCount} color token(s) into \`Color.kt\` and ${textStyleCount} text style(s) into Material3 typography extensions.
- Asset plan: ${stats.assets} image/vector node(s) should become \`res/drawable\` assets; do not recreate complex vectors by hand unless explicitly requested.
- Component reuse: ${stats.instances} Figma instance(s) should become small reusable composables.
- Preview coverage: add previews for default, dark mode if supported, and one long-text locale.

Suggested Compose skeleton:

\`\`\`kotlin
@Composable
fun GeneratedScreen(
    modifier: Modifier = Modifier,
    onAction: (GeneratedAction) -> Unit = {},
) {
    // Map the cleaned Figma tree into Material3 components.
}
\`\`\`
`;
    }

    return `## Android code suggestions

Use these as implementation hints before writing XML/Kotlin:

- Root layout: start from \`ConstraintLayout\` unless the root Figma auto-layout "${rootLayout}" is clearly linear; Figma root size is ${bounds}.
- Resource split: define ${colorCount} color token(s) in \`colors.xml\`, ${textStyleCount} repeated text style(s) in \`styles.xml\`, and every visible string in \`strings.xml\`.
- Text safety: ${textCount} translatable text node(s) detected; ${stats.horizontalTextNodes} are inside horizontal containers and need \`0dp\` width + weight or constrained chains.
- Components: ${stats.instances} Figma instance(s) should become included child layouts or reusable custom views instead of duplicated XML.
- Assets: ${stats.assets} image/vector node(s) should be exported to \`res/drawable\`; wire \`contentDescription\` for meaningful images.
- Surface polish: ${stats.rounded} rounded node(s) and ${stats.shadows} shadow effect(s) likely map to \`MaterialCardView\`, shape drawables, or elevation.

Suggested XML skeleton:

\`\`\`xml
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <!-- Build from the cleaned Figma tree and extracted resources. -->

</androidx.constraintlayout.widget.ConstraintLayout>
\`\`\`
`;
  }

  function buildPrompt({
    cleaned,
    tokens,
    summary,
    raw,
    platform,
    notes,
    imageFiles,
    customTemplate,
    ruleFile,
    i18nMode,
    androidSuggestions,
  }) {
    const tpl =
      customTemplate?.trim() || TEMPLATES[platform] || TEMPLATES.raw;

    const enriched = {
      _meta: {
        source: "Figma Prompt Forge",
        version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
        summary,
      },
      design_tokens: tokens,
      tree: cleaned,
    };
    if (raw) enriched._raw_uncleaned = raw;

    const jsonStr = JSON.stringify(enriched, null, 2);

    let imagesSection = "";
    if (imageFiles && imageFiles.length) {
      const list = imageFiles
        .map((f) => {
          const kb = (f.size / 1024).toFixed(1);
          return `- \`./${f.name}\` — ${f.type || "image"} · ${kb} KB`;
        })
        .join("\n");
      imagesSection = `## Reference images

The following images are attached alongside this prompt. Examine them to verify visual fidelity — the JSON gives structure, the images give ground truth.

${list}
`;
    }

    const notesStr =
      notes && notes.trim()
        ? notes.trim()
        : "_(none provided — use sensible defaults from the rule file)_";

    const i18nRulesStr = i18nMode ? I18N_RULES[platform] || "" : "";
    const hasAndroidSuggestionSlot = /\{\{androidSuggestions\}\}/.test(tpl);

    const rendered = tpl
      .replace(/\{\{ruleFileSection\}\}/g, buildRuleFileSection(ruleFile))
      .replace(/\{\{ruleFile\}\}/g, ruleFile || "")
      .replace(/\{\{i18nRules\}\}/g, i18nRulesStr)
      .replace(/\{\{json\}\}/g, jsonStr)
      .replace(/\{\{notes\}\}/g, notesStr)
      .replace(/\{\{images\}\}/g, imagesSection)
      .replace(/\{\{androidSuggestions\}\}/g, androidSuggestions || "")
      .replace(/\{\{rawJson\}\}/g, raw ? JSON.stringify(raw, null, 2) : "");

    if (androidSuggestions && !hasAndroidSuggestionSlot) {
      return `${rendered.trimEnd()}\n\n${androidSuggestions}`;
    }
    return rendered;
  }

  // ===================================================================
  // DOWNLOAD / EXPORT
  // ===================================================================

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function buildZip({ promptText, images, fileBase }) {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip chưa load — kiểm tra kết nối mạng");
    }
    const zip = new JSZip();
    zip.file(`${fileBase}.prompt.txt`, promptText);
    if (images?.length) {
      for (const img of images) zip.file(img.name, img);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    return blob;
  }

  // ===================================================================
  // UI
  // ===================================================================

  const $ = (sel) => document.querySelector(sel);

  function setStatus(text, kind = "") {
    const el = $("#status");
    el.textContent = text || "";
    el.className = "status" + (kind ? ` is-${kind}` : "");
  }

  function showOutput(text, fileBase, hasImages) {
    $("#outputEmpty").hidden = true;
    const pre = $("#outputPre");
    pre.hidden = false;
    pre.textContent = text;
    $("#exportBar").hidden = false;

    const chars = text.length;
    const tokens = Math.round(chars / 4);
    $("#exportSize").textContent = chars.toLocaleString() + " chars";
    $("#exportTokens").textContent = "~" + tokens.toLocaleString() + " tok";
    $("#outputMeta").textContent =
      chars.toLocaleString() + " chars · ~" + tokens.toLocaleString() + " tokens";

    $("#downloadLabel").textContent = hasImages
      ? "Download .zip"
      : "Download .txt";

    $("#downloadBtn").dataset.fileBase = fileBase;
  }

  function resetOutput() {
    $("#outputEmpty").hidden = false;
    $("#outputPre").hidden = true;
    $("#outputPre").textContent = "";
    $("#exportBar").hidden = true;
    $("#outputMeta").textContent = "";
    clearFigmaPreview();
  }

  let currentPreviewUrl = "";

  function clearFigmaPreview() {
    const wrap = $("#figmaPreview");
    const img = $("#figmaPreviewImg");
    if (!wrap || !img) return;
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = "";
    img.removeAttribute("src");
    wrap.hidden = true;
  }

  function showFigmaPreview(blob, nodeName) {
    const wrap = $("#figmaPreview");
    const img = $("#figmaPreviewImg");
    if (!wrap || !img || !blob) return;
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = URL.createObjectURL(blob);
    img.src = currentPreviewUrl;
    $("#figmaPreviewTitle").textContent = nodeName || "Selected node";
    $("#figmaPreviewMeta").textContent = `${(blob.size / 1024).toFixed(1)} KB`;
    wrap.hidden = false;
  }

  // --- Image handling -------------------------------------------------
  const imageStore = [];

  function renderThumbs() {
    const wrap = $("#thumbs");
    wrap.innerHTML = "";
    imageStore.forEach((f, idx) => {
      const div = document.createElement("div");
      div.className = "thumb";
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.alt = f.name;
      img.onload = () => URL.revokeObjectURL(img.src);
      const name = document.createElement("div");
      name.className = "thumb__name";
      name.textContent = f.name;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb__remove";
      btn.textContent = "×";
      btn.setAttribute("aria-label", "Remove");
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        imageStore.splice(idx, 1);
        renderThumbs();
      };
      div.append(img, name, btn);
      wrap.appendChild(div);
    });
  }

  function addFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const renamed =
        safe === f.name ? f : new File([f], safe, { type: f.type });
      imageStore.push(renamed);
    }
    renderThumbs();
  }

  // --- Rule file per-platform memory ---------------------------------
  function loadRuleFileOverrides() {
    try {
      return JSON.parse(localStorage.getItem(RULE_FILE_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveRuleFileOverride(platform, value) {
    const all = loadRuleFileOverrides();
    if (!value || value === DEFAULT_RULE_FILES[platform]) {
      delete all[platform];
    } else {
      all[platform] = value;
    }
    localStorage.setItem(RULE_FILE_STORAGE_KEY, JSON.stringify(all));
  }
  function getCurrentRuleFile(platform) {
    const overrides = loadRuleFileOverrides();
    return overrides[platform] ?? DEFAULT_RULE_FILES[platform] ?? "";
  }

  // --- INIT -----------------------------------------------------------
  function init() {
    $("#year").textContent = new Date().getFullYear();

    // Repo link discovery on GitHub Pages
    const host = location.hostname;
    if (host.endsWith("github.io")) {
      const user = host.split(".")[0];
      const path = location.pathname.split("/").filter(Boolean)[0];
      if (user && path) {
        $("#repoLink").href = `https://github.com/${user}/${path}`;
      }
    }

    // Restore token
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (savedToken) {
      $("#token").value = savedToken;
      $("#rememberToken").checked = true;
    }

    // Initialize rule file from current platform
    const initialPlatform = document.querySelector(
      'input[name="platform"]:checked'
    ).value;
    $("#ruleFile").value = getCurrentRuleFile(initialPlatform);

    // Token visibility toggle
    $("#toggleToken").addEventListener("click", () => {
      const inp = $("#token");
      const open = $("#eyeOpen");
      const closed = $("#eyeClosed");
      if (inp.type === "password") {
        inp.type = "text";
        open.hidden = true;
        closed.hidden = false;
      } else {
        inp.type = "password";
        open.hidden = false;
        closed.hidden = true;
      }
    });

    // Advanced collapsible
    const advBtn = $("#advancedToggle");
    const advBody = $("#advancedBody");
    advBtn.addEventListener("click", () => {
      const open = advBtn.getAttribute("aria-expanded") === "true";
      advBtn.setAttribute("aria-expanded", String(!open));
      advBody.hidden = open;
    });

    // Update rule file placeholder/value when platform changes
    document.querySelectorAll('input[name="platform"]').forEach((r) => {
      r.addEventListener("change", () => {
        const p = r.value;
        $("#ruleFile").value = getCurrentRuleFile(p);
        $("#ruleFile").placeholder =
          DEFAULT_RULE_FILES[p] || "(no rule file)";
      });
    });

    // Persist rule file changes per platform
    $("#ruleFile").addEventListener("change", (e) => {
      const p = document.querySelector('input[name="platform"]:checked').value;
      saveRuleFileOverride(p, e.target.value.trim());
    });

    // Dropzone
    const dz = $("#dropzone");
    const fileInput = $("#images");
    fileInput.addEventListener("change", (e) => {
      addFiles(e.target.files);
      fileInput.value = "";
    });
    ["dragenter", "dragover"].forEach((evt) =>
      dz.addEventListener(evt, (e) => {
        e.preventDefault();
        dz.classList.add("is-drag");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dz.addEventListener(evt, (e) => {
        e.preventDefault();
        dz.classList.remove("is-drag");
      })
    );
    dz.addEventListener("drop", (e) => {
      if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
    });

    // Reset
    $("#resetBtn").addEventListener("click", () => {
      $("#forgeForm").reset();
      imageStore.length = 0;
      renderThumbs();
      resetOutput();
      setStatus("", "");
      // Restore token + rule file
      const t = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (t) {
        $("#token").value = t;
        $("#rememberToken").checked = true;
      }
      const p = document.querySelector('input[name="platform"]:checked').value;
      $("#ruleFile").value = getCurrentRuleFile(p);
      $("#i18nMode").checked = true;
      $("#previewFigma").checked = true;
      $("#includeAndroidSuggestions").checked = true;
    });

    // Copy
    $("#copyBtn").addEventListener("click", async () => {
      const txt = $("#outputPre").textContent;
      try {
        await navigator.clipboard.writeText(txt);
        const btn = $("#copyBtn");
        const span = btn.querySelector("span");
        const old = span.textContent;
        span.textContent = "Copied";
        setTimeout(() => (span.textContent = old), 1400);
      } catch {
        setStatus("Không copy được — trình duyệt chặn clipboard", "error");
      }
    });

    // Download
    $("#downloadBtn").addEventListener("click", async () => {
      const fileBase =
        $("#downloadBtn").dataset.fileBase || "figma_prompt";
      const txt = $("#outputPre").textContent;
      const hasExtras = imageStore.length > 0;
      try {
        if (hasExtras) {
          const blob = await buildZip({
            promptText: txt,
            images: imageStore,
            fileBase,
          });
          triggerDownload(blob, `${fileBase}.zip`);
        } else {
          triggerDownload(
            new Blob([txt], { type: "text/plain" }),
            `${fileBase}.txt`
          );
        }
      } catch (err) {
        setStatus(`Lỗi tải file: ${err.message}`, "error");
      }
    });

    // Submit
    $("#forgeForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = $("#token").value.trim();
      const url = $("#url").value.trim();
      const platform = document.querySelector(
        'input[name="platform"]:checked'
      ).value;
      const notes = $("#notes").value;
      const customTemplate = $("#customTemplate").value;
      const ruleFile = $("#ruleFile").value.trim();
      const i18nMode = $("#i18nMode").checked;
      const previewFigma = $("#previewFigma").checked;
      const includeAndroidSuggestions = $("#includeAndroidSuggestions").checked;
      const fetchScreenshot = $("#fetchScreenshot").checked;
      const includeRaw = $("#includeRaw").checked;
      const remember = $("#rememberToken").checked;

      if (!token) return setStatus("Cần Figma token", "error");
      if (!url) return setStatus("Cần Figma URL", "error");

      if (remember) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      saveRuleFileOverride(platform, ruleFile);

      const btn = $("#forgeBtn");
      btn.disabled = true;
      setStatus("Fetching Figma node…", "loading");
      clearFigmaPreview();

      try {
        const { fileKey, nodeId } = parseFigmaUrl(url);

        const node = await fetchNode(token, fileKey, nodeId);

        setStatus("Cleaning tree & extracting tokens…", "loading");
        const cleaner = new Cleaner();
        const cleaned = cleaner.clean(node);
        const designTokens = cleaner.designTokens();
        const summary = cleaner.summary();

        let renderBlob = null;
        if (previewFigma || fetchScreenshot) {
          setStatus("Fetching Figma render…", "loading");
          renderBlob = await fetchNodeImage(token, fileKey, nodeId, 2).catch(
            () => null
          );
          if (renderBlob && previewFigma) {
            showFigmaPreview(renderBlob, node.name);
          }
          if (renderBlob && fetchScreenshot) {
            const ssName = `${(node.name || "figma")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")}_render.png`;
            if (!imageStore.some((f) => f.name === ssName)) {
              const ssFile = new File([renderBlob], ssName, {
                type: "image/png",
              });
              imageStore.push(ssFile);
              renderThumbs();
            }
          }
        }

        const androidSuggestions = includeAndroidSuggestions
          ? buildAndroidSuggestions({
              cleaned,
              tokens: designTokens,
              summary,
              platform,
            })
          : "";

        const promptText = buildPrompt({
          cleaned,
          tokens: designTokens,
          summary,
          raw: includeRaw ? node : null,
          platform,
          notes,
          imageFiles: imageStore,
          customTemplate,
          ruleFile,
          i18nMode,
          androidSuggestions,
        });

        const safeName =
          (node.name || "figma_prompt")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 48) || "figma_prompt";

        showOutput(promptText, safeName, imageStore.length > 0);

        const rawSize = JSON.stringify(node).length;
        const cleanSize = JSON.stringify({
          design_tokens: designTokens,
          tree: cleaned,
        }).length;
        const saved = Math.max(
          0,
          Math.round((1 - cleanSize / Math.max(rawSize, 1)) * 100)
        );
        const i18nInfo = i18nMode
          ? ` · ${summary.translatable_text_nodes} translatable text node(s)`
          : "";
        setStatus(
          `Done · raw ${rawSize.toLocaleString()} → cleaned ${cleanSize.toLocaleString()} chars (−${saved}%)${i18nInfo}`,
          "success"
        );
      } catch (err) {
        console.error(err);
        setStatus(err.message || String(err), "error");
        resetOutput();
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
