export const money = n => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const number = n => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export function summarize(rows, from, to) {
  const data = rows.filter(r => r.date >= from && r.date <= to && !r.cancelled);
  const total = data.reduce((s,r) => s + Number(r.total_amount || 0), 0);
  const vat = data.reduce((s,r) => s + Number(r.vat || 0), 0);
  const liters = data.reduce((s,r) => s + (r.items || []).filter(i => /ดีเซล|DIESEL|เบนซิน|GASOHOL|โซฮอล์/i.test(i.name || "")).reduce((a,i)=>a+Number(i.quantity||0),0), 0);
  const by = (key) => data.reduce((acc,r) => { const k = key(r) || "ไม่ระบุ"; acc[k] = (acc[k]||0)+Number(r.total_amount||0); return acc; }, {});
  return { count:data.length, total, vat, liters, average:data.length?total/data.length:0, byVehicle:by(r=>r.vehicle_plate), bySeller:by(r=>r.seller_name) };
}
export function validateReceipt(r, existing=[]) {
  const errors=[];
  if (!String(r.receipt_id||"").trim()) errors.push("กรุณาระบุเลขที่บิล");
  if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errors.push("วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD");
  if (!String(r.seller_name||"").trim()) errors.push("กรุณาระบุชื่อผู้ขาย/สถานีบริการ");
  if (!String(r.buyer_name||"").trim()) errors.push("กรุณาระบุชื่อผู้ซื้อ");
  if (existing.some(x=>x.id!==r.id && x.receipt_id?.trim().toLowerCase()===r.receipt_id?.trim().toLowerCase() && x.seller_name?.trim().toLowerCase()===r.seller_name?.trim().toLowerCase())) errors.push("พบเลขที่บิลซ้ำจากผู้ขายรายเดียวกัน");
  const expected=Number(r.subtotal||0)+Number(r.vat||0)-Number(r.discount||0);
  if (Math.abs(expected-Number(r.total_amount||0))>0.06) errors.push(`ยอดไม่ตรง: ก่อนภาษี + VAT - ส่วนลด = ${expected.toFixed(2)} บาท`);
  return errors;
}
export function parseReceiptText(text) {
  const t=String(text||"").replace(/\r/g," ").replace(/[๐-๙]/g,d=>"๐๑๒๓๔๕๖๗๘๙".indexOf(d));
  const pick = (re) => (t.match(re)||[])[1] || "";
  const amounts = [...t.matchAll(/(?:รวมเป็นเงินทั้งสิ้น|รวมเป็นเงิน|ยอดสุทธิ|รวมเงิน|จำนวนเงิน)\s*[:：]?\s*([\d,]+\.\d{2})/gi)].map(m=>Number(m[1].replace(/,/g,"")));
  const taxids = [...t.matchAll(/\b\d{13}\b/g)].map(m=>m[0]);
  const liters = pick(/([\d,]+(?:\.\d+)?)\s*(?:L|ลิตร)/i).replace(/,/g,"");
  const date = pick(/(?:วันที่ขาย|วันที่|วันทำรายการ)\s*[:：]?\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/i);
  let normalizedDate="";
  if(date){ const m=date.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if(m) normalizedDate=`${Number(m[3])>2400?Number(m[3])-543:m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; }
  const rid=pick(/(?:เลขที่ใบกำกับภาษี|เลขที่ใบเสร็จ|เลขที่)\s*[:：#]?\s*([A-Z0-9-]{4,})/i);
  const vat=pick(/(?:VAT|ภาษีมูลค่าเพิ่ม)[^0-9]{0,20}([\d,]+\.\d{2})/i);
  const subtotal=pick(/(?:มูลค่าสินค้า|มูลค่าสินค้าก่อนภาษี)[^0-9]{0,20}([\d,]+\.\d{2})/i);
  return { receipt_id:rid, date:normalizedDate, seller_tax_id:taxids[0]||"", buyer_tax_id:taxids[1]||"", quantity:liters, vat:vat?Number(vat.replace(/,/g,"")):0, subtotal:subtotal?Number(subtotal.replace(/,/g,"")):0, total_amount:amounts.at(-1)||0 };
}