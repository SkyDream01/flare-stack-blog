# Webhook Endpoint speaks the receiver's format

Supersedes the "not an adapter" part of [ADR 0018](./0018-generic-json-webhook-endpoint.md).

The generic signed JSON needed a receiver the Admin runs, so almost nobody who only wants a phone alert could use it. The single Webhook Endpoint now names a channel: Telegram, Discord, Feishu, DingTalk, WeCom, Bark and ntfy each get their own request built from a preset template, `custom` fills an Admin-written body template with `{{title}}`, `{{message}}`, `{{url}}` and `{{data.*}}`, and `generic` keeps ADR 0018's payload and signature byte for byte. A stored endpoint without a channel is `generic`, so configs and queued messages written before this change still deliver unchanged.

There is still exactly one endpoint and no per-event subscription: email already covers a second channel, and a list would bring add/remove/enable UI and a config-shape change for little gain. The one `secret` field means the generic or custom signing key, or Telegram's bot token, so a saved secret never follows the Admin to another channel and channels that need none drop it. Feishu, DingTalk and WeCom signature verification is not supported; their keyword security works because every chat message starts with the localized "Blog notification" title (博客通知).
