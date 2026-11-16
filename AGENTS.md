- Keep the FSC shell in the root route so preview data and selected persona survive client-side navigation; leaf routes own their metadata.
- Calculate goods value and TPT reservation through shared pure helpers so business calculations remain testable.
- Use shared ShipmentFields for add, edit, and details so screenshot fields cannot diverge between forms.
- Keep workspace preferences in a root-mounted provider; changes apply through CSS tokens and remain frontend-only.
- Keep calculator estimates in a pure helper and label them as preview estimates because the original pricing formula was not supplied.

- Keep ledger entries in the root FSC shell, derive available TPT from transfers less other shipments’ saved reservations, and scope the Shipper Ledger to records matching that member’s shipper code.
- Sign-in checks in-memory User Management members (findLogin/roleFor in src/lib/fsc.ts); it is a mock gate, never production authorization.
- Keep the CHA dashboard in a dedicated component with scoped styles; derive metrics through a pure helper from root-owned active/master records so navigation and shipment edits cannot desynchronize its totals.
