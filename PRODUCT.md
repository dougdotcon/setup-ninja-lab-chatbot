# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Node 24, React, Vite, Express, and the built-in SQLite driver so the demo can run alongside existing Douvras services without a separate database server.

## Users

PC builders and online shoppers who need help choosing PCs, components, and gaming peripherals; operators who need to inspect a representative catalog, AI setup, and grounded retrieval.

## Product Purpose

A Portuguese-language demonstration of the Setup Ninja storefront with NinjaRUDEUS product guidance, a local SQLite catalog, and an operator view of the language model and retrieved evidence.

## Positioning

Answers stay grounded in the catalog and hardware support context; citations expose which listing or product information informed each answer.

## Operating Context

Shoppers browse and compare gaming PCs, components, monitors, and peripherals. Operators inspect tables, configure an optional OpenAI-compatible model for the current browser session, and review retrieval and answer telemetry.

## Capabilities and Constraints

The marketplace and assistant are demonstration-only. The active SQLite catalog comes from the official Monte seu PC JSON API, is refreshed at startup, and retains a versioned fallback snapshot. Prices and stock reflect the last successful sync, not a live checkout guarantee. Retrieval uses SQLite FTS5 with accent-insensitive keyword ranking. Without an API key the assistant returns a clearly labeled deterministic answer grounded in local catalog data. API keys stay in server memory for one expiring browser session; they are never written to the database, browser storage, or logs. A session-scoped operator trail shows retrieved evidence, validated builds, provider choices and the final response.

## Brand Commitments

Preserve the Setup Ninja name, Portuguese marketplace labels, original commerce hierarchy, search, departments, Pix pricing, and installment presentation. NinjaRUDEUS should stay in character and answer only questions about store technology, hardware, products, or practical setup instructions.

## Evidence on Hand

The visual reference is the public storefront at https://www.setupninja.com.br/. The active product source is the official API at https://monte-seu-pc.setupninja.com.br/produtos. The bundled capture has 1,236 unique IDs, including 749 available products and 487 unavailable products; see `docs/CATALOG.md` for normalization and source limits. Earlier indexed storefront samples remain as historical design research and are not used by the active builder.

## Product Principles

- Never invent store prices, compatibility, availability, or benchmark claims.
- Keep browsing, grounded answers, and the operator inspection available from one page.
- Answer from retrieved shop or hardware knowledge and link to the sources.
- Do not persist model credentials or expose one visitor's runs to another.

## Accessibility & Inclusion

Web interface in Brazilian Portuguese with keyboard-operable controls, visible focus styles, and mobile-friendly layouts.
