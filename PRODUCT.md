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

The marketplace and assistant are demonstration-only. Product rows were sampled from publicly indexed Setup Ninja storefront and product pages; prices and inventory are only the values visible during collection and are not live stock guarantees. Retrieval uses SQLite FTS5 with accent-insensitive keyword ranking. Without an API key the assistant returns a clearly labeled deterministic answer grounded in local catalog data. API keys stay in server memory for one expiring browser session; they are never written to the database, browser storage, or logs.

## Brand Commitments

Preserve the Setup Ninja name, Portuguese marketplace labels, original commerce hierarchy, search, departments, Pix pricing, and installment presentation. NinjaRUDEUS should stay in character and answer only questions about store technology, hardware, products, or practical setup instructions.

## Evidence on Hand

Publicly indexed live storefront at https://www.setupninja.com.br/, including `/`, `/computadores`, `/perifericos`, `/hardware`, and product pages. The homepage and product pages expose genuine product copy, Pix prices, installment prices, department names, and Dooca CDN assets. Direct requests to the storefront origin returned HTTP 403, so the scrape uses accessible indexed pages; extraction gaps are documented in `data/scrape-report.json`.

## Product Principles

- Never invent store prices, compatibility, availability, or benchmark claims.
- Keep browsing, grounded answers, and the operator inspection available from one page.
- Answer from retrieved shop or hardware knowledge and link to the sources.
- Do not persist model credentials or expose one visitor's runs to another.

## Accessibility & Inclusion

Web interface in Brazilian Portuguese with keyboard-operable controls, visible focus styles, and mobile-friendly layouts.
