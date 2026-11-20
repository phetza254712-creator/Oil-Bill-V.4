import { describe, it, expect } from "vitest";
import { summarize, validateReceipt, parseReceiptText } from "./logic.js";
const sample={id:"1",receipt_id:"201514",date:"2026-10-22",seller_name:"OR",buyer_name:"บริษัท ตัวอย่าง",vehicle_plate:"บห7955",subtotal:1401.87,vat:98.13,discount:0,total_amount:1500,items:[{name:"ผลิตภัณฑ์ DIESEL",quantity:34.41}]};
describe("OilBill core logic",()=>{
 it("summarizes period totals and fuel liters",()=>{const s=summarize([sample],"2026-10-01","2026-10-31");expect(s.total).toBe(1500);expect(s.liters).toBe(34.41);expect(s.count).toBe(1);});
 it("detects duplicate seller receipt and arithmetic mismatch",()=>{expect(validateReceipt({...sample},[sample])).toContain("พบเลขที่บิลซ้ำจากผู้ขายรายเดียวกัน");expect(validateReceipt({...sample,total_amount:1400},[]).length).toBeGreaterThan(0);});
 it("extracts key fields from OCR text",()=>{const r=parseReceiptText("เลขที่ใบกำกับภาษี 201514 วันที่ขาย 22/10/2569 ผลิตภัณฑ์ DIESEL 34.410 L มูลค่าสินค้า 1,401.87 ภาษีมูลค่าเพิ่ม 98.13 รวมเป็นเงินทั้งสิ้น 1,500.00");expect(r.receipt_id).toBe("201514");expect(r.date).toBe("2026-10-22");expect(r.total_amount).toBe(1500);});
});