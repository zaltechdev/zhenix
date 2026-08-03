# Aksa Design Specification

| Field | Value |
| --- | --- |
| Status | Frontend baseline 0.1 |
| Owner | Henix |
| Backend counterpart | Zaltech |

## 1. Purpose

This document controls Aksa's frontend experience: visual language, interaction rules, user flows, responsive behavior, accessibility, interface states, copy, and frontend acceptance.

Aksa is an accessible AI workspace for users with motor impairments. Its product anchor is `Computer Vision + AI Agents + Accessibility`.

It does not define databases, APIs, authentication internals, server-side agents, infrastructure, integrations, or backend QA. It may state the data and states the interface needs.

Product decisions missing from `.agents/prd.md`, `.agents/rules.md`, `.agents/security.md`, or feature documents remain open questions.

Compliance question: the official guidebook says all work must be created during the August 5 to 10, 2026 competition window. Confirm whether this pre-sprint specification may be used in the submitted project.

## 2. Ownership

| Area | Henix | Zaltech |
| --- | --- | --- |
| Frontend | Owns routes, components, client state, interactions | Supplies verified contracts |
| UI/UX | Owns layout, copy, flows, responsive and accessible behavior | Does not redesign UI |
| System behavior | Renders declared states and recovery choices | Owns execution and state truth |
| Data | States display needs | Owns storage, validation, and integrity |
| Security | Presents safe controls and messages | Owns enforcement and secrets |
| QA | Owns frontend, accessibility, browser, responsive tests | Owns backend, integration, security, reliability tests |

The boundary is strict. Henix defines the experience. Zaltech makes system behavior real.

## 3. Experience Principles

### Intent before navigation

Let users state the outcome. Do not force them through menus when voice, text, or a direct action can express the task.

### Calm before spectacle

Use whitespace, restrained motion, and short copy. Visual effects must clarify hierarchy or state.

### Accessibility by default

Every primary action must work through face control, voice or text, keyboard, mouse, and screen readers where applicable.

### Visible agent action

Show the current action, observable status, affected items, and result. Never expose hidden model reasoning.

### Confirmation before consequence

Preview destructive, external, or hard-to-reverse actions. State scope clearly before approval.

### Recovery is part of the flow

Design retry, cancel, edit, and Undo with the main path. Do not add recovery after failure occurs.

### Honest system status

Say `Completed` only after verification. Show partial completion and unknown status directly.

## 4. Visual Direction

### Style: Calm Computational Nature

Aksa combines an editorial landing page, calm nature imagery, restrained product previews, subtle ASCII texture, and generous spacing. The supplied reference image informs composition only: compact navigation, asymmetric hero, thin section rules, and three clear value cards. Do not copy its brand, wording, or product UI.

### Logo

Use existing assets without redrawing:

| Context | Asset |
| --- | --- |
| Default brand use | `logo/Default.svg` |
| Light monochrome use | `logo/BlackMono.svg` |
| Dark monochrome use | `logo/WhiteMono.svg` |
| Compact app icon | `logo/Icon.png` |
| Raster fallback | `logo/Banner.webp` |

Preserve the 500:160 wordmark ratio. Keep clear space at least equal to the cursor highlight width. Do not recolor, stretch, crop, outline, shadow, or animate the logo.

Open question: approve the minimum rendered wordmark width after testing actual navigation layouts.

### Nature imagery

Use one calm landscape or close natural texture per major marketing section. Favor quiet depth, soft daylight, and low visual noise. Apply a dark or light surface layer when needed for text contrast.

Do not use imagery behind long body copy or critical controls. Decorative images use empty alternative text. Meaningful images need concise alternative text.

Open question: select and license the final hero and value-card images.

### ASCII texture

ASCII texture is decorative atmosphere. Keep it sparse, low contrast, and outside reading order. Mark it `aria-hidden="true"`. Do not use monospace text for interface labels.

### Glass

Use limited translucency for the floating product preview and compact overlays. Pair it with an opaque fallback and a visible border. Avoid stacked translucent layers.

### Light mode

Use a soft off-white canvas, white cards, dark ink, thin slate lines, and mint accents. Preserve broad empty areas.

### Dark mode

Use a matte charcoal canvas, elevated charcoal cards, off-white text, and the same mint accent. Avoid navy surfaces, neon glow, and pure-black card stacks.

### Anti-patterns

- Generic purple AI gradients
- Excess glass or blur
- Neon-heavy styling
- Fake operating-system chrome
- Copied Google Docs or Chrome layouts
- Dense dashboards on the landing page
- Long marketing paragraphs
- Decorative controls
- Hidden actions on hover
- Color-only status

## 5. Design System

This section absorbs the former separate color and typography document, which was removed. It is the single source for frontend visual tokens.

### Color primitives

| Token | Value | Use |
| --- | --- | --- |
| `--color-aksa-electric` | `#47D2BC` | Primary action fill, active highlights |
| `--color-aksa-cyan-soft` | `#86B5C4` | Secondary accent, soft border |
| `--color-aksa-mint-soft` | `#C8F5ED` | Chip fill, selected surface |
| `--color-aksa-teal-deep` | `#25A894` | Primary gradient end, strong accent |
| `--color-aksa-blue-accent` | `#4F8CF7` | Restrained gradient endpoint only |
| `--color-aksa-charcoal` | `#1A1A1E` | Dark elevated surface |
| `--color-aksa-dark-canvas` | `#121214` | Dark page canvas |

### Semantic colors

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-aksa-paper` | `#F8FAFC` | `#121214` | Page canvas |
| `--color-aksa-cloud` | `#FFFFFF` | `#1A1A1E` | Card and container |
| `--color-aksa-ink` | `#0F172A` | `#F1F5F9` | Primary text |
| `--color-aksa-muted` | `#64748B` | `#94A3B8` | Secondary text |
| `--color-aksa-faint` | `#94A3B8` | `#64748B` | Placeholder and subtle control |
| `--color-aksa-line` | `#E2E8F0` | `#27272A` | Divider and border |
| `--color-aksa-teal` | `#47D2BC` | `#47D2BC` | Brand and primary action |
| `--color-aksa-teal-soft` | `#C8F5ED` | `rgba(71, 210, 188, 0.15)` | Selected surface |

Do not use teal or blue for body text unless contrast passes WCAG AA. Primary buttons use dark ink on mint. Status always includes text and an icon.

Open question: destructive, warning, and verified-success semantic tokens need Henix approval before those states are implemented. Until approved, use neutral surfaces, explicit text, and icons.

### Typography

| Role | Family | Weight | Size and line height |
| --- | --- | --- | --- |
| Display | Host Grotesk | 600 | `clamp(2.75rem, 7vw, 6rem)` / `0.96` |
| H1 | Host Grotesk | 600 | `clamp(2.25rem, 5vw, 4.5rem)` / `1.02` |
| H2 | Host Grotesk | 600 | `clamp(1.75rem, 3vw, 3rem)` / `1.08` |
| H3 | Host Grotesk | 600 | `1.5rem` / `1.2` |
| Body large | Inter | 400 | `1.125rem` / `1.65` |
| Body | Inter | 400 | `1rem` / `1.6` |
| Small | Inter | 400 or 500 | `0.875rem` / `1.45` |
| Label and button | Inter | 600 | `0.875rem` / `1.2` |

Use Host Grotesk for brand and headings. Use Inter for body and UI. Do not use monospace UI text. Keep paragraph measure between 45 and 70 characters.

Open question: confirm font licensing and delivery method before implementation.

### Spacing

Use a 4 px base:

| Token | Value |
| --- | --- |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |
| `--space-7` | `48px` |
| `--space-8` | `64px` |
| `--space-9` | `96px` |
| `--space-10` | `128px` |

Use 8 px or more between interactive targets. Major landing sections use `--space-9` on mobile and `--space-10` on desktop when space permits.

### Radius

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | `8px` | Chips, compact controls |
| `--radius-md` | `12px` | Inputs, buttons |
| `--radius-lg` | `20px` | Cards |
| `--radius-xl` | `28px` | Hero preview, major panels |
| `--radius-round` | `999px` | Pills, progress rings |

### Borders

Use a 1 px solid `--color-aksa-line` border. Selected controls may use `--color-aksa-teal` with an adjacent icon or label. Avoid double borders and gradient borders.

### Elevation

| Level | Treatment |
| --- | --- |
| Base | No shadow |
| Raised | `0 8px 24px rgba(15, 23, 42, 0.08)` |
| Overlay | `0 20px 60px rgba(15, 23, 42, 0.14)` |

In dark mode, rely on surface and border contrast first. Reduce shadow opacity. Do not apply glow to ordinary cards.

### Icons

Use one rounded outline icon family. Default size is 20 px, 24 px for primary actions, and 16 px inside chips. Every icon-only button needs an accessible name and at least a 44 by 44 px target.

Open question: select the production icon library.

### Focus

Use a 2 px `--color-aksa-teal` outline with a 3 px offset. Add a surface-colored separation ring when contrast requires it. Never remove focus without an equivalent visible treatment.

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | `120ms` | Press and hover |
| `--duration-base` | `200ms` | State change |
| `--duration-slow` | `320ms` | Panel entrance |
| `--ease-calm` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Standard easing |

Animate opacity and transform. Avoid parallax, cursor trails, and constant ambient motion. Under `prefers-reduced-motion: reduce`, remove nonessential animation and show dwell progress through a static changing indicator.

### Scrollbars

Use thin scrollbars. The thumb uses `--color-aksa-faint`, changes to `--color-aksa-muted` on hover, and keeps a transparent track. Do not hide scrollbars in scrollable regions.

## 6. Layout System

### Viewports

| Range | Behavior |
| --- | --- |
| 320 to 767 px | Single column, compact navigation, stacked previews |
| 768 to 1023 px | Flexible two-column sections where readable |
| 1024 to 1439 px | Full navigation, asymmetric hero, three-card grid |
| 1440 px and above | Preserve content width, grow outer whitespace |

Breakpoints serve content. Components may wrap earlier when copy or controls need room.

### Container

- Maximum content width: 1280 px
- Reading content width: 720 px
- Page gutters: 20 px mobile, 32 px tablet, 48 px desktop
- Major sections: full-width boundary with an inner container
- Section separators: 1 px `--color-aksa-line`

### Mobile behavior

- Put content before decoration.
- Stack hero copy above product preview.
- Keep primary action visible before secondary content.
- Convert three-card rows to one column.
- Use full-width dialogs with 16 px edge clearance when needed.
- Keep bottom actions above safe-area insets.
- Avoid horizontal scrolling at 320 px and 200% zoom.

### Section rhythm

Each section uses eyebrow or label, heading, one short description, then its content. Landing sections should not exceed one primary message and one primary action.

## 7. Shared Components

| Component | Required frontend behavior |
| --- | --- |
| Button | Primary, secondary, quiet, destructive-pending variants; default, hover, focus, pressed, loading, disabled states; loading keeps width stable |
| Link | Descriptive destination; underline in body copy; visible focus; external destinations disclosed |
| Input | Persistent label; optional helper text; inline error; preserved value after failure; no placeholder-only labels |
| Navigation | Current page exposed with `aria-current`; mobile menu traps focus and restores it on close |
| Status chip | Icon plus short label; no color-only meaning; never interactive unless styled as a control |
| Card | One purpose, one-sentence description, optional clear action; whole-card click only when one destination exists |
| Dialog | Named title; initial focus on meaning, not danger; Escape cancels when safe; focus returns to trigger |
| Confirmation | States action, scope, consequence, and recovery; approve, edit, cancel choices |
| Toast | Brief nonblocking update; no critical action available only inside the toast |
| Undo | Visible after reversible completion; states affected action and remaining availability without inaccessible countdown pressure |
| Command bar | Accepts voice or text; shows mode and transcript; supports submit, stop, clear, and retry |
| Agent activity | Shows action, observable state, affected items, and result; no chain-of-thought |
| Loading | Skeleton for known layout, spinner for compact action; announced after a meaningful delay |
| Empty | Explains why empty and offers one next action |
| Error | States failure, preserved progress, and recovery action; technical details stay out of default view |

Disabled controls must explain prerequisites nearby. Prefer read-only or hidden unavailable actions when disabling would confuse.

## 8. Agent States

Use one visible state at a time. Announcements go through a polite live region unless immediate action is required. Do not repeat rapidly changing status.

| State | Visible copy | User actions | Accessibility announcement |
| --- | --- | --- | --- |
| Idle | `Ready for a task.` | Type, speak, browse suggestions | None on initial load |
| Listening | `Listening.` | Stop, cancel | `Listening started.` |
| Transcribing | `Writing your words.` | Stop, edit when ready | `Transcribing.` |
| Understanding | `Preparing the task.` | Cancel | `Preparing the task.` |
| Executing | `Working on [task].` | Cancel, view scope | `Task started.` |
| Waiting for confirmation | `Review before action.` | Confirm, edit, cancel | Assertive: `Confirmation required.` |
| Completed | `Task completed.` plus verified result | View, Undo when available | `Task completed.` |
| Partially completed | `[count] completed. [count] need attention.` | Review, retry remaining | `Task partially completed.` |
| Failed | `Task could not finish.` | Retry, edit, cancel | Assertive: `Task failed. Review available actions.` |
| Cancelled | `Task cancelled.` | Edit, start again | `Task cancelled.` |
| Undo available | `Undo available.` | Undo, dismiss | `Task completed. Undo is available.` |

Use real item names and counts when known. If verification is pending, say `Checking the result.` Do not estimate progress without reliable data.

## 9. Accessibility System

Target WCAG 2.2 AA. Primary flows must not depend on fine motor control.

### Head control calibration

- Introduce face positioning, lighting, range, and privacy before camera access.
- Show a clear calibration target sequence with progress.
- Let users restart, pause, or skip to keyboard and mouse.
- Save preferences only after explicit consent.
- Announce calibration steps and completion.

### Sensitivity and dead zone

Offer plain-language sensitivity and dead-zone controls with immediate preview. Provide a reset action. Changes must not trap the user in an unusable setting.

Open question: default sensitivity, dead zone, and persistence policy require usability testing.

### Cursor smoothing

Smooth jitter without adding noticeable lag. Keep the visible cursor distinct from system focus. Pause movement while a confirmation dialog opens to prevent accidental activation.

Open question: smoothing values require device testing.

### Face control selection

Explain the supported facial gesture before activation. Provide a visible ready state, cooldown feedback, and an alternative selection method. Do not assign destructive actions directly to a gesture.

Open question: select the primary gesture after motor-accessibility testing.

### Dwell

- Dwell begins only on a stable eligible target.
- Show progress around or beside the target.
- Moving away cancels immediately.
- Pressing Escape or saying `Cancel` stops dwell.
- Allow dwell duration adjustment and a pause toggle.
- Never auto-confirm consequential actions through dwell alone.

### Voice

- Show microphone state before listening.
- Present the transcript before consequential execution.
- Let users edit, retry, stop, or switch to text.
- Preserve the transcript after recoverable failure.
- Announce permission loss and offer keyboard input.

### Keyboard and mouse

- All controls work with keyboard and mouse.
- Tab order follows reading order.
- Enter activates the default safe action. Space activates buttons.
- Escape closes temporary surfaces or cancels listening when safe.
- No keyboard trap outside an active modal.

### Screen readers

- Use semantic landmarks and one H1 per page.
- Label controls by result, not icon appearance.
- Connect errors and helper text programmatically.
- Announce agent state changes without exposing hidden reasoning.
- Keep DOM order aligned with visual and focus order.

### Reduced motion

Respect the system preference. Remove nonessential transitions, animated backgrounds, and smooth scrolling. Preserve state visibility with static indicators.

### Camera loss

Show `Face control paused.` Preserve work, stop dwell, and offer `Retry camera`, `Use keyboard`, and `Use mouse`. Do not block voice or text input.

## 10. Landing Page

The landing page explains Aksa in under one viewport, then proves control and safety through a short product story.

### 10.1 Navigation

| Element | Specification |
| --- | --- |
| Brand | Existing Aksa wordmark, links home |
| Links | Product, How it works, Safety, Accessibility |
| Utility | Language and theme controls |
| Primary action | `Try Aksa` |
| Mobile | Brand, primary action, menu button; menu opens a labeled dialog |

Navigation is visually quiet, 64 to 72 px tall, and separated by whitespace or a thin rule. Do not use a floating pill around the entire navigation.

### 10.2 Hero

Eyebrow: `Accessible AI workspace`

Headline:

> Say the task.
>
> Aksa handles the steps.

Description:

> A hands-free AI workspace for documents, files, and sheets.

Actions:

- Primary: `Try Aksa`
- Secondary: `See how it works`

Capability chips:

- `Face control ready`
- `Voice supported`
- `Review before action`

Hero visual requirements:

- Calm nature image forms the back plane.
- Subtle ASCII texture remains decorative.
- A floating Aksa preview sits above the image.
- Preview shows `Programming Assignment 04`.
- `Testing` is highlighted.
- Compact status reads `You stopped at Testing.`
- Product preview has no fake browser or operating-system frame.
- All preview copy stays readable in light and dark modes.

Desktop uses a 5:7 copy-to-visual ratio. Mobile puts copy, actions, chips, then preview in that order.

### 10.3 Value cards

Use three cards with one visual, one heading, and one sentence each:

| Card | Copy | Visual intent |
| --- | --- | --- |
| Move less | `Control Aksa with face movement, dwell, or voice.` | Calm nature texture with accessible control cue |
| Ask naturally | `Describe the result by voice or text.` | Compact command and transcript preview |
| Stay in control | `Review changes, cancel work, or use Undo.` | Confirmation and recovery preview |

Desktop uses three equal columns. Mobile stacks them. Keep visual heights consistent without cropping meaningful UI.

### 10.4 Product demonstration

Demonstrate one continuous story:

1. Open the latest school assignment.
2. Show `You stopped at Testing.`
3. Continue through voice.
4. Organize the related files.
5. Show `Move 12 files?`
6. Confirm the change.
7. Show verified completion and `Undo available.`

The demo may be interactive or a controlled sequence. It must expose captions, keyboard controls, pause, and replay. A prerecorded visual needs an equivalent text summary.

### 10.5 How it works

| Step | Heading | Description |
| --- | --- | --- |
| 1 | Look | `Point with head movement or use your keyboard.` |
| 2 | Speak | `Say the task or type it.` |
| 3 | Confirm | `Review important changes before they run.` |

Use a horizontal sequence on desktop and a vertical numbered list on mobile. The reading and tab order always remains 1, 2, 3.

### 10.6 Safety and control

Headline: `Important actions wait for you.`

Show three concrete behaviors:

- Preview scope before changes.
- Cancel while work is running.
- Undo supported actions after completion.

Use a real confirmation component. Do not use fear-based security copy or unsupported privacy claims.

### 10.7 Final CTA

- Headline: `Start with one task.`
- Description: `Use voice, text, face control, keyboard, or mouse.`
- Action: `Try Aksa`

Keep this section compact. Do not repeat feature lists.

### 10.8 Minimal footer

Include Aksa wordmark, Product, Accessibility, Privacy, Terms, language, theme, and competition attribution if approved. Do not add a newsletter or oversized link grid.

Open questions:

- Final destination for `Try Aksa`
- Approved privacy and terms pages
- Competition attribution wording
- Whether the demo is interactive, prerecorded, or both

### Landing acceptance criteria

- Core value and `Try Aksa` appear without scrolling at 1366 by 768.
- The page works from 320 px through wide desktop without horizontal overflow.
- Text remains usable at 200% zoom and 400% text-only zoom where applicable.
- Heading hierarchy and landmark structure are valid.
- Every interactive element has a visible focus state and 44 by 44 px target.
- Hero visuals do not block copy or actions.
- Decorative texture and images are hidden from assistive technology.
- Meaningful preview content has a text equivalent.
- The demo supports captions, pause, keyboard control, and reduced motion.
- Light and dark modes meet WCAG AA contrast.
- Indonesian and English layouts tolerate longer strings.
- No hidden model reasoning or fabricated results appear.
- The page uses existing Aksa logo assets unchanged.

## 11. Authentication Foundation

Do not design the complete authentication journey yet.

Known foundation:

- Centered, single-purpose form on a calm surface
- Persistent labels and visible password requirements
- Autofill and password-manager support
- Field errors linked to inputs
- Form-level error summary on failed submission
- Stable loading state that prevents accidental duplicates
- Focus moves to the error summary, then follows document order
- Enter submits when valid; Escape does not erase input
- Camera or microphone permissions are separate from account access

Open questions:

- Supported sign-in methods
- Guest or demo access
- Account recovery policy
- Consent and onboarding sequence
- Session-expiry experience

## 12. Dashboard Foundation

Do not design the complete dashboard yet.

Known shared elements:

| Element | Frontend requirement |
| --- | --- |
| App shell | Stable header, workspace navigation, main task region |
| Workspace navigation | Documents, files, and sheets with current location visible |
| Command input | Voice and text entry with transcript and stop controls |
| Task status | Current task, observable state, affected items, result |
| Agent activity | Concise action log without chain-of-thought |
| Accessibility controls | Face control, dwell, sensitivity, pause, fallbacks |
| Confirmation | Scope, consequence, edit, confirm, cancel |
| Undo feedback | Reversible result, Undo action, clear expiration behavior |

Open questions:

- Final navigation model and route map
- Workspace object hierarchy
- Multi-task behavior
- Activity-history retention
- Accessibility-control placement
- Undo duration and persistence
- Offline or degraded-mode behavior

## 13. Localization

Use Paraglide for Indonesian and English.

- No hardcoded user-facing strings in components.
- No sentence construction through string concatenation.
- Use named variables and proper plural forms.
- Test Indonesian as the longer layout case when uncertain.
- Keep buttons short without removing meaning.
- Localize dates, times, counts, and file sizes.
- Preserve accessible names and announcements in the active language.
- Do not mix languages in one status message.

Open question: choose the default locale and language-detection behavior.

## 14. Acceptance Checklist

### Visual consistency

- [ ] Existing logo assets are unchanged.
- [ ] Tokens in this document are reused.
- [ ] Nature, ASCII texture, and glass remain restrained.
- [ ] Light and dark modes preserve hierarchy.

### Responsive behavior

- [ ] No horizontal overflow at 320 px.
- [ ] Content order remains logical across breakpoints.
- [ ] Actions stay reachable with zoom and safe-area insets.
- [ ] Long Indonesian and English strings wrap cleanly.

### Accessibility

- [ ] WCAG 2.2 AA checks pass.
- [ ] Keyboard, mouse, voice or text, and face-control fallbacks work.
- [ ] Focus is visible, ordered, trapped only in modals, and restored.
- [ ] Screen-reader names and state announcements are concise.
- [ ] Reduced motion and camera-loss fallbacks work.

### Complete states

- [ ] Loading, empty, error, partial, cancelled, confirmation, completed, and Undo states exist where relevant.
- [ ] Consequential actions require review.
- [ ] Success appears only after verification.
- [ ] No fabricated agent result or hidden reasoning appears.

### Product alignment

- [ ] Copy is concise, direct, and free of vague AI jargon.
- [ ] Components are reused before new variants are added.
- [ ] The implementation matches `.agents/prd.md` and relevant feature documents.
- [ ] Frontend requirements do not prescribe backend implementation.
- [ ] Henix and Zaltech handoffs preserve the ownership boundary.
