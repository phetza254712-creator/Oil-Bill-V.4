import * as XLSX from "xlsx";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";
import { uid } from "./logic.js";
GlobalWorkerOptions.workerSrc = pdfWorker;

const aliases = {
  receipt_id:["receipt_id","เลขที่บิล","เลขที่ใบเสร็จ","เลขที่ใบกำกับภาษี","เลขที่เอกสาร"],
  date:["date","วันที่","วันที่ขาย","วันทำรายการ"],
  seller_name:["seller_name","ชื่อผู้ขาย","ชื่อบริษัทผู้ขาย","สถานีบริการ","ปั๊มน้ำมัน"],
  seller_tax_id:["seller_tax_id","เลขผู้เสียภาษีผู้ขาย","เลขประจำตัวผู้เสียภาษีผู้ขาย"],
  buyer_name:["buyer_name","ชื่อผู้ซื้อ","ชื่อลูกค้า","ชื่อบริษัทลูกค้า"],
  buyer_tax_id:["buyer_tax_id","เลขผู้เสียภาษีผู้ซื้อ","เลขประจำตัวผู้เสียภาษีผู้ซื้อ"],
  vehicle_plate:["vehicle_plate","ทะเบียนรถ","ทะเบียน"],
  subtotal:["subtotal","มูลค่าสินค้า","มูลค่าก่อนภาษี"],
  vat:["vat","ภาษีมูลค่าเพิ่ม","ภาษี"],
  discount:["discount","ส่วนลด"],
  total_amount:["total_amount","ยอดสุทธิ","รวมเป็นเงิน","ยอดรวม","จำนวนเงิน"],
  payment_method:["payment_method","วิธีชำระเงิน"]
};
function normalizeDate(v) {
  if (typeof v==="number") { const d=XLSX.SSF.parse_date_code(v); if(d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
  const s=String(v||"").trim();
  let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(m){let y=Number(m[3]); if(y>2400)y-=543; return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;}
  return s.slice(0,10);
}
function mapRow(row) {
  const lower=Object.fromEntries(Object.entries(row).map(([k,v])=>[String(k).trim().toLowerCase(),v]));
  const out={id:uid(), items:[], cancelled:false, discount:0, vat:0, subtotal:0,total_amount:0};
  for(const [field,names] of Object.entries(aliases)){
    for(const name of names){ const key=name.toLowerCase(); if(lower[key]!==undefined && lower[key]!==""){out[field]=lower[key];break;} }
  }
  out.date=normalizeDate(out.date);
  for(const k of ["subtotal","vat","discount","total_amount"]) out[k]=Number(String(out[k]||0).replace(/,/g,""))||0;
  return out;
}
export async function importFile(file) {
  const ext=file.name.split(".").pop().toLowerCase();
  if(["xlsx","xls","csv"].includes(ext)){
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
    const rows=[];
    for(const sheet of wb.SheetNames){const data=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{defval:""}); data.forEach(r=>rows.push(mapRow(r)));}
    return {rows, text:""};
  }
  if(ext==="json"){
    const raw=JSON.parse(await file.text()); return {rows:(Array.isArray(raw)?raw:raw.receipts||[]).map(r=>({...r,id:r.id||uid()})),text:""};
  }
  if(ext==="pdf"){
    const pdf=await getDocument({data:await file.arrayBuffer()}).promise; let text="";
    for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p); const content=await page.getTextContent(); text+=content.items.map(i=>i.str).join(" ")+"\n";}
    return {rows:[],text};
  }
  if(["png","jpg","jpeg","webp","bmp"].includes(ext)){
    const worker=await createWorker("tha+eng");
    try {const result=await worker.recognize(file); return {rows:[],text:result.data.text};}
    finally {await worker.terminate();}
  }
  throw new Error("รองรับไฟล์ XLSX, XLS, CSV, JSON, PDF, PNG, JPG และ WEBP");
}