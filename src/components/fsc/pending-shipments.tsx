import { useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TextArea } from "./fields";
import type { FieldErrors } from "@/lib/login-schema";
import { validateForm } from "@/lib/login-schema";
import { displayDate, parseIsoDate } from "@/lib/date-value";
import { money } from "@/lib/fsc";
import {
  REJECT_REASON_MAX,
  rejectSchema,
  timeAgo,
  type PendingShipment,
} from "@/lib/pending-shipments";

/** Admin approval queue: shipments created by shippers, receivers and CHA users. */
export function PendingShipments({
  items,
  onApprove,
  onReject,
}: {
  items: PendingShipment[];
  onApprove: (p: PendingShipment) => void;
  onReject: (p: PendingShipment, reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState<PendingShipment | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const close = () => {
    setRejecting(null);
    setReason("");
    setErrors({});
  };
  const confirmReject = () => {
    const found = validateForm(rejectSchema, { reason });
    setErrors(found ?? {});
    if (found || !rejecting) return;
    onReject(rejecting, reason.trim());
    close();
  };
  return (
    <>
      <section className="pend" aria-label="Pending shipments">
        <header className="pend-head">
          <span className="pend-icon" aria-hidden="true">
            <Clock3 size={18} />
          </span>
          <div>
            <h2>
              Pending shipments <span className="count">{items.length}</span>
            </h2>
            <p>
              Created by shippers, receivers and CHA users. Approve to add a shipment to Active
              shipments, or reject it with a reason.
            </p>
          </div>
        </header>
        {items.length === 0 ? (
          <div className="pend-empty">
            <Inbox size={28} aria-hidden="true" />
            <strong>You're all caught up</strong>
            <span>New shipments created by other users will wait here for your approval.</span>
          </div>
        ) : (
          <ul className="pend-list">
            {items.map((p) => {
              const eta = parseIsoDate(p.eta);
              return (
                <li className="pend-card" key={p.id}>
                  <div className="pend-who">
                    <span className="avatar">{p.requestedBy.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{p.requestedBy}</strong>
                      <small>
                        <i className={`pend-role ${p.requestedRole.toLowerCase()}`}>
                          {p.requestedRole}
                        </i>
                        {timeAgo(p.submittedMinutesAgo)}
                      </small>
                    </div>
                  </div>
                  <div className="pend-main">
                    <div className="pend-title">
                      <b>{p.vase}</b>
                      <small>BL {p.blNo}</small>
                    </div>
                    <div className="pend-route">
                      <span>{p.pol}</span>
                      <ArrowRight size={13} aria-hidden="true" />
                      <span>{p.pod}</span>
                      <em>{p.description}</em>
                    </div>
                    {p.note && <p className="pend-note">“{p.note}”</p>}
                  </div>
                  <dl className="pend-facts">
                    <div>
                      <dt>Receiver</dt>
                      <dd>{p.receiver}</dd>
                    </div>
                    <div>
                      <dt>Shipper</dt>
                      <dd>{p.shipper}</dd>
                    </div>
                    <div>
                      <dt>
                        <CalendarDays size={11} /> ETA
                      </dt>
                      <dd>{eta ? displayDate(eta) : "—"}</dd>
                    </div>
                    <div>
                      <dt>AGV</dt>
                      <dd>{money(p.agv)}</dd>
                    </div>
                  </dl>
                  <div className="pend-actions">
                    <Button
                      variant="outline"
                      className="pend-reject"
                      aria-label={`Reject ${p.vase}`}
                      onClick={() => setRejecting(p)}
                    >
                      <X size={15} />
                      Reject
                    </Button>
                    <Button aria-label={`Approve ${p.vase}`} onClick={() => onApprove(p)}>
                      <Check size={15} />
                      Approve
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="pend-foot">Preview data: decisions are not sent to the server yet.</p>
      </section>
      <Dialog open={Boolean(rejecting)} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogTitle>Reject {rejecting?.vase}?</DialogTitle>
          <DialogDescription>
            The shipment will be removed from the queue. Tell {rejecting?.requestedBy} why.
          </DialogDescription>
          <TextArea
            label="Reason"
            required
            value={reason}
            onChange={setReason}
            error={errors["reason"]}
            placeholder="e.g. POD should be CHE, please resubmit"
            hint={`${reason.length}/${REJECT_REASON_MAX}`}
            textareaProps={{ autoFocus: true }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Reject shipment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
