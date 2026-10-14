# Accepted app direction

The owner chose V2, the WhatsApp-like messaging direction, for implementation.
Keep compact chat rows, normal message bubbles, quoted replies, inline drafts,
small permission controls and a separate assistant conversation. Do not redesign
around a dashboard. Use an independent charcoal/blue palette, not WhatsApp green.

Both light and dark modes are required. Default to the device theme and allow an
explicit override. Keep structure identical across themes. Theme colors are
semantic tokens so the client does not duplicate screens or hard-code green.

Paper's MCP quota is exhausted. The owner explicitly asked to leave Paper alone
and continue building. No more Paper tool calls or paid upgrades. The second row
in Paper and docs/design/whatsapp-v2.html are the design references. The local
preview completes the assistant body that could not be finished in Paper.

All mockup content is synthetic. Demo approval states are simulations, not real
WhatsApp receipts or delegation. Live integration remains gated. The runnable
client must show its actual backend/demo state and never claim a connected phone.
