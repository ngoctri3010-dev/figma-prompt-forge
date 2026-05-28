/* =====================================================================
   PROMPT FORGE — app.js
   Figma → cleaned JSON → LLM-ready prompt, 100% client-side.
   --------------------------------------------------------------------- */

(() => {
  "use strict";

  // ===================================================================
  // CONSTANTS
  // ===================================================================

  const FIGMA_API = "https://api.figma.com/v1";
  const TOKEN_STORAGE_KEY = "pf.figma_token";
  const PROMPT_VERSION = "1.0";

  // Prompt templates per target platform.
  // {{json}}, {{notes}}, {{images}}, {{rawJson}} are placeholders.
  const TEMPLATES = {
    android_xml: `# Task — Android XML layout generation

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
2. \`app/src/main/res/values/colors.xml\` — only NEW colors (don't redefine existing ones; assume Material3 theme is already set up)
3. \`app/src/main/res/values/dimens.xml\` — extracted dimensions
4. \`app/src/main/res/values/styles.xml\` — repeated text styles as \`<style>\` entries with \`parent="TextAppearance.Material3.*"\` where applicable
5. \`app/src/main/res/values/strings.xml\` — all user-visible strings
6. **Asset list** — bullet list of drawable resources that must be exported manually from Figma (icons, illustrations) with suggested filenames

## Rules
- Match Figma component instances to Material3 widgets when possible (MaterialButton, TextInputLayout, MaterialCardView, etc.)
- For nodes typed \`INSTANCE\`, prefer \`<include layout="@layout/..."/>\` and emit a separate layout file for the included view
- Use \`android:elevation\` for simple shadows; fall back to layer-list drawables only for complex shadow specs
- Make all text accessible: \`android:contentDescription\` on ImageViews, \`android:importantForAccessibility\` where appropriate
- Do not invent colors or sizes — use the values from the JSON below

## Figma extraction (Android-optimized JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

## Additional requirements

{{notes}}

## Final checklist
Before responding, verify: (a) every node in the JSON is represented, (b) constraint relationships are stated explicitly, (c) no hardcoded strings remain in the layout XML, (d) colors / dimens / styles are properly extracted to resource files.
`,

    compose: `# Task — Jetpack Compose UI generation

You are a senior Android engineer specialized in Jetpack Compose. Produce production-grade Compose code from the Figma extraction below.

## Target stack
- Language: Kotlin
- UI: Jetpack Compose (BOM 2024.x or later)
- Compose Material3
- Min SDK: 24
- State hoisting + stateless composables
- Theme tokens via MaterialTheme.colorScheme / typography / shapes when they map cleanly; otherwise pass explicit values

## Output format
Return each file as a separate code block with its full path:

1. \`ui/screens/<ScreenName>Screen.kt\` — top-level composable
2. \`ui/components/*.kt\` — one file per reusable component (one per Figma COMPONENT or INSTANCE-of-same-component)
3. \`ui/theme/Color.kt\` — new colors only
4. \`ui/theme/Type.kt\` — text style additions if any
5. \`ui/preview/<ScreenName>Previews.kt\` — \`@Preview\` functions (Light + Dark, phone + tablet)
6. **Asset list** — drawables / vectors to be added to \`res/drawable/\`

## Rules
- Use \`Modifier\` chaining in canonical order: layout → behavior → appearance
- Prefer \`Spacer\` + \`Modifier.padding\` over magic margins
- For auto-layout HORIZONTAL → \`Row\`, VERTICAL → \`Column\`, NONE → \`Box\` (with Modifier.fillMaxSize + child alignment) or \`ConstraintLayout\`
- INSTANCE nodes → invoke a dedicated composable
- All hardcoded text strings: extract to \`stringResource(R.string.*)\`
- No \`!!\` or unchecked casts

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

## Additional requirements

{{notes}}
`,

    swiftui: `# Task — SwiftUI view generation

You are a senior iOS engineer with deep SwiftUI experience. Produce production-grade SwiftUI code from the Figma extraction below.

## Target stack
- Swift 5.9+, SwiftUI
- iOS 16+ deployment target
- No third-party dependencies
- Localization via String catalogs / \`LocalizedStringKey\`

## Output format
Return each file as a separate code block with its full path:

1. \`Views/<Name>View.swift\` — main screen
2. \`Components/*.swift\` — one file per reusable subview
3. \`Theme/Colors.swift\` — color definitions (asset catalog references preferred)
4. \`Theme/Typography.swift\` — text styles as \`Font\` extensions
5. \`Previews/<Name>Previews.swift\` — \`#Preview\` blocks (Light + Dark)

## Rules
- Map Figma HORIZONTAL auto-layout → \`HStack\`, VERTICAL → \`VStack\`, NONE → \`ZStack\` or \`overlay/background\`
- Use \`spacing:\` parameter from auto-layout itemSpacing
- Padding via \`.padding(.init(top:, leading:, bottom:, trailing:))\`
- Corner radius via \`.clipShape(RoundedRectangle(cornerRadius:))\`
- Shadows via \`.shadow(color:radius:x:y:)\`
- INSTANCE nodes → dedicated \`View\` struct
- All strings localized

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

## Additional requirements

{{notes}}
`,

    react_tsx: `# Task — React + Tailwind component generation

You are a senior frontend engineer. Produce production-grade React + TypeScript code from the Figma extraction below.

## Target stack
- React 18 + TypeScript (strict)
- Tailwind CSS v3.x
- Headless UI / Radix primitives for interactive components
- Accessibility: WCAG 2.1 AA
- No inline styles unless absolutely necessary (use Tailwind \`arbitrary values\` for one-off design tokens)

## Output format
Return each file as a separate code block with its full path:

1. \`src/components/<Name>/<Name>.tsx\`
2. \`src/components/<Name>/index.ts\` — barrel export
3. \`tailwind.config.ts\` — additions to the theme (colors, fontFamily, spacing) only if needed; otherwise mark as "no changes"
4. Subcomponents under \`src/components/<Name>/parts/*.tsx\`

## Rules
- Strongly typed Props interfaces, exported
- Use Tailwind's spacing scale; fall back to arbitrary values (\`pt-[18px]\`) only when the design demands it
- Auto-layout HORIZONTAL → \`flex flex-row\`, VERTICAL → \`flex flex-col\` with \`gap-*\` for itemSpacing
- Corner radius → \`rounded-*\` (or arbitrary)
- Map colors to Tailwind theme extensions, give them semantic names (e.g. \`brand.500\`)
- All text content as props; never hardcode user-visible strings

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

## Additional requirements

{{notes}}
`,

    flutter: `# Task — Flutter widget generation

You are a senior Flutter engineer. Produce production-grade Dart code from the Figma extraction below.

## Target stack
- Flutter 3.16+, Dart 3+
- Material 3 (\`useMaterial3: true\`)
- Null-safe
- No third-party dependencies unless strictly necessary

## Output format
Return each file as a separate code block with its full path:

1. \`lib/screens/<name>_screen.dart\` — main screen widget
2. \`lib/widgets/*.dart\` — one file per reusable widget
3. \`lib/theme/colors.dart\` — color additions
4. \`lib/theme/typography.dart\` — text style additions
5. \`lib/l10n/intl_en.arb\` snippet — string additions

## Rules
- StatelessWidget by default; StatefulWidget only when state is needed
- Auto-layout HORIZONTAL → \`Row\`, VERTICAL → \`Column\`, NONE → \`Stack\`
- itemSpacing → \`SizedBox\` between children OR \`spacing:\` once it lands
- Use \`Theme.of(context).colorScheme.*\` when colors map cleanly; otherwise explicit
- Constants in dp (Flutter logical pixels = Figma px at 1x)
- Const constructors wherever possible
- All user-visible strings via \`AppLocalizations.of(context)!.*\`

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

## Additional requirements

{{notes}}
`,

    raw: `# Task — UI code generation from Figma data

Below is a cleaned extraction of a Figma node. Generate UI code from it.

## Figma extraction (cleaned JSON)

\`\`\`json
{{json}}
\`\`\`

{{images}}

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
    const nodeId = nodeMatch ? decodeURIComponent(nodeMatch[1]).replace(/-/g, ":") : null;
    if (!nodeId) {
      throw new Error("URL phải chứa node-id (chọn 1 frame trong Figma rồi copy link)");
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
    if (!nodeData) throw new Error(`Không tìm thấy node ${nodeId} trong file`);
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
  // CLEANER — Figma node tree → Android-friendly minimal tree
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
    if (a < 0.999) return `#${hex(Math.round(a * 255))}${hex(r)}${hex(g)}${hex(b)}`;
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  function px(n) {
    return `${Math.round(n)}dp`;
  }

  class Cleaner {
    constructor() {
      this.colors = new Map(); // hex -> name suggestion
      this.textStyles = []; // dedup'd
    }

    trackColor(hex, hint) {
      if (!hex) return;
      if (this.colors.has(hex)) return;
      const slug =
        (hint || "color")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 24) || "color";
      this.colors.set(hex, slug);
    }

    clean(node, depth = 0) {
      if (!node || node.visible === false) return null;
      if (depth > 14) return { name: node.name, type: node.type, _truncated: true };

      const out = {
        name: node.name || "",
        type: node.type || "",
      };

      const bb = node.absoluteBoundingBox;
      if (bb) {
        out.bounds = {
          x: Math.round(bb.x || 0),
          y: Math.round(bb.y || 0),
          w: Math.round(bb.width || 0),
          h: Math.round(bb.height || 0),
        };
      }

      // Auto-layout
      if (node.layoutMode && node.layoutMode !== "NONE") {
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
          main_align: ALIGN_MAP[node.primaryAxisAlignItems || "MIN"] || "start",
          cross_align: ALIGN_MAP[node.counterAxisAlignItems || "MIN"] || "start",
        };
      }

      // Fills
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

      // Strokes
      const strokes = (node.strokes || []).filter((s) => s.visible !== false);
      if (strokes.length && strokes[0].type === "SOLID") {
        const hex = rgbaToHex(strokes[0].color, strokes[0].opacity ?? 1);
        out.border = {
          color: hex,
          width: px(node.strokeWeight || 1),
        };
        this.trackColor(hex, (node.name || "") + "_border");
      }

      // Corner radius
      if (typeof node.cornerRadius === "number") {
        out.corner_radius = px(node.cornerRadius);
      } else if (Array.isArray(node.rectangleCornerRadii)) {
        const [tl, tr, br, bl] = node.rectangleCornerRadii;
        out.corner_radius = {
          tl: px(tl),
          tr: px(tr),
          br: px(br),
          bl: px(bl),
        };
      }

      // Effects (shadow)
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

      // Text
      if (node.type === "TEXT") {
        const s = node.style || {};
        const tf = (node.fills || [])[0];
        let color = null;
        if (tf && tf.type === "SOLID") {
          color = rgbaToHex(tf.color, tf.opacity ?? 1);
          this.trackColor(color, (node.name || "") + "_text");
        }
        const ts = {
          text: node.characters || "",
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
          this.textStyles.push({ ...ts, _sig: sig });
        }
        delete out.background; // fill of TEXT is text color, not bg
      }

      // Component refs
      if (node.type === "INSTANCE") {
        out.instance_of = node.componentId || null;
        out.hint = "reuse via <include/> or dedicated component";
      } else if (node.type === "COMPONENT") {
        out.hint = "Figma component — emit as separate file";
      }

      // Vectors / icons — don't recurse; mark for asset export
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

      // Recurse
      const kids = node.children || [];
      if (kids.length) {
        const cleaned = kids.map((c) => this.clean(c, depth + 1)).filter(Boolean);
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
        text_styles: this.textStyles.map(({ _sig, ...rest }) => rest),
      };
    }
  }

  // ===================================================================
  // PROMPT BUILDER
  // ===================================================================

  function buildPrompt({ cleaned, tokens, raw, platform, notes, imageFiles, customTemplate }) {
    const tpl = customTemplate?.trim() || TEMPLATES[platform] || TEMPLATES.raw;

    const enriched = {
      _meta: {
        source: "Figma Prompt Forge",
        version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      },
      design_tokens: tokens,
      tree: cleaned,
    };
    if (raw) enriched._raw_uncleaned = raw;

    const jsonStr = JSON.stringify(enriched, null, 2);

    let imagesSection = "";
    if (imageFiles && imageFiles.length) {
      const list = imageFiles
        .map((f, i) => `- \`./${f.name}\` — ${describeImage(f, i)}`)
        .join("\n");
      imagesSection = `## Reference images

The following images are attached alongside this prompt file. Examine them to verify visual fidelity (color exactness, spacing, hierarchy) — the JSON above gives structure, the images give ground truth.

${list}
`;
    }

    const notesStr =
      notes && notes.trim() ? notes.trim() : "_(none provided — use sensible defaults)_";

    return tpl
      .replace(/\{\{json\}\}/g, jsonStr)
      .replace(/\{\{notes\}\}/g, notesStr)
      .replace(/\{\{images\}\}/g, imagesSection)
      .replace(/\{\{rawJson\}\}/g, raw ? JSON.stringify(raw, null, 2) : "");
  }

  function describeImage(file, i) {
    const kb = (file.size / 1024).toFixed(1);
    return `${file.type || "image"} · ${kb} KB`;
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

  function showOutput(text, fileBase, hasImagesOrScreenshot) {
    $("#outputEmpty").hidden = true;
    const pre = $("#outputPre");
    pre.hidden = false;
    pre.textContent = text;
    $("#exportBar").hidden = false;

    const chars = text.length;
    const tokens = Math.round(chars / 4); // rough estimate
    $("#exportSize").textContent = chars.toLocaleString();
    $("#exportTokens").textContent = `~${tokens.toLocaleString()}`;
    $("#outputMeta").textContent = `${chars.toLocaleString()} chars · ~${tokens.toLocaleString()} tokens`;

    $("#downloadLabel").textContent = hasImagesOrScreenshot
      ? "download .zip"
      : "download .txt";

    $("#downloadBtn").dataset.fileBase = fileBase;
  }

  function resetOutput() {
    $("#outputEmpty").hidden = false;
    $("#outputPre").hidden = true;
    $("#outputPre").textContent = "";
    $("#exportBar").hidden = true;
    $("#outputMeta").textContent = "";
  }

  // --- Image handling -------------------------------------------------
  const imageStore = []; // File[]

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
      // sanitize filename
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const renamed = safe === f.name ? f : new File([f], safe, { type: f.type });
      imageStore.push(renamed);
    }
    renderThumbs();
  }

  // --- INIT -----------------------------------------------------------
  function init() {
    $("#year").textContent = new Date().getFullYear();

    // Repo link - try to discover from current URL on github pages
    const host = location.hostname;
    if (host.endsWith("github.io")) {
      const user = host.split(".")[0];
      const path = location.pathname.split("/").filter(Boolean)[0];
      if (user && path) {
        $("#repoLink").href = `https://github.com/${user}/${path}`;
      }
    }

    // Restore token
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) {
      $("#token").value = saved;
      $("#rememberToken").checked = true;
    }

    // Toggle token visibility
    $("#toggleToken").addEventListener("click", () => {
      const inp = $("#token");
      const btn = $("#toggleToken");
      if (inp.type === "password") {
        inp.type = "text";
        btn.textContent = "hide";
      } else {
        inp.type = "password";
        btn.textContent = "show";
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
      const saved2 = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (saved2) {
        $("#token").value = saved2;
        $("#rememberToken").checked = true;
      }
    });

    // Copy
    $("#copyBtn").addEventListener("click", async () => {
      const txt = $("#outputPre").textContent;
      try {
        await navigator.clipboard.writeText(txt);
        const btn = $("#copyBtn");
        const old = btn.textContent;
        btn.textContent = "copied ✓";
        setTimeout(() => (btn.textContent = old), 1400);
      } catch {
        setStatus("Không copy được — trình duyệt chặn clipboard", "error");
      }
    });

    // Download
    $("#downloadBtn").addEventListener("click", async () => {
      const fileBase = $("#downloadBtn").dataset.fileBase || "figma_prompt";
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
          triggerDownload(new Blob([txt], { type: "text/plain" }), `${fileBase}.txt`);
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
      const platform = document.querySelector('input[name="platform"]:checked').value;
      const notes = $("#notes").value;
      const customTemplate = $("#customTemplate").value;
      const fetchScreenshot = $("#fetchScreenshot").checked;
      const includeRaw = $("#includeRaw").checked;
      const remember = $("#rememberToken").checked;

      if (!token) return setStatus("Cần Figma token", "error");
      if (!url) return setStatus("Cần Figma URL", "error");

      // Persist token only if explicit opt-in
      if (remember) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }

      const btn = $("#forgeBtn");
      btn.disabled = true;
      setStatus("fetching figma node…", "loading");

      try {
        const { fileKey, nodeId } = parseFigmaUrl(url);

        const node = await fetchNode(token, fileKey, nodeId);

        setStatus("cleaning tree & extracting tokens…", "loading");
        const cleaner = new Cleaner();
        const cleaned = cleaner.clean(node);
        const designTokens = cleaner.designTokens();

        // Optional screenshot fetch — push into imageStore so it shows in thumbs
        // and is bundled in the zip naturally.
        if (fetchScreenshot) {
          setStatus("fetching 2x render…", "loading");
          const blob = await fetchNodeImage(token, fileKey, nodeId, 2).catch(
            () => null
          );
          if (blob) {
            const ssName = `${(node.name || "figma").toLowerCase().replace(/[^a-z0-9]+/g, "_")}_render.png`;
            // Avoid duplicate if user re-runs
            if (!imageStore.some((f) => f.name === ssName)) {
              const ssFile = new File([blob], ssName, { type: "image/png" });
              imageStore.push(ssFile);
              renderThumbs();
            }
          }
        }

        const promptText = buildPrompt({
          cleaned,
          tokens: designTokens,
          raw: includeRaw ? node : null,
          platform,
          notes,
          imageFiles: imageStore,
          customTemplate,
        });

        const safeName =
          (node.name || "figma_prompt")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 48) || "figma_prompt";

        showOutput(promptText, safeName, imageStore.length > 0);

        const rawSize = JSON.stringify(node).length;
        const cleanSize = JSON.stringify({ design_tokens: designTokens, tree: cleaned })
          .length;
        const saved = Math.max(
          0,
          Math.round((1 - cleanSize / Math.max(rawSize, 1)) * 100)
        );
        setStatus(
          `done · raw ${rawSize.toLocaleString()} → cleaned ${cleanSize.toLocaleString()} chars (−${saved}%)`,
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
