#!/usr/bin/env node
/**
 * CyberPulse Auditor — Entry Point
 *
 * Unified launcher with three operating modes:
 *
 *   cyberpulse             → Interactive ASCII menu (CLI wizard / GUI launch / direct audit)
 *   cyberpulse gui         → Launch GUI dashboard directly
 *   cyberpulse audit ...   → Direct CLI audit with flags
 *   cyberpulse retest ... → Re-test a finding
 *   cyberpulse report ...  → Generate a report for a run
 *
 * The core engine (src/core/) is shared — both CLI and GUI consume
 * the exact same logic with 100% functional parity.
 */
export {};
