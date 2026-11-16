import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Calculator, Plus, Receipt, Ship, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { snackbar } from "@/components/ui/snackbar";
import { currencyOptions } from "@/lib/currencies";
import {
  addContainerSlot,
  blankReconciliation,
  containerNumbers,
  containerSlots,
  MAX_CONTAINERS,
  removeContainerSlot,
  setContainerSlot,
  BE_PARTIES,
  newBeLine,
  CLOSURE_STATUSES,
  FRUITS,
  PARTY_NAMES,
  PAYMENT_STATUSES,
  PORT_CODES,
  TPT_NAMES,
  validateDebitAdvice,
  withoutEmptyRows,
  type BeLine,
  type DebitAdvice,
  type DebitTranche,
  type Reconciliation,
} from "@/lib/debit-advice";
import type { FieldErrors } from "@/lib/login-schema";
import { Combo, TextField } from "./fields";
import { useMasterOptions } from "./receiver-directory";
import { receiverNameChoices, shipperNameChoices } from "@/lib/master-choices";

/**
 * The Add Ledger Entry tab: one debit advice, its amounts, then one card per BE with its TPT payment and duty
 * check. The draft lives in the parent, so what was typed survives moving between tabs.
 */
export function DebitAdviceForm({
  form,
  setForm,
  isNew,
  onCancel,
  onSave,
}: {
  form: DebitAdvice;
  setForm: Dispatch<SetStateAction<DebitAdvice>>;
  isNew: boolean;
  onCancel: () => void;
  onSave: (advice: DebitAdvice) => void;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  // A BE line's Party is picked from the receivers (receiverDropdown); the sheet's names until it loads.
  // Party Name and each BE line's Party are picked from the receivers (receiverDropdown); the sheet's
  // names, with typing allowed, until that list has loaded.
  const master = useMasterOptions();
  const receiverPartyNames = receiverNameChoices(master, PARTY_NAMES);
  const receiverParties = receiverNameChoices(master, BE_PARTIES);
  // A BE line's Shipper is picked from the shippers (shipperDropdown); the sheet's names until it loads.
  const shipperNames = shipperNameChoices(master, TPT_NAMES);
  const clearError = (key: string) => setErrors(({ [key]: _cleared, ...rest }) => rest);
  // Add BE line is above a long form's lower cards, so bring the new card into view.
  const lastCard = useRef<HTMLDivElement>(null);
  const scrollToNewCard = useRef(false);
  useEffect(() => {
    if (!scrollToNewCard.current) return;
    scrollToNewCard.current = false;
    lastCard.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [form.lines.length]);
  const setAdvice = (key: "date" | "partyName" | "reference" | "tolRef" | "billNo" | "curr") =>
    ({
      value: form[key],
      error: errors[key],
      onChange: (v: string) => {
        setForm((f) => ({ ...f, [key]: v }));
        clearError(key);
      },
    }) as const;
  const setTranche = (index: number, key: keyof Omit<DebitTranche, "id">, value: string) => {
    setForm((f) => ({
      ...f,
      tranches: f.tranches.map((t, i) => (i === index ? { ...t, [key]: value } : t)),
    }));
    clearError(`tranche.${index}.${key}`);
  };
  const lineField = (
    index: number,
    key: keyof Omit<BeLine, "id" | "rowVersion" | "hasEnhancement">,
  ) => ({
    value: form.lines[index]?.[key] ?? "",
    error: errors[`line.${index}.${key}`],
    onChange: (v: string) => {
      setForm((f) => ({
        ...f,
        lines: f.lines.map((l, i) => (i === index ? { ...l, [key]: v } : l)),
      }));
      clearError(`line.${index}.${key}`);
    },
  });
  // Container boxes and Number of Containers move together, so a change to either clears all their errors.
  const updateLine = (index: number, update: (line: BeLine) => BeLine) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? update(l) : l)) }));
    setErrors((e) =>
      Object.fromEntries(
        Object.entries(e).filter(
          ([k]) => !k.startsWith(`line.${index}.container`) && k !== `line.${index}.ctrCount`,
        ),
      ),
    );
  };
  // The date and reference belong to the status they were entered for, so a new status starts them blank.
  const closureStatus = (index: number) => ({
    value: form.lines[index]?.closure ?? "",
    error: errors[`line.${index}.closure`],
    onChange: (v: string) => {
      setForm((f) => ({
        ...f,
        lines: f.lines.map((l, i) =>
          i === index && l.closure !== v
            ? { ...l, closure: v, closureDate: "", closureRef: "" }
            : l,
        ),
      }));
    },
  });
  // Typed by the user, not worked out from the amounts above (user request, 2026-11-10).
  const reconcile = (key: keyof Reconciliation) => ({
    value: form.reconciliation?.[key] ?? "",
    onChange: (v: string) =>
      setForm((f) => ({
        ...f,
        reconciliation: { ...(f.reconciliation ?? blankReconciliation()), [key]: v },
      })),
  });
  // After a failed save, bring the first error on screen (top to bottom) into view and focus it, and name
  // that same error in the message. Runs after the errors have rendered, so the fields are marked.
  const formRef = useRef<HTMLFormElement>(null);
  const showFirstError = useRef(false);
  useEffect(() => {
    if (!showFirstError.current) return;
    showFirstError.current = false;
    const first = formRef.current?.querySelector<HTMLElement>(
      '[data-invalid="true"], .da-containers-error, .da-form > .field-message.error',
    );
    first?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    first?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
    // Inside a container breakdown, its summary ("1 container number is missing ...") says more than the box.
    const message =
      first?.closest(".da-containers")?.querySelector(".da-containers-error")?.textContent ??
      first?.querySelector(".field-message.error")?.textContent ??
      first?.textContent ??
      "";
    snackbar.error("Check the highlighted fields", {
      description: message.trim() || Object.values(errors)[0] || "Some details are missing",
    });
  }, [errors]);
  const submit = () => {
    const found = validateDebitAdvice(form);
    if (found) {
      showFirstError.current = true;
      setErrors(found);
      return;
    }
    onSave(withoutEmptyRows(form));
  };
  return (
    <section className="tpt-form">
      <div className="tpt-form-header">
        <div>
          <h2>{isNew ? "Add Ledger Entry" : "Edit Ledger Entry"}</h2>
          <p>
            Fill in the debit advice, the BE lines, or both. Amounts paid to a shipper become
            available in shipment payments.
          </p>
        </div>
      </div>
      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="tpt-form-body da-form">
          {errors["form"] && (
            <p className="field-message error" role="alert">
              {errors["form"]}
            </p>
          )}
          <section className="tpt-entry-card">
            <div className="form-grid">
              <div className="form-section-title">
                <Receipt />
                OX - GSM Debit advice
              </div>
              <TextField label="Date" type="date" {...setAdvice("date")} />
              <Combo
                label="Party Name"
                options={receiverPartyNames.choices}
                create={!receiverPartyNames.fromMaster}
                placeholder="Select receiver"
                {...setAdvice("partyName")}
              />
              <Combo
                label="Currency"
                create={false}
                placeholder="Select currency"
                options={currencyOptions}
                {...setAdvice("curr")}
              />
              <TextField label="TOL Ref. No." {...setAdvice("tolRef")} />
              <TextField label="Bill No. / ORM No." {...setAdvice("billNo")} />
              <TextField label="Payment Reference" {...setAdvice("reference")} />
            </div>
            <div className="da-tranches">
              {form.tranches.map((t, i) => (
                <div className="da-tranche" key={t.id}>
                  <TextField
                    label="Currency Value"
                    type="number"
                    value={t.value}
                    error={errors[`tranche.${i}.value`]}
                    onChange={(v) => setTranche(i, "value", v)}
                  />
                  <TextField
                    label="Ex. Rate / INR"
                    type="number"
                    value={t.rate}
                    error={errors[`tranche.${i}.rate`]}
                    onChange={(v) => setTranche(i, "rate", v)}
                  />
                  <TextField
                    label="Amount"
                    type="number"
                    value={t.amount}
                    error={errors[`tranche.${i}.amount`]}
                    onChange={(v) => setTranche(i, "amount", v)}
                  />
                  {form.tranches.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="da-remove"
                      aria-label={`Remove amount ${i + 1}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          tranches: f.tranches.filter((x) => x.id !== t.id),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
          {form.lines.map((line, i) => {
            const field = (key: keyof Omit<BeLine, "id" | "rowVersion" | "hasEnhancement">) =>
              lineField(i, key);
            return (
              <section
                className="tpt-entry-card"
                key={line.id}
                ref={i === form.lines.length - 1 ? lastCard : null}
              >
                <div className="tpt-entry-head">
                  <span>BE line {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove BE line ${i + 1}`}
                    onClick={() =>
                      setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.id !== line.id) }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="form-grid">
                  <div className="form-section-title">
                    <Ship />
                    Shipment and BE
                  </div>
                  <TextField label="BL No." {...field("blNo")} />
                  <Combo label="Port Code" options={PORT_CODES} {...field("portCode")} />
                  <TextField label="BE No." {...field("beNo")} />
                  <TextField label="BE Date" type="date" {...field("beDate")} />
                  <Combo
                    label="BE Currency"
                    create={false}
                    placeholder="Select currency"
                    options={currencyOptions}
                    {...field("beCurr")}
                  />
                  <TextField label="BE Value" type="number" {...field("beValue")} />
                  <TextField label="Ref." {...field("ref")} />
                  <TextField label="Invoice Number" {...field("invNo")} />
                  <Combo
                    label="Party"
                    options={receiverParties.choices}
                    create={!receiverParties.fromMaster}
                    placeholder="Select receiver"
                    {...field("party")}
                  />
                  <Combo
                    label="Fruit"
                    create={false}
                    clearable
                    placeholder="Select fruit"
                    options={FRUITS}
                    {...field("fruit")}
                  />
                  <TextField label="Number of Cartons" type="number" {...field("cartons")} />
                  <TextField label="Nt. Weight" type="number" {...field("netWeight")} />
                  <TextField
                    label="Number of Containers"
                    type="number"
                    inputProps={{ min: 0, max: MAX_CONTAINERS, step: 1 }}
                    {...field("ctrCount")}
                    onChange={(v) => updateLine(i, (l) => ({ ...l, ctrCount: v }))}
                  />
                  <Combo
                    label="BE Closure Status"
                    className="da-closure-status"
                    create={false}
                    clearable
                    placeholder="Select status"
                    options={CLOSURE_STATUSES}
                    {...closureStatus(i)}
                  />
                  {line.closure && (
                    <>
                      <TextField
                        label={`${line.closure} On`}
                        type="date"
                        {...field("closureDate")}
                      />
                      <TextField label={`${line.closure} Reference`} {...field("closureRef")} />
                    </>
                  )}
                  <ContainerBreakdown
                    line={line}
                    index={i}
                    errors={errors}
                    onChange={(update) => updateLine(i, update)}
                  />
                  <div className="form-section-title">
                    <Wallet />
                    GSM to Shipper
                  </div>
                  <Combo
                    label="Shipper"
                    options={shipperNames.choices}
                    create={!shipperNames.fromMaster}
                    placeholder="Select shipper"
                    {...field("tpt")}
                  />
                  <TextField label="Paid On" type="date" {...field("paidOn")} />
                  <Combo
                    label="Paid Currency"
                    create={false}
                    placeholder="Select currency"
                    options={currencyOptions}
                    {...field("paidCurr")}
                  />
                  <TextField label="Paid Currency Value" type="number" {...field("paidValue")} />
                  <div className="form-section-title">
                    <Calculator />
                    Duty check
                  </div>
                  <TextField label="Duty paid (BE)" type="number" {...field("dutyPaid")} />
                  <div className="field da-check-field">
                    <span className="field-label" aria-hidden="true">
                      &nbsp;
                    </span>
                    <label className={`doc-checkbox-card${line.hasEnhancement ? " checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(line.hasEnhancement)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          // Unticking takes the amount away with it, so nothing hidden is kept.
                          updateLine(i, (l) => ({
                            ...l,
                            hasEnhancement: on,
                            enhancementAmount: on ? l.enhancementAmount : "",
                          }));
                          clearError(`line.${i}.enhancementAmount`);
                        }}
                      />
                      <strong className="doc-checkbox-title">Enhancement amount</strong>
                    </label>
                  </div>
                  {line.hasEnhancement && (
                    <TextField
                      label="Enhancement amount"
                      type="number"
                      placeholder="Enter enhancement amount"
                      inputProps={{ min: 0, step: "any" }}
                      {...field("enhancementAmount")}
                    />
                  )}
                </div>
              </section>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="da-add-line"
            onClick={() => {
              scrollToNewCard.current = true;
              setForm((f) => ({ ...f, lines: [...f.lines, newBeLine()] }));
            }}
          >
            <Plus />
            Add BE Line
          </Button>
          <section className="tpt-entry-card">
            <div className="form-grid">
              <div className="form-section-title">
                <Calculator />
                Reconciliation
              </div>
              <TextField label="Currency Value" type="number" {...reconcile("value")} />
              <TextField label="Amount" type="number" {...reconcile("amount")} />
              <TextField label="BE Value" type="number" {...reconcile("beValue")} />
              <TextField label="ORM - BE" type="number" {...reconcile("ormBe")} />
              <Combo
                label="Payment Status"
                create={false}
                clearable
                placeholder="Select status"
                options={PAYMENT_STATUSES}
                value={form.reconciliation?.status ?? ""}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    reconciliation: { ...(f.reconciliation ?? blankReconciliation()), status: v },
                    // "Matched to" is only for a More/Less paid status; Matched (or cleared) drops it.
                    ...(v && v !== "Matched" ? {} : { matchedTo: "" }),
                  }))
                }
              />
              {Boolean(form.reconciliation?.status) &&
                form.reconciliation?.status !== "Matched" && (
                  <TextField
                    label="Matched to (BE or ORM No.)"
                    wide
                    value={form.matchedTo}
                    onChange={(v) => setForm((f) => ({ ...f, matchedTo: v }))}
                  />
                )}
            </div>
          </section>
        </div>
        <div className="tpt-form-footer">
          <Button type="button" variant="outline" onClick={onCancel}>
            {isNew ? "Clear" : "Cancel"}
          </Button>
          <Button type="submit">{isNew ? "Save" : "Save Changes"}</Button>
        </div>
      </form>
    </section>
  );
}

/**
 * A BE line's containers, one box each (user request, 2026-11-16): Number of Containers sets how many boxes
 * show, Add Container adds one, and removing a box lowers the count.
 */
function ContainerBreakdown({
  line,
  index,
  errors,
  onChange,
}: {
  line: BeLine;
  index: number;
  errors: FieldErrors;
  onChange: (update: (line: BeLine) => BeLine) => void;
}) {
  const slots = containerSlots(line);
  const listed = containerNumbers(line.containerNo).length;
  const listError = errors[`line.${index}.containerNo`];
  const hasError = Object.keys(errors).some((k) => k.startsWith(`line.${index}.container`));
  return (
    <div className={`da-containers${hasError ? " has-error" : ""}`}>
      <div className="da-containers-head">
        <span>Container breakdown</span>
        <strong>
          {listed} {listed === 1 ? "container number" : "container numbers"}
        </strong>
      </div>
      <div className="da-container-grid">
        {slots.map((number, j) => (
          <div className="da-container" key={j}>
            <TextField
              label={`Container ${j + 1}`}
              placeholder="Container number"
              value={number}
              error={errors[`line.${index}.container.${j}`]}
              inputProps={{ maxLength: 40, autoComplete: "off" }}
              onChange={(v) => onChange((l) => setContainerSlot(l, j, v))}
            />
            {slots.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="da-remove"
                aria-label={`Remove container ${j + 1} of BE line ${index + 1}`}
                onClick={() => onChange((l) => removeContainerSlot(l, j))}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </div>
      {listError && (
        <p className="da-containers-error" role="alert">
          {listError}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="da-add-container"
        disabled={slots.length >= MAX_CONTAINERS}
        onClick={() => onChange(addContainerSlot)}
      >
        <Plus />
        Add Container
      </Button>
    </div>
  );
}
