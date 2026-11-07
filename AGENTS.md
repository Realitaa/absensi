# AGENTS.md

## 1. Project Overview

This project is a web-based university attendance system with GPS
geofencing and selfie evidence.

Before implementing or changing application behavior, read and follow:

-   `SRS.md` --- authoritative product scope, functional and
    non-functional requirements, business rules, validation behavior,
    and acceptance criteria.
-   `ERD.md` --- logical data model, entities, relationships, and
    data-integrity rules.

Treat these documents as project requirements. Do not silently change or
contradict them. If implementation requires changing a documented
requirement or making an unresolved decision that affects security, data
integrity, or user-visible behavior, explain the issue and ask for
approval.

Do not introduce features outside the documented scope unless explicitly
requested.

## 2. Technology Stack

The project uses:

-   **Framework:** Nuxt.
-   **UI library:** Nuxt UI.
-   **Server runtime and hosting:** Cloudflare Workers.
-   **Database:** Cloudflare D1.
-   **Database ORM/query layer:** Drizzle ORM.
-   **Composable utilities:** VueUse when an appropriate composable is
    available.

Do not replace these technologies or introduce competing frameworks,
libraries, or ORMs without approval.

## 3. Documentation and MCP Usage

Current framework documentation should be consulted when implementation
details are uncertain.

Available documentation MCP sources:

1.  **Nuxt MCP** --- current Nuxt APIs, conventions, configuration, and
    recommended patterns.
2.  **Nuxt UI MCP** --- current Nuxt UI components, props, slots,
    composables, and usage examples.

Use these sources when an API or component's behavior is uncertain, when
implementing framework-specific functionality, when resolving
version-related issues, or when local code does not provide enough
information.

Prefer current official documentation obtained through the relevant MCP
over assumptions based on memory or outdated examples. Do not invent
APIs, component props, or configuration options.

MCP documentation provides technical information; it does not override
this project's SRS, ERD, or explicit architectural decisions.

## 4. Agent Skills

Project-specific and reusable agent skills may be available in:

``` text
.agents/skills/
```

Before implementing a task, inspect the available skills and read any
skill relevant to that task. Follow applicable skill instructions.

In particular, check for the **VueUse** skill before implementing common
Vue composable behavior. Use it to discover available VueUse
composables. Prefer an existing suitable composable over writing a
custom implementation of the same behavior.

Do not assume a skill exists just because it is mentioned here. Inspect
`.agents/skills/` and use skills that are actually available. Do not add
a dependency if the required functionality is already available in the
project.

## 5. Language and Localization

### 5.1 User Interface Language

All user-facing interface text must be written in **Indonesian**,
including navigation, page titles, descriptions, form labels,
placeholders, buttons, validation messages, empty states, loading and
success messages, dialogs, notifications, table headings, status labels,
and user-facing errors.

Use clear, natural, and consistent Indonesian. Do not expose raw
technical exceptions or internal server messages to users.

### 5.2 Server and API Language

Server-side code, API response messages, exception messages, and
internal technical messages must use **English**.

Use stable machine-readable error codes where appropriate. Do not
localize server exceptions or API messages into Indonesian. The frontend
is responsible for translating server errors into Indonesian.

### 5.3 Frontend Error Mapping

Implement and maintain a centralized frontend error-mapping approach.

The frontend must:

1.  Read a stable error code or other agreed error identifier from the
    server response.
2.  Map known errors to Indonesian user-facing messages.
3.  Display a safe, understandable Indonesian fallback when an error is
    unknown.
4.  Never display raw stack traces, SQL errors, or internal server
    details to users.

Do not scatter translation logic throughout individual pages and
components. Reuse the project's centralized mapping mechanism.

When adding a server error that can reach the user, add or update its
corresponding frontend mapping. Keep API response structures consistent.
Prefer stable error codes over using exact English message text as the
translation key.

## 6. Nuxt Application Structure

Follow the official Nuxt directory structure and conventions documented
by the Nuxt MCP. Do not invent a parallel application structure or move
Nuxt-managed directories into custom locations without a clear
requirement.

Use Nuxt conventions for directories such as `app/`, `server/`,
`shared/`, `public/`, and `assets/`, as appropriate to the project's
Nuxt version and configuration. The exact structure must follow current
Nuxt documentation and the needs of the application.

### 6.1 Auto-Imports

Make effective use of Nuxt auto-imports:

-   Use auto-imports for supported Vue APIs, Nuxt composables,
    application composables, utilities, and components where
    appropriate.
-   Avoid unnecessary manual imports for symbols Nuxt already
    auto-imports.
-   Do not assume every dependency or symbol is auto-imported. Check the
    configuration and documentation when uncertain.
-   Keep explicit imports when required by a library or tooling, or when
    they materially improve clarity.

Do not create custom wrappers around built-in Nuxt functionality unless
they provide meaningful project-specific behavior.

### 6.2 Components and UI

Use **Nuxt UI** as the primary component library.

-   Prefer existing Nuxt UI components over building equivalent
    components from scratch.
-   Consult the Nuxt UI MCP for current component APIs and usage.
-   Follow existing project design and component conventions.
-   Keep components focused and reusable where reuse is meaningful.
-   Do not introduce another UI component library without approval.

## 7. Server Architecture

The server must use a simple layered architecture:

``` text
API → Service → Repository
```

### 7.1 API Layer

Responsible for defining endpoints, reading and validating request
input, invoking established authentication and authorization mechanisms,
calling services, and translating service outcomes into consistent HTTP
responses.

Keep business rules out of endpoint handlers.

### 7.2 Service Layer

Responsible for implementing application use cases, enforcing business
rules from `SRS.md`, coordinating repository operations, applying
relevant authorization constraints, managing transaction boundaries, and
producing predictable results and errors for the API layer.

Services should not depend on HTTP request or response objects unless a
specific framework constraint makes it unavoidable.

### 7.3 Repository Layer

Responsible for database queries and persistence. Encapsulate Drizzle
ORM operations and Cloudflare D1 access in this layer.

Use **Drizzle ORM** for database access to Cloudflare D1. Do not put
business rules in repositories or bypass the repository layer with
direct database queries from API handlers or UI code.

### 7.4 Architectural Simplicity

Keep the architecture proportional to the project.

-   Do not add a separate domain layer, dependency-injection framework,
    event bus, or other abstraction without a concrete need and
    approval.
-   Avoid interfaces or wrapper classes that add no meaningful
    separation or testability.
-   Follow established naming and file organization conventions.
-   Keep dependencies flowing from API to Service to Repository.

## 8. Cloudflare Workers and D1

The server will be hosted on **Cloudflare Workers** and use **Cloudflare
D1** as its relational database.

-   Ensure server code and dependencies are compatible with the
    Cloudflare Workers runtime.
-   Do not assume Node.js-only APIs or unrestricted Node.js runtime
    access.
-   Prefer APIs and dependencies supported by Workers.
-   Consult current Nuxt/Nitro and Cloudflare documentation through
    available documentation tools when compatibility is uncertain.
-   Use Drizzle ORM for D1 queries and schema integration.
-   Follow existing Drizzle schema, migration, and configuration
    conventions.
-   Do not introduce another ORM or database access library without
    approval.
-   Do not hardcode secrets, credentials, or environment-specific
    values.

Use environment configuration for deployment-specific settings. The
application timezone must be configured through `APP_TIMEZONE`, as
specified in the project requirements.

## 9. Database and Business Rules

Use `ERD.md` as the logical database design reference and `SRS.md` as
the source of business rules.

-   Keep Drizzle schema definitions consistent with `ERD.md`.
-   Preserve relationships and data-integrity constraints defined in
    `ERD.md`.
-   Enforce important constraints at the database level when
    appropriate, not only through frontend validation.
-   Preserve historical records according to soft-delete and retention
    rules.
-   Do not introduce cascading deletion that contradicts the SRS or ERD.
-   Do not change attendance, GPS validation, session-time, selfie, or
    correction rules without approval.

If the SRS and ERD conflict or omit a necessary decision, do not make an
irreversible design choice silently. Explain the issue and request
clarification.

## 10. Testing Requirements

### 10.1 Feature Tests

Write feature tests for implemented server/application features in:

``` text
test/nuxt/
```

Feature tests are expected as part of normal feature implementation.
Cover relevant success cases, validation failures, authorization
failures, and important business-rule boundaries.

Use the testing framework and conventions already configured. Do not
introduce a new testing framework without approval.

### 10.2 Unit Tests

Unit tests belong in:

``` text
test/unit/
```

Write unit tests only when explicitly requested by the user.

### 10.3 Browser Tests

Browser tests belong in:

``` text
tests/
```

Write browser/end-to-end tests only when explicitly requested by the
user.

  Test type       Location       When to write
  --------------- -------------- -----------------------------------
  Feature tests   `test/nuxt/`   As part of feature implementation
  Unit tests      `test/unit/`   Only when requested
  Browser tests   `tests/`       Only when requested

Do not silently move tests between these directories. Follow the
project's existing test configuration.

## 11. Code Quality: Linting and Formatting

After completing implementation work:

1.  Inspect `package.json` and project configuration to identify
    available lint and formatting scripts.
2.  Run the applicable linting command.
3.  Run the applicable formatting command.
4.  Resolve issues introduced by the changes.
5.  Run relevant feature tests.
6.  Report commands that could not be run and explain why.

Do not invent script names or assume a particular formatter or linter is
installed. Do not claim linting, formatting, or tests passed unless the
commands were actually executed successfully.

Avoid unrelated formatting changes unless required by the project's
formatter.

## 12. Implementation Workflow

For each task:

1.  **Understand the request.** Identify the affected feature and
    expected behavior.
2.  **Read requirements.** Consult relevant sections of `SRS.md` and
    `ERD.md`.
3.  **Inspect existing code.** Reuse established patterns and avoid
    duplicating functionality.
4.  **Inspect relevant skills.** Check `.agents/skills/` and read
    applicable instructions.
5.  **Consult documentation when needed.** Use Nuxt and Nuxt UI MCP
    sources for current guidance.
6.  **Plan the change.** Identify affected pages, components, endpoints,
    services, repositories, database schema, and tests.
7.  **Implement by layer.** Keep server responsibilities separated
    according to API → Service → Repository.
8.  **Add feature tests.** Put them in `test/nuxt/`.
9.  **Run quality checks.** Execute configured lint and formatting
    commands, then relevant feature tests.
10. **Summarize the result.** Report changes, important decisions,
    checks performed, and remaining issues.

## 13. General Engineering Guidelines

-   Prefer simple, readable, maintainable solutions.
-   Reuse existing utilities, composables, components, and patterns
    where appropriate.
-   Avoid unnecessary dependencies, speculative abstractions, and
    premature optimization.
-   Keep frontend presentation separate from server business logic.
-   Keep server responses in English and user-facing interface text in
    Indonesian.
-   Validate input on the server even when the frontend already
    validates it.
-   Enforce authorization on the server for every protected operation.
-   Never expose secrets, stack traces, or sensitive internal details in
    client-facing responses.
-   Do not silently weaken security, data integrity, or audit
    requirements for implementation convenience.
-   Do not modify unrelated files or requirements as part of a task.

When a requirement is ambiguous and the choice could affect data
integrity, security, user-visible behavior, or architecture, ask the
user before deciding.

## 14. Completion Report

When a task is complete, provide a concise report containing:

-   What was implemented.
-   Main files or areas changed.
-   Feature tests added or updated.
-   Linting and formatting results.
-   Checks that could not be run.
-   Unresolved questions or limitations.

Be accurate about what was and was not verified.
