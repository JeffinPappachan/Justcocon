# Staging deployment

## Purpose

This document describes the staging-only deployment posture for the JustCocon foundation.

## Guardrails

- No production database writes
- No production WhatsApp number use
- No production credentials in repository
- No automatic migration execution
- No live customer data exposure

## Recommended setup

- Create a separate Supabase staging project for future schema work.
- Keep WhatsApp integration in a staging environment only.
- Use demo environment variables and safe examples.

## Current status

This repository is a local foundation and should not be treated as production deployment-ready.
