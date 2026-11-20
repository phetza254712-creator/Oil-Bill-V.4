export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `bill-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function number(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2
  }).format(Number.isFinite(n) ? n : 0);
}

export function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(n) ? n : 0);
}

export function summarize(rows = [], from = "0000-01-01", to = "9999-12-31") {
  const active = rows.filter(r =>
    !r.cancelled &&
    String(r.date || "") >= from &&
    String(r.date || "") <= to
  );

  const result = {
    total: 0,
    count: active.length,
    liters: 0,
    vat: 0,
    average: 0,
    byVehicle: {},
    bySeller: {}
  };

  for (const r of active) {
    const total = Number(r.total_amount) || 0;
    result.total += total;
    result.vat += Number(r.vat) || 0;

    const liters = Array.isArray(r.items)
      ? r.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      : Number(r.quantity) || 0;

    result.liters += liters;

    const vehicle = String(r.vehicle_plate || "ไม่ระบุทะเบียน");
    const seller = String(r.seller_name || "ไม่ระบุผู้ขาย");

    result.byVehicle[vehicle] = (result.byVehicle[vehicle] || 0) + total;
    result.bySeller[seller] = (result.bySeller[seller] || 0) + total;
  }

  result.average = result.count ? result.total / result.count : 0;

  for (const key of ["total", "vat", "liters", "average"]) {
    result[key] = Math.round(result[key] * 100) / 100;
  }

  return result;
}

export function validateReceipt(row, existing = []) {
  const errors = [];

  const receiptId = String(row.receipt_id || "").trim().toLowerCase();
  const seller = String(row.seller_name || "").trim().toLowerCase();

  if (
    receiptId &&
    seller &&
    existing.some(item =>
      item.id !== row.id &&
      String(item.receipt_id || "").trim().toLowerCase() === receiptId &&
      String(item.seller_name || "").trim().toLowerCase() === seller
    )
  ) {
    errors.push("พบเลขที่บิลซ้ำจากผู้ขายรายเดียวกัน");
  }

  const subtotal = Number(row.subtotal) || 0;
  const vat = Number(row.vat) || 0;
  const discount = Number(row.discount) || 0;
  const total = Number(row.total_amount) || 0;

  const expected = subtotal + vat - discount;

  const hasAmounts = [
    "subtotal",
    "vat",
    "discount",
    "total_amount"
  ].some(k => row[k] !== undefined && row[k] !== null && row[k] !== "");

  if (hasAmounts && Math.abs(expected - total) > 0.01) {
    errors.push(
      `ยอดไม่ตรง: ก่อนภาษี + VAT - ส่วนลด = ${expected.toFixed(2)} บาท`
    );
  }

  return errors;
}

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
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    let year = Number(dateMatch[3]);

    if (year > 2400) year -= 543;

    const valid = new Date(year, month - 1, day);

    if (
      month >= 1 && month <= 12 &&
      day >= 1 && day <= 31 &&
      valid.getFullYear() === year &&
      valid.getMonth() === month - 1 &&
      valid.getDate() === day
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
