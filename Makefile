# Virtuals model-routing lifecycle. Run `make help` for the target list.
#
# These targets run in your shell, so `ccr restart` and the Codex proxy inherit
# VIRTUALS_API_KEY from the same environment. Model selection uses the helper
# defaults; for custom models, call the scripts directly (see
# scripts/configure-claude-virtuals.mjs --help and
# scripts/configure-codex-virtuals.mjs --help).

SHELL := /bin/sh
.DEFAULT_GOAL := help
.PHONY: help claude-on claude-off claude-check codex-on codex-off codex-proxy

help: # List available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*#' Makefile | while read -r l; do printf "\033[1;32m$$(echo $$l | cut -f 1 -d':')\033[00m:$$(echo $$l | cut -f 2- -d'#')\n"; done

claude-on: # Activate Virtuals routing for Claude Code, validate it, then restart ccr
	scripts/configure-claude-virtuals.mjs virtuals
	scripts/configure-claude-virtuals.mjs check
	ccr restart
	@echo "Claude Code Router is routing through Virtuals. Start Claude with: ccr code"

claude-off: # Restore the previous Claude Code Router config, then restart ccr
	scripts/configure-claude-virtuals.mjs restore
	ccr restart
	@echo "Claude Code Router config restored."

claude-check: # Validate the active Claude Code Router Virtuals config
	scripts/configure-claude-virtuals.mjs check

codex-on: # Start the proxy (background) and activate Virtuals routing for Codex
	scripts/codex-proxy.sh start
	scripts/configure-codex-virtuals.mjs virtuals
	@echo "Codex is routing through the Virtuals proxy. Start a fresh Codex thread with: codex"

codex-off: # Restore the previous Codex config and stop the proxy make started
	scripts/configure-codex-virtuals.mjs restore
	scripts/codex-proxy.sh stop
	@echo "Codex config restored."

codex-proxy: # Run the Codex proxy in the foreground (watch logs; Ctrl-C to stop)
	cd utilities/model-routing/codex-virtuals-proxy && npm start
