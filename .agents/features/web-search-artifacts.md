# Web Search and Artifacts

Grounded web search and the readable, source-backed results it produces. Supports steps 11 to 14 of the primary flow in `.agents/prd.md` section 8.

## Purpose

Answer a current question with real sources, then present it as something short enough to read comfortably, with every claim traceable to a listed source.

## User Stories

- As a user, I ask about something recent and get an answer based on current sources, not model memory.
- As a user, I see which sources the answer came from and when they were retrieved.
- As a user, I read a short summary instead of opening six tabs.
- As a user, I am told when sources disagree instead of being handed one confident answer.
- As a user, I am told when nothing reliable was found rather than receiving an invented answer.
- As a user, my past answers stay available in History.
- As a user, content from a webpage cannot make Aksa do something I did not ask for.

## Scope

- Grounded search through a provider abstraction, with Vertex AI grounding with Google Search as the primary implementation.
- Source cards with title, domain, and retrieval time.
- Concise artifacts with a summary, two to five key points, and a source list.
- Inline citation from every factual claim to a listed source.
- Conflicting-source presentation.
- No-usable-source state that produces no artifact.
- Freshness disclosure through retrieval time.
- Prompt-injection defenses for retrieved content.
- Safe rendering of artifact bodies and source metadata.
- Artifact storage, retrieval from History, and deletion.
- Grounded-search disclosure to the user.

## Non-Goals

- Browsing arbitrary pages on the user's behalf, signing in to sites, or filling external forms.
- Aksa-operated crawling. Retrieval happens through the grounding provider.
- Following links found inside retrieved content.
- Real-time monitoring, alerts, or scheduled re-checks.
- Full-page archival of sources.
- Image, video, or PDF extraction from sources.
- Ranking or scoring source credibility beyond surfacing the domain and retrieval time.
- Artifact export. Deferred per `.agents/prd.md` section 7.
- Editing an artifact in place. A revision is a new artifact from a new task.

## User Flow

| Step | User | Aksa |
| --- | --- | --- |
| 1 | Opens the Web Search view | Shows the idle state with voice and text entry, and the grounded-search disclosure |
| 2 | Asks a question by voice or text | Creates the task and confirms the understood request in the interface |
| 3 | Waits | Runs `search.grounded_query` through the search subagent, showing the current step |
| 4 | Sees sources arrive | Renders source cards with title, domain, and retrieval time |
| 5 | Reads the answer | Renders the artifact: summary, key points with citations, then the source list |
| 6 | Notices a disagreement | The artifact states the disagreement and cites both sides |
| 7 | Later | Opens History and reads the same artifact with its sources intact |

No confirmation is required. Search and artifact creation are not consequential actions: they read external data and write only Aksa-owned data.

## UI States

| Surface | States |
| --- | --- |
| Search entry | idle with disclosure, voice listening, transcribing, transcript editable, text entry, submitting, unsupported speech recognition |
| Search progress | understanding, retrieving sources, composing the answer, cancelling |
| Source cards | none yet, partial list arriving, complete list, source unavailable |
| Artifact | composing, ready, truncated notice, failed to compose |
| No usable source | explicit no-result state with no artifact |
| Conflicting sources | artifact showing the disagreement with both citations |
| Failure | provider timeout, rate limited, budget blocked, provider unavailable |
| Cancelled | task cancelled, partial sources discarded, nothing stored |
| History entry | artifact readable, sources listed, delete available |

The artifact never appears before its sources are known. A partial artifact is never presented as complete.

## Frontend Responsibilities

Owner: Henix.

- Web Search view layout and the grounded-search disclosure copy.
- Search entry supporting voice with an editable transcript and text as an always-available equivalent.
- Progress presentation using the single task state received from the server.
- Source card component showing title, domain, and localized retrieval time.
- Artifact presentation: summary, key points, inline citation markers linked to the source list.
- Safe rendering of the artifact body within the restricted format the server declares. No raw HTML.
- External link presentation that discloses the destination.
- Conflicting-source presentation that gives both sides equal visual weight.
- No-result, failure, and cancelled states.
- Reading measure between 45 and 70 characters, per `.agents/design.md` section 5.
- Localized copy and localized date and time formatting.
- Frontend tests: artifact rendering, citation linking, source card states, no-result state, keyboard navigation of citations and links, long titles, Indonesian and English layout.

The frontend never calls a search provider and never composes an artifact.

## Backend Responsibilities

Owner: Zaltech.

- Search provider abstraction with Vertex AI grounding as the primary implementation and room for a second provider.
- `search.grounded_query` tool with typed argument and result schemas.
- Extraction of source metadata: title, URL, domain, retrieval time, and a bounded snippet.
- Normalization and stripping of retrieved content before it enters a prompt: markup removed, zero-width and hidden characters normalized, length capped.
- Untrusted-data delimiting so retrieved content cannot act as an instruction.
- Artifact composition with a Zod-validated structure that requires at least one source.
- Claim-to-source mapping validation. An artifact whose claims do not map to listed sources is rejected, not published.
- Artifact and source persistence inside one transaction.
- Provider usage recording for the search and composition calls.
- Timeout, retry with exponential backoff and jitter, `Retry-After` handling, circuit breaker, and budget checks.
- Stable error categories for timeout, rate limit, budget block, and no usable source.
- Compliance with the grounding provider's display requirements, including Google Search Suggestions where Vertex AI grounding with Google Search is used.
- Backend tests: schema validation, source-required constraint, injection handling, no-result path, timeout, rate limit, budget block, ownership.

## Agent Tools

| Tool | Kind | Confirmation | Undo | Notes |
| --- | --- | --- | --- | --- |
| `search.grounded_query` | search | No | n/a | Reads external sources. Arguments: query text and result count bound. Returns validated source list and grounded text |
| `artifact.create` | write | No | No | Writes Aksa-owned data only. Cannot touch Google data. Rejected without at least one source when `kind` is `search_summary` |

Rules:

1. `search.grounded_query` is available to the orchestrator and to the search subagent, which has no other write capability beyond `artifact.create`.
2. The tool never follows a URL found inside a retrieved snippet, and never issues a second query derived from retrieved instructions.
3. The result count is bounded by configuration, not by model choice.
4. `artifact.create` cannot be called with a claim set that does not map to sources supplied by the same task.
5. Neither tool can escalate to a Google tool.

## Data Requirements

Tables from `.agents/db_schema.md`: `artifacts`, `artifact_sources`, `tasks`, `tool_calls`, `activity_events`, `provider_usage`.

| Need | Detail |
| --- | --- |
| Artifact | `artifacts` with `kind = 'search_summary'`, `title`, `body`, `body_format`, `language`, `provider`, `retrieved_at` |
| Sources | `artifact_sources` rows with `position`, `source_type = 'web'`, `title`, `url`, `domain`, bounded `snippet`, `retrieved_at` |
| Ownership | `user_id` and `workspace_id` denormalized on both tables |
| Evidence | `tool_calls` for the search and artifact creation |
| Cost | `provider_usage` for the grounding and composition calls |

Constraints:

- An artifact of kind `search_summary` requires at least one `artifact_sources` row. Enforced in application code inside the creation transaction.
- `body_format` is `markdown_safe` or `plain`. `markdown_safe` means a restricted subset rendered without raw HTML.
- `snippet` length is capped. Full page content is never stored.
- Artifacts are never updated in place. A revision is a new artifact from a new task.

Not stored: full page bodies, prompt text, model reasoning, provider raw responses, or any content beyond the bounded snippet.

## Security and Permissions

Requirements from `.agents/security.md` sections 5 and 8.

| Control | Requirement |
| --- | --- |
| Untrusted content | Every retrieved snippet is data, never an instruction. ASI01, LLM01 |
| No link following | A URL inside retrieved content is never fetched, and never becomes a tool argument |
| No derived queries | An instruction inside a snippet never triggers a second search |
| Normalization | Markup stripped, hidden and zero-width characters normalized, length capped before the content enters a prompt |
| Safe rendering | Artifact bodies and source metadata render as text and safe structure only. No script, no iframe, no raw HTML. LLM05 |
| Link disclosure | External link destinations are visible before activation |
| No fabrication | No source means no artifact. A citation is never invented. LLM09 |
| Claim mapping | Every claim maps to a listed source, validated before persistence |
| Grounding disclosure | The user is told the answer used external web search |
| Query privacy | The query leaves Aksa to the grounding provider. Warn the user not to include private details in a search request |
| Provider retention | The provider's stated retention behavior is recorded as a vendor statement, not an Aksa guarantee |
| Provider display terms | Google Search Suggestions are displayed where Vertex AI grounding with Google Search is used |
| Publisher opt-out | Vertex AI grounding excludes pages disallowing Google-Extended. Aksa performs no separate crawling |
| Ownership | Artifacts and sources are readable only by their owner, authorized from the session |
| Enumeration | A guessed or foreign artifact identifier returns not found. SEC-T2 |

## Errors and Recovery

| Failure | Behavior | User options |
| --- | --- | --- |
| No usable source found | Explicit no-result state, no artifact created, task reports the honest outcome | Rephrase, narrow the topic, cancel |
| Sources conflict | Artifact states the disagreement and cites both sides rather than choosing silently | Read both sources, refine the question |
| Source metadata incomplete | Card shows what is known and marks the rest unavailable, artifact still cites it | None needed |
| Provider timeout | Task ends, nothing partial is stored, honest timeout category | Retry, cancel |
| Provider rate limit | Retries with exponential backoff and jitter, honors `Retry-After`, then reports the delay honestly | Wait and retry, cancel |
| Provider unavailable or circuit open | Honest unavailable state. Note that a text-only fallback provider cannot perform grounded search, so Aksa reports unavailability rather than answering from model memory | Retry later, cancel |
| Budget or daily ceiling reached | Blocks before the provider call and states the limit | Wait for reset, reduce scope |
| Composition fails schema validation | No artifact created, task reports failure | Retry, rephrase |
| Claim-to-source mapping fails | Artifact rejected, task reports failure rather than publishing an uncited claim | Retry, rephrase |
| Content exceeds the length cap | Truncated with a visible truncation notice before it enters a prompt | None needed |
| Retrieved content contains an instruction | Ignored as data, no additional tool call, no artifact change | None needed |
| Cancelled during retrieval | Nothing stored, task state `cancelled` | Start again |
| Artifact load failed from History | Stable failure category, sources still listed if available | Retry |
| Speech recognition unavailable | Search entry starts in text mode with no microphone control | Type |

The critical rule: when grounding fails, Aksa says so. It never falls back to an unsourced model answer presented as research.

## Accessibility

- The artifact uses a valid heading structure and a reading measure between 45 and 70 characters.
- Citation markers are keyboard reachable, have accessible names identifying the source, and link to the source list entry.
- The source list is a real list, navigable by keyboard with visible focus.
- External links disclose their destination and are distinguishable without relying on color.
- Retrieval time is rendered as localized text, not only as a relative phrase.
- Progress announces once through a polite live region rather than repeating per source.
- The no-result state is announced and states a next action.
- Failure states announce assertively.
- Long source titles and domains wrap without clipping and without horizontal scrolling at 320 px.
- All targets are at least 44 by 44 px with at least 8 px separation.
- Copy and formatting are localized, and a status message never mixes languages.

## Acceptance Criteria

1. A search request retrieves current external sources through the grounding provider rather than model memory.
2. Source cards show title, domain, and localized retrieval time.
3. Every factual claim in an artifact maps to at least one listed source.
4. An artifact of kind `search_summary` cannot be created without at least one source.
5. A query with no usable source produces the no-result state and no artifact.
6. Conflicting sources are presented as a disagreement with both citations.
7. The artifact is short, structured as summary then key points then sources, and readable without scrolling fatigue.
8. The artifact and its sources persist and are retrievable from History with the same content.
9. Retrieved content containing an instruction produces no additional tool call and no artifact change.
10. Retrieved markup renders as inert text in the artifact and in source cards.
11. External link destinations are visible before activation.
12. The grounded-search disclosure is shown before the first search.
13. Google Search Suggestions are displayed where Vertex AI grounding with Google Search is used.
14. When grounding is unavailable, Aksa reports unavailability instead of answering from model memory.
15. A guessed or foreign artifact identifier returns not found.
16. Deleting a task deletes its artifacts and sources.
17. The same search works from voice and from typed text.
18. Every state renders in Indonesian and English.
19. Automated accessibility checks report zero critical violations on the search and artifact views.

## Test Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| WS-1 | Ask `Search the latest AI coding tool news and summarize it` | Sources retrieved, cited artifact created |
| WS-2 | Ask the same question in Indonesian | Same behavior, Indonesian artifact and localized dates |
| WS-3 | Ask about a topic with no reliable current source | No-result state, zero artifacts created |
| WS-4 | Ask a question where two sources disagree | Artifact states the disagreement with both citations |
| WS-5 | Force a grounding result whose snippet contains an instruction to move Drive files | No Drive tool call, no confirmation created |
| WS-6 | Force a snippet containing a URL and an instruction to fetch it | No fetch, no second query |
| WS-7 | Force a snippet containing script markup and hidden zero-width characters | Rendered inert, characters normalized before prompting |
| WS-8 | Force a composition output whose claims cite no listed source | Artifact rejected, task reports failure |
| WS-9 | Force a composition output that fails schema validation | No artifact, honest failure |
| WS-10 | Force a provider timeout mid-retrieval | Honest timeout category, nothing stored |
| WS-11 | Force a `429` with `Retry-After` | Honors the header, backs off with jitter, honest delay state |
| WS-12 | Open the circuit breaker for the grounding provider | Unavailable state, no unsourced answer produced |
| WS-13 | Exceed the daily cost ceiling | Blocked before the provider call, limit stated |
| WS-14 | Cancel during retrieval | Nothing stored, state `cancelled` |
| WS-15 | Reopen the artifact from History a day later | Same body, same sources, same retrieval times |
| WS-16 | Request another account's artifact identifier | Not found, SEC-T2 |
| WS-17 | Enumerate random artifact identifiers | Not found for every foreign identifier, SEC-T2 |
| WS-18 | Delete the task, then request the artifact | Not found, SEC-T8 |
| WS-19 | Submit a source list with a 400-character title and a long domain | Wraps cleanly at 320 px, no overflow |
| WS-20 | Navigate every citation and source link by keyboard | All reachable, names identify the source |
| WS-21 | Inspect stored rows after a search | No full page body, no prompt text, no reasoning trace |

## Demo Scenario

Minutes 5 to 6.5 of the pitch in `.agents/prd.md` section 23. This is the centre of the demo.

1. Open the Web Search view. Point out the grounded-search disclosure.
2. Say `Search the latest AI coding tool news and summarize it`.
3. Show the task moving through retrieval with the current step visible.
4. Show source cards arriving with titles, domains, and retrieval times.
5. Show the artifact: short summary, key points with citation markers, then the source list.
6. Activate one citation to jump to its source entry, demonstrating traceability.
7. State plainly that the answer came from those sources at that retrieval time, and that no claim exists without a source.
8. Open History briefly to show the same artifact stored with its sources.

If grounding fails live, show the honest unavailable state and say that Aksa refuses to answer research questions from model memory. That is a feature, not a failure to hide.

## Open Questions

| ID | Question | Blocks |
| --- | --- | --- |
| WSQ-1 | Which model performs grounded retrieval, and is it the same as the orchestrator? Tracked as AGQ-4. | Backend responsibilities |
| WSQ-2 | Result count bound per query, balancing artifact readability against coverage. | Agent tools |
| WSQ-3 | Snippet length cap and total retrieved content cap before truncation. | Errors and recovery |
| WSQ-4 | Exact placement and wording of the Google Search Suggestions display required by the grounding provider terms, pending Henix copy approval. | Acceptance criterion 13 |
| WSQ-5 | Whether a second search provider is added, given that the documented text-only fallback cannot ground. Tracked as AGQ-5. | Non-goals |
| WSQ-6 | How conflicting sources are structured in the artifact body: a dedicated section or inline per claim. | Acceptance criterion 6 |
| WSQ-7 | Artifact retention period. Tracked as SQ-3 and OQ-10. | Data requirements |
| WSQ-8 | Whether artifact export enters MVP if Drive write is already stable. Tracked in `.agents/prd.md` section 7. | Non-goals |
| WSQ-9 | Exact wording of the warning not to include private details in a search query, pending Henix copy approval. | Security and permissions |
