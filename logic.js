export function parseReceiptText(text) {
  const t = String(text || "")
    .replace(/\r/g, " ")
    .replace(/[๐-๙]/g, d => "๐๑๒๓๔๕๖๗๘๙".indexOf(d));

  const pick = re => (t.match(re) || [])[1] || "";

  const amounts = [
    ...t.matchAll(
      /(?:รวมเป็นเงินทั้งสิ้น|ยอดสุทธิ|รวมเป็นเงิน|รวมเงิน|จำนวนเงิน)\s*[:：]?\s*([\d,]+\.\d{2})/gi
    )
  ].map(m => Number(m[1].replace(/,/g, "")));

  const taxids = [...t.matchAll(/\b\d{13}\b/g)].map(m => m[0]);

  const dateMatch = t.match(
    /(?:วันที่ขาย|วันที่|วันทำรายการ)\s*[:：]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i
  );

  let normalizedDate = "";

  if (dateMatch) {
    let day = Number(dateMatch[1]);
    let month = Number(dateMatch[2]);
    let year = Number(dateMatch[3]);

    if (year > 2400) year -= 543;

    if (
      month >= 1 && month <= 12 &&
      day >= 1 && day <= 31
    ) {
      normalizedDate =
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const liters = pick(/([\d,]+(?:\.\d+)?)\s*(?:L|ลิตร)/i)
    .replace(/,/g, "");

  const rid = pick(
    /(?:เลขที่ใบกำกับภาษี|เลขที่ใบเสร็จ|เลขที่)\s*[:：#]?\s*([A-Z0-9-]{4,})/i
  );

  const vat = pick(
    /(?:VAT|ภาษีมูลค่าเพิ่ม)[^0-9]{0,20}([\d,]+\.\d{2})/i
  );

  const subtotal = pick(
    /(?:มูลค่าสินค้าก่อนภาษี|มูลค่าสินค้า)[^0-9]{0,20}([\d,]+\.\d{2})/i
  );

  return {
    receipt_id: rid,
    date: normalizedDate,
    seller_tax_id: taxids[0] || "",
    buyer_tax_id: taxids[1] || "",
    quantity: liters,
    vat: vat ? Number(vat.replace(/,/g, "")) : 0,
    subtotal: subtotal ? Number(subtotal.replace(/,/g, "")) : 0,
    total_amount: amounts.at(-1) || 0
  };
}
