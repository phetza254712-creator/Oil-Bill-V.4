import { getAll, put, remove, replaceAll } from "./db.js";
import { money, number, uid, today, summarize, validateReceipt, parseReceiptText } from "./logic.js";
import { importFile } from "./importers.js";
import "./style.css";

const $ = s => document.querySelector(s);
let receipts=[];
let currentRange="month";
let editingId=null;
let importDraft=[];
let chartMode="day";

const dateNow=today();
function dateRange(mode){
 const d=new Date(); let from=new Date(d), to=new Date(d);
 if(mode==="day"){} else if(mode==="week"){const day=(d.getDay()+6)%7;from.setDate(d.getDate()-day);} else if(mode==="month")from.setDate(1); else if(mode==="year"){from.setMonth(0,1);}
 const fmt=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
 return [fmt(from),fmt(to)];
}
function rangeStats(mode){const [a,b]=dateRange(mode);return summarize(receipts,a,b);}
function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function shell(){
 $("#app").innerHTML=`
 <aside class="sidebar">
  <div class="brand"><div class="brand-mark">O</div><div><b>OILBILL</b><small>FUEL CONTROL / V3</small></div></div>
  <div class="nav-label">WORKSPACE</div>
  <button class="nav active" data-page="overview"><span>◫</span> ภาพรวม</button>
  <button class="nav" data-page="receipts"><span>▤</span> รายการบิล</button>
  <button class="nav" data-page="reports"><span>▥</span> รายงานและสถิติ</button>
  <div class="nav-label">DATA MANAGEMENT</div>
  <button class="nav" data-page="import"><span>⇧</span> นำเข้าเอกสาร</button>
  <button class="nav" data-page="backup"><span>◈</span> สำรองข้อมูล</button>
  <div class="side-foot"><span class="status-dot"></span> เก็บข้อมูลในอุปกรณ์นี้<br><small>Local-first • ไม่ส่งข้อมูลออกเอง</small></div>
 </aside>
 <main class="main">
  <header class="topbar"><div><div class="eyebrow">FUEL & EXPENSE MANAGEMENT</div><h1 id="page-title">ภาพรวม</h1></div><div class="top-actions"><span class="today">${new Date().toLocaleDateString("th-TH",{dateStyle:"long"})}</span><button class="btn primary" id="quick-add">＋ เพิ่มบิล</button></div></header>
  <section id="content"></section>
 </main>
 <dialog id="receipt-dialog"><form id="receipt-form" method="dialog"><div class="dialog-head"><div><div class="eyebrow">RECEIPT ENTRY</div><h2 id="dialog-title">เพิ่มรายการบิล</h2></div><button type="button" class="icon-btn" id="close-dialog">×</button></div>
 <div class="form-grid">
 ${field("receipt_id","เลขที่ใบเสร็จ / ใบกำกับภาษี","text","required")}
 ${field("date","วันที่ขาย","date","required")}
 ${field("seller_name","ชื่อบริษัทผู้ขาย / สถานีบริการ","text","required","wide")}
 ${field("seller_tax_id","เลขผู้เสียภาษีผู้ขาย")}
 ${field("branch","สาขา")}
 ${field("buyer_name","ชื่อบริษัทผู้ซื้อ / ลูกค้า","text","required","wide")}
 ${field("buyer_tax_id","เลขผู้เสียภาษีผู้ซื้อ")}
 ${field("vehicle_plate","ทะเบียนรถ")}
 ${field("item_name","รายการสินค้า / น้ำมัน","text","","wide")}
 ${field("quantity","ปริมาณ (ลิตร / หน่วย)","number","step=\"0.001\"")}
 ${field("unit_price","ราคาต่อหน่วย (บาท)","number","step=\"0.01\"")}
 ${field("subtotal","มูลค่าสินค้าก่อนภาษี","number","step=\"0.01\"")}
 ${field("vat","VAT (บาท)","number","step=\"0.01\"")}
 ${field("discount","ส่วนลด (บาท)","number","step=\"0.01\"")}
 ${field("total_amount","ยอดสุทธิ (บาท)","number","step=\"0.01\"")}
 ${field("payment_method","วิธีชำระเงิน")}
 </div><div id="form-errors" class="form-errors"></div><div class="dialog-actions"><button type="button" class="btn ghost" id="cancel-dialog">ยกเลิก</button><button class="btn primary" type="submit">บันทึกบิล</button></div></form></dialog>
 <dialog id="import-dialog"><div class="dialog-head"><div><div class="eyebrow">IMPORT REVIEW</div><h2>ตรวจสอบข้อมูลก่อนบันทึก</h2></div><button class="icon-btn" id="close-import">×</button></div><div id="import-preview"></div><div class="dialog-actions"><button class="btn ghost" id="cancel-import">ยกเลิก</button><button class="btn primary" id="save-import">บันทึกรายการที่เลือก</button></div></dialog>`;
}
function field(name,label,type="text",attrs="",wide=""){return `<label class="field ${wide}"><span>${label}</span><input name="${name}" type="${type}" ${attrs}></label>`;}
function setPage(page){
 document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 const titles={overview:"ภาพรวม",receipts:"รายการบิล",reports:"รายงานและสถิติ",import:"นำเข้าเอกสาร",backup:"สำรองข้อมูล"};
 $("#page-title").textContent=titles[page]; render(page);
}
function kpi(label,value,sub,icon){return `<article class="kpi"><div class="kpi-top"><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><small>${sub}</small></article>`;}
function tableRows(rows){return rows.map(r=>`<tr><td><b>${escapeHTML(r.receipt_id)}</b><small>${escapeHTML(r.date)}</small></td><td>${escapeHTML(r.seller_name)}</td><td>${escapeHTML(r.buyer_name)}</td><td>${escapeHTML(r.vehicle_plate||"—")}</td><td class="num">${money(r.total_amount)}</td><td><span class="tag ${r.cancelled?"muted":"ok"}">${r.cancelled?"ยกเลิก":"บันทึกแล้ว"}</span></td><td><button class="text-btn" data-edit="${r.id}">แก้ไข</button><button class="text-btn danger" data-delete="${r.id}">ลบ</button></td></tr>`).join("");}
function render(page="overview"){
 const c=$("#content");
 if(page==="overview"){
  const d=rangeStats("day"),w=rangeStats("week"),m=rangeStats("month"),y=rangeStats("year");
  const latest=[...receipts].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  c.innerHTML=`<div class="welcome"><div><div class="eyebrow light">BUSINESS OVERVIEW</div><h2>ควบคุมค่าใช้จ่ายน้ำมัน<br>ได้ในมุมมองเดียว</h2><p>ข้อมูลจริงจากบิลที่บันทึกไว้ พร้อมตรวจสอบย้อนหลังได้ทุกช่วงเวลา</p></div><div class="welcome-art"><div class="ring"></div><div class="fuel-icon">⌁</div><span>FUEL / DATA / CONTROL</span></div></div>
  <div class="section-head"><div><h3>ภาพรวมตามช่วงเวลา</h3><p>คำนวณจากบิลที่ยังไม่ถูกยกเลิก</p></div></div>
  <div class="kpi-grid">${kpi("ยอดใช้จ่ายวันนี้",money(d.total),"บาท • "+d.count+" บิล","◷")}${kpi("ยอดใช้จ่ายสัปดาห์นี้",money(w.total),"บาท • "+w.count+" บิล","▦")}${kpi("ยอดใช้จ่ายเดือนนี้",money(m.total),"บาท • "+m.count+" บิล","▤")}${kpi("ยอดใช้จ่ายปีนี้",money(y.total),"บาท • "+y.count+" บิล","▥")}</div>
  <div class="split-grid"><article class="panel"><div class="panel-head"><div><h3>แนวโน้มรายวัน</h3><p>ยอดใช้จ่าย 7 วันล่าสุด</p></div><span class="panel-mark">THB</span></div>${miniChart(receipts)}</article><article class="panel"><div class="panel-head"><div><h3>ตัวเลขสำคัญเดือนนี้</h3><p>สรุปปริมาณและภาษี</p></div></div><div class="metric-line"><span>ปริมาณน้ำมันรวม</span><b>${number(m.liters)} ลิตร</b></div><div class="metric-line"><span>VAT รวม</span><b>${money(m.vat)} บาท</b></div><div class="metric-line"><span>ยอดเฉลี่ยต่อบิล</span><b>${money(m.average)} บาท</b></div><div class="metric-line"><span>จำนวนบิล</span><b>${m.count} ใบ</b></div></article></div>
  <article class="panel table-panel"><div class="panel-head"><div><h3>รายการล่าสุด</h3><p>บิลที่เพิ่มเข้าระบบล่าสุด</p></div><button class="text-btn" data-goto="receipts">ดูทั้งหมด →</button></div>${receiptTable(latest)}</article>`;
 } else if(page==="receipts"){
  const sorted=[...receipts].sort((a,b)=>b.date.localeCompare(a.date));
  c.innerHTML=`<div class="toolbar"><div class="searchbox">⌕ <input id="search" placeholder="ค้นหาเลขบิล บริษัท ทะเบียนรถ หรือวันที่"></div><button class="btn primary" id="add-from-list">＋ เพิ่มบิลใหม่</button></div><article class="panel table-panel"><div class="panel-head"><div><h3>ทะเบียนบิลทั้งหมด</h3><p>${receipts.length} รายการ • ข้อมูลจัดเก็บในอุปกรณ์</p></div><button class="btn ghost" id="export-csv">ส่งออก CSV</button></div><div id="receipt-table">${receiptTable(sorted)}</div></article>`;
  $("#search").addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#receipt-table").innerHTML=receiptTable(sorted.filter(r=>[r.receipt_id,r.seller_name,r.buyer_name,r.vehicle_plate,r.date].join(" ").toLowerCase().includes(q)));});
 } else if(page==="reports"){
  c.innerHTML=`<div class="report-controls"><label>ตั้งแต่ <input type="date" id="from" value="${dateRange("month")[0]}"></label><label>ถึง <input type="date" id="to" value="${dateNow}"></label><button class="btn primary" id="apply-report">คำนวณรายงาน</button></div><div id="report-result">${reportHTML(dateRange("month")[0],dateNow)}</div>`;
  $("#apply-report").onclick=()=>$("#report-result").innerHTML=reportHTML($("#from").value,$("#to").value);
 } else if(page==="import"){
  c.innerHTML=`<div class="import-layout"><article class="panel upload-panel"><div class="upload-symbol">⇧</div><h2>นำเข้าบิลจากเอกสาร</h2><p>เลือกไฟล์ Excel, CSV, JSON, PDF หรือภาพถ่ายบิล ระบบจะอ่านข้อมูลและเปิดให้ตรวจสอบก่อนบันทึก</p><label class="btn primary file-button">เลือกไฟล์<input type="file" id="file-import" accept=".xlsx,.xls,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp,.bmp" multiple></label><div class="format-list"><span>XLSX / XLS</span><span>CSV</span><span>PDF</span><span>JPG / PNG</span><span>JSON</span></div></article><article class="panel"><h3>หลักการนำเข้าที่ปลอดภัย</h3><div class="check-item">01 <span>ไม่บันทึกข้อมูลอัตโนมัติ ต้องตรวจทานก่อน</span></div><div class="check-item">02 <span>แยกชื่อผู้ขายและผู้ซื้อคนละช่อง</span></div><div class="check-item">03 <span>แจ้งเตือนเลขบิลซ้ำจากผู้ขายเดียวกัน</span></div><div class="check-item">04 <span>ข้อมูล OCR ที่อ่านไม่ชัดต้องแก้ไขเองได้</span></div></article></div><article class="panel note-panel"><b>ข้อควรรู้เรื่อง OCR</b><p>การอ่านภาพเป็นการช่วยดึงข้อมูลเบื้องต้น โดยเฉพาะภาพเอียง ภาพมืด หรือใบเสร็จซ้อนกัน อาจอ่านผิดได้ ควรตรวจสอบยอดเงิน เลขประจำตัวผู้เสียภาษี และเลขที่บิลก่อนบันทึกทุกครั้ง</p></article>`;
 } else if(page==="backup"){
  c.innerHTML=`<div class="backup-grid"><article class="panel"><div class="backup-icon">↓</div><h3>สำรองข้อมูลทั้งหมด</h3><p>ดาวน์โหลดบิลทั้งหมดเป็นไฟล์ JSON เก็บไว้ในคอมพิวเตอร์หรือพื้นที่ปลอดภัย</p><button class="btn primary" id="backup-json">ดาวน์โหลดข้อมูลสำรอง</button></article><article class="panel"><div class="backup-icon">↑</div><h3>กู้คืน / นำเข้าข้อมูล</h3><p>เลือกไฟล์ JSON ที่เคยสำรองไว้ ระบบจะรวมข้อมูลโดยไม่เขียนทับรายการเดิมที่มีอยู่</p><label class="btn ghost file-button">เลือกไฟล์สำรอง<input type="file" id="restore-json" accept=".json"></label></article></div><div class="storage-note"><b>การจัดเก็บข้อมูล</b><span>ข้อมูลเก็บในเบราว์เซอร์หรืออุปกรณ์นี้ด้วย IndexedDB ไม่ได้อัปโหลดไปเซิร์ฟเวอร์ หากล้างข้อมูลแอปหรือเปลี่ยนอุปกรณ์ ต้องสำรองและนำเข้าไฟล์เพื่อย้ายข้อมูล</span></div>`;
 }
}
function receiptTable(rows){return `<div class="table-wrap"><table><thead><tr><th>เลขที่บิล / วันที่</th><th>ผู้ขาย</th><th>ผู้ซื้อ</th><th>ทะเบียนรถ</th><th class="num">ยอดสุทธิ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${rows.length?tableRows(rows):`<tr><td colspan="7" class="empty">ยังไม่มีรายการบิล</td></tr>`}</tbody></table></div>`;}
function miniChart(rows){
 const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10);});
 const vals=days.map(day=>rows.filter(r=>r.date===day&&!r.cancelled).reduce((s,r)=>s+Number(r.total_amount||0),0));const max=Math.max(...vals,1);
 return `<div class="bars">${vals.map((v,i)=>`<div class="bar-col"><div class="bar-value">${v?money(v):"—"}</div><div class="bar-track"><div class="bar-fill" style="height:${Math.max(3,v/max*100)}%"></div></div><small>${new Date(days[i]+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"short"})}</small></div>`).join("")}</div>`;
}
function reportHTML(from,to){
 if(!from||!to||from>to)return `<div class="empty">กรุณาตรวจสอบช่วงวันที่</div>`;
 const s=summarize(receipts,from,to);
 const vehicle=Object.entries(s.byVehicle).sort((a,b)=>b[1]-a[1]);const seller=Object.entries(s.bySeller).sort((a,b)=>b[1]-a[1]);
 return `<div class="kpi-grid">${kpi("ยอดใช้จ่ายรวม",money(s.total),"บาท","฿")}${kpi("จำนวนบิล",s.count,"ใบ","▤")}${kpi("ปริมาณน้ำมัน",number(s.liters),"ลิตร","⌁")}${kpi("VAT รวม",money(s.vat),"บาท","%")}</div><div class="split-grid"><article class="panel"><h3>แยกตามทะเบียนรถ</h3>${rankTable(vehicle)}</article><article class="panel"><h3>แยกตามสถานีบริการ / ผู้ขาย</h3>${rankTable(seller)}</article></div><div class="report-foot">ช่วงข้อมูล ${from} ถึง ${to} • ยอดไม่รวมบิลที่ยกเลิก</div>`;
}
function rankTable(rows){return rows.length?`<div class="rank-list">${rows.map(([k,v],i)=>`<div class="rank-row"><span class="rank">${String(i+1).padStart(2,"0")}</span><span>${escapeHTML(k)}</span><b>${money(v)} ฿</b></div>`).join("")}</div>`:`<div class="empty">ไม่มีข้อมูลในช่วงเวลานี้</div>`;}
function openForm(row=null){
 editingId=row?.id||null;const f=$("#receipt-form");f.reset();$("#form-errors").textContent="";
 $("#dialog-title").textContent=row?"แก้ไขรายการบิล":"เพิ่มรายการบิล";
 const defaults={date:today(),quantity:0,unit_price:0,subtotal:0,vat:0,discount:0,total_amount:0,payment_method:"QR / เงินสด"};
 for(const [k,v] of Object.entries({...defaults,...row}))if(f.elements[k])f.elements[k].value=v??"";
 $("#receipt-dialog").showModal();
}
async function saveForm(e){
 e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());
 const row={...data,id:editingId||uid(),quantity:Number(data.quantity||0),unit_price:Number(data.unit_price||0),subtotal:Number(data.subtotal||0),vat:Number(data.vat||0),discount:Number(data.discount||0),total_amount:Number(data.total_amount||0),items:data.item_name?[{name:data.item_name,quantity:Number(data.quantity||0),unit_price:Number(data.unit_price||0),total:Number(data.total_amount||0)}]:[],cancelled:false};
 const errors=validateReceipt(row,receipts);if(errors.length){$("#form-errors").textContent=errors.join(" • ");return;}
 await put(row);$("#receipt-dialog").close();await refresh();setPage(document.querySelector(".nav.active")?.dataset.page||"overview");
}
function download(name,content,type){const a=document.createElement("a");const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
async function refresh(){receipts=await getAll();}
async function handleImport(file){
 try{
  const {rows,text}=await importFile(file);
  if(text){
   const parsed=parseReceiptText(text);importDraft=[{id:uid(),...parsed, seller_name:"",buyer_name:"",items:[],quantity:Number(parsed.quantity||0),subtotal:parsed.subtotal||0,vat:parsed.vat||0,discount:0,total_amount:parsed.total_amount||0,source_text:text}];
  }else importDraft=rows;
  showImportPreview();
 }catch(e){alert("นำเข้าไม่สำเร็จ: "+e.message);}
}
function showImportPreview(){
 const d=$("#import-dialog");$("#import-preview").innerHTML=`<p class="muted-text">พบ ${importDraft.length} รายการ • กรุณาตรวจสอบข้อมูลก่อนบันทึก</p>${importDraft.map((r,i)=>`<div class="preview-row"><label><input type="checkbox" checked data-import="${i}"> ${escapeHTML(r.receipt_id||"ไม่มีเลขบิล")} — ${escapeHTML(r.seller_name||"ยังไม่ทราบผู้ขาย")}</label><small>${escapeHTML(r.date||"ไม่พบวันที่")} • ${money(r.total_amount)} บาท</small><div class="preview-warning">${!r.seller_name||!r.buyer_name?"ต้องกรอกชื่อผู้ขายและผู้ซื้อก่อนบันทึก":""}</div></div>`).join("")}`;
 d.showModal();
}
async function commitImport(){
 const selected=[...document.querySelectorAll("[data-import]:checked")].map(x=>importDraft[Number(x.dataset.import)]);
 let saved=0, skipped=0;
 for(const r of selected){const row={...r,id:r.id||uid(),items:r.items||[],quantity:Number(r.quantity||0),subtotal:Number(r.subtotal||0),vat:Number(r.vat||0),discount:Number(r.discount||0),total_amount:Number(r.total_amount||0),cancelled:false};
  if(!row.seller_name||!row.buyer_name||!row.receipt_id||!row.date){skipped++;continue;}
  if(validateReceipt(row,receipts).length){skipped++;continue;}
  await put(row);receipts.push(row);saved++;
 }
 $("#import-dialog").close();alert(`บันทึก ${saved} รายการ${skipped?` • ข้าม ${skipped} รายการที่ข้อมูลไม่ครบหรือซ้ำ`:""}`);await refresh();setPage("receipts");
}
shell();
document.addEventListener("click",async e=>{
 const nav=e.target.closest(".nav");if(nav)setPage(nav.dataset.page);
 if(e.target.closest("#quick-add")||e.target.closest("#add-from-list"))openForm();
 if(e.target.closest("#close-dialog")||e.target.closest("#cancel-dialog"))$("#receipt-dialog").close();
 if(e.target.closest("#close-import")||e.target.closest("#cancel-import"))$("#import-dialog").close();
 if(e.target.closest("#save-import"))await commitImport();
 const edit=e.target.closest("[data-edit]");if(edit)openForm(receipts.find(r=>r.id===edit.dataset.edit));
 const del=e.target.closest("[data-delete]");if(del&&confirm("ยืนยันลบบิลนี้?")){await remove(del.dataset.delete);await refresh();render("receipts");}
 const goto=e.target.closest("[data-goto]");if(goto)setPage(goto.dataset.goto);
 if(e.target.closest("#backup-json"))download(`oilbill-backup-${today()}.json`,JSON.stringify({version:3,exported_at:new Date().toISOString(),receipts},null,2),"application/json");
 if(e.target.closest("#export-csv")){const cols=["receipt_id","date","seller_name","seller_tax_id","buyer_name","buyer_tax_id","vehicle_plate","subtotal","vat","discount","total_amount","payment_method"];const csv=[cols.join(","),...receipts.map(r=>cols.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");download("oilbill-receipts.csv","\ufeff"+csv,"text/csv;charset=utf-8");}
});
$("#receipt-form").addEventListener("submit",saveForm);
document.addEventListener("change",async e=>{
 if(e.target.id==="file-import"){for(const f of e.target.files)await handleImport(f);e.target.value="";}
 if(e.target.id==="restore-json"){try{const raw=JSON.parse(await e.target.files[0].text());const rows=raw.receipts||raw;let added=0;for(const r of rows){if(!receipts.some(x=>x.receipt_id===r.receipt_id&&x.seller_name===r.seller_name)){const row={...r,id:uid()};await put(row);added++;}}await refresh();alert(`นำเข้าข้อมูล ${added} รายการ`);}catch(err){alert("ไฟล์สำรองไม่ถูกต้อง: "+err.message);}e.target.value="";}
});
await refresh();setPage("overview");