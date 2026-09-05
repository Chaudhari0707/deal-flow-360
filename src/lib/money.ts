const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Legacy *Cents fields store hundredths of a rupee (paise). */
export function money(paise: number) {
  return rupees.format(paise / 100);
}

/** Standard PDF fonts require an ASCII currency label. */
export function documentMoney(paise: number) {
  return money(paise).replace("₹", "INR ");
}
