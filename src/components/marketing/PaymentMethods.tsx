"use client";

export const PAYMENT_METHODS = [
  { code: "UZUM", name: "Uzum Bank", mark: "U", color: "#7024dd" },
  { code: "PAYME", name: "Payme", mark: "P", color: "#208a8f" },
  { code: "CLICK", name: "Click", mark: "C", color: "#1465d8" },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]["code"];

export default function PaymentMethods({ value, onChange, disabled }: {
  value: PaymentMethod | "";
  onChange: (value: PaymentMethod) => void;
  disabled: boolean;
}) {
  return <fieldset className="payment-methods" disabled={disabled}>
    <legend>To‘lov usulini tanlang</legend>
    <div className="payment-method-grid">
      {PAYMENT_METHODS.map(method => <label
        key={method.code}
        className={`payment-method ${value === method.code ? "chosen" : ""}`}
      >
        <input
          type="radio"
          name="paymentMethod"
          value={method.code}
          checked={value === method.code}
          onChange={() => onChange(method.code)}
          required
        />
        <span className="payment-mark" style={{ backgroundColor: method.color }} aria-hidden="true">{method.mark}</span>
        <span>{method.name}</span>
      </label>)}
    </div>
  </fieldset>;
}
