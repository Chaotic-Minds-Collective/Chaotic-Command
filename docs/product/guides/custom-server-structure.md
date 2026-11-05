---
title: "Build a custom server structure"
description: "Define or import Discord roles, categories, and text channels with the custom editor, and understand its validation limits before previewing."
---
Use the Custom structure editor when the built-in Community, Gaming, and Support templates do not match the layout you want. Enter names manually or import a suggested structure from an external AI assistant. Either way, review the proposed changes through the same preview and confirmation workflow.

## Save a structure for reuse

You can save a validated custom layout to your personal account, then load it into the editor in a later session. You can save up to 20 personal structures, rename them, or delete them. Each template is private to the Discord account that saved it. Loading a template replaces the current editor fields only; it does not create a preview or change a Discord server. See [save and reuse personal server structures](saved-server-structures.md) for the full workflow.

## Enter roles

In the Roles field, enter at least one role name, with one role on each line.

```text
Member
Moderator
Event host
```

Role names are trimmed and must contain 1 to 100 characters. Do not enter `@everyone`; Discord manages that role.

## Enter categories and channels

In the Categories and channels field, enter one category per line. Separate the category name from its comma-separated channel names with a vertical bar:

```text
Community | welcome, rules, general
Events | announcements, signups
Voice Hub |
```

A category can have no channels. Channel names must use lowercase English letters, numbers, hyphens, or underscores, and each name must start with a letter or number.

## Validation limits

The editor validates your structure before it can be previewed.

| Item | Limit |
| --- | --- |
| Roles | Up to 20 |
| Categories | 1 to 20 |
| Channels in each category | Up to 30 |
| Total roles, categories, and channels | Up to 100 |
| Role and category names | 1 to 100 characters |
| Channel names | Lowercase letters, numbers, hyphens, and underscores |

Role, category, and channel names must be unique within their respective lists. Duplicate names are rejected rather than guessed or silently renamed. Unsupported fields, including permission settings, are not accepted.

## Import an AI suggestion

You can use the [AI-assisted structure design workflow](ai-assisted-structure-design.md) to create a prompt, get a JSON suggestion from an external assistant, and import the names into these editor fields. The imported structure remains editable and must pass the app's server-side validation before preview.

## Preview before applying

After entering or importing your structure, select the preview action. Review every Create and Reuse item, inspect reused role permissions, and check channel visibility. Editing the fields clears the previous preview, so generate a new one after any change.

Custom structures do not set role permissions, assign roles to members, or make channels private. New roles start with zero permissions and are not assigned. New channels inherit category or server visibility and may be public.

> **Warning:** Previewing does not write to Discord. Applying requires the same expiring, server-bound preview, exact confirmation phrase, and final browser confirmation used by built-in templates.

See [preview and review setup changes](preview-and-review.md), [role permissions](../admins/role-permissions.md), and [channel visibility](../admins/channel-visibility.md) before applying.
