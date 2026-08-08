# Initial Setup

A new guild is `unconfigured`. Normal module commands and components fail closed with guidance until an administrator completes `/setup`.

The Discord-native wizard chooses modules, selects their features, renders required fields from manifests, collects channels and roles, and shows a review screen. Finish remains disabled while required configuration is missing. Before completion, configured channels are fetched again and checked for View Channel, Send Messages, and Embed Links.

Only the guild owner, Administrator, or Manage Server can operate setup. The durable state moves from `unconfigured` to `configuring` and finally `configured`; the completion actor, version, and timestamp are persisted. `/setup`, `/help`, and `/status` remain available before completion. `/config` redirects unconfigured guilds back to setup.

Existing guilds migrated from legacy moderation configuration remain `unconfigured` because old data cannot prove setup completion or current channel permissions. Their values are preserved and prefilled for review.
