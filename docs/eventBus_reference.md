# core/eventBus.js – Reference

## Methods
- `emit(event, data)` – Broadcasts an event to all subscribers.
- `subscribe(event, handler)` – Registers a callback.
- `on(event, handler)` – Alias for subscribe.

## Event Families
- **chat:*** → chat message flow
- **flatTire:*** → flat-tire updates
- **playerPage:*** → opponent list updates
- **ui:notify** / **ui:overlay:*** → global notifications & overlays
