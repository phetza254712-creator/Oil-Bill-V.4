# OilBill V3

ระบบจัดการบิลน้ำมันและค่าใช้จ่ายสำหรับ Windows และ Android ใช้ส่วนติดต่อชุดเดียวกัน

## ความสามารถ
- Dashboard แสดงยอดวันนี้ / สัปดาห์นี้ / เดือนนี้ / ปีนี้
- รายงานกำหนดช่วงวันที่ พร้อมแยกยอดตามทะเบียนรถและสถานีบริการ
- เพิ่ม แก้ไข ลบ ค้นหารายการบิล
- ตรวจเลขที่บิลซ้ำเมื่อเป็นผู้ขายรายเดียวกัน และตรวจยอดก่อนภาษี + VAT - ส่วนลด
- นำเข้า XLSX, XLS, CSV, JSON, PDF และภาพ JPG/PNG/WEBP
- OCR ภาษาไทยและอังกฤษ พร้อมหน้าตรวจสอบก่อนบันทึก
- ส่งออก CSV และสำรอง/กู้คืน JSON
- ใช้ IndexedDB เก็บข้อมูลในอุปกรณ์ ไม่ส่งข้อมูลไปเซิร์ฟเวอร์โดยอัตโนมัติ

## เริ่มต้นบนเครื่องพัฒนา
ต้องติดตั้ง Node.js 22 และ npm

```bash
npm install
npm test
npm run build
npm run dev
```

## สร้าง Windows
```bash
npm install
npm run build
npm run desktop:build
```
ไฟล์อยู่ใน `release/` (NSIS installer และ portable)

## สร้าง Android ในเครื่อง
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
จาก Android Studio เลือก Build > Build Bundle(s) / APK(s) > Build APK(s)

## GitHub Actions
1. สร้าง Repository ใหม่และอัปโหลดไฟล์ทั้งหมดใน ZIP นี้ไปที่ branch `main`
2. เปิดแท็บ Actions และเปิดใช้งาน workflow หาก GitHub ขออนุญาต
3. เลือก `Build OilBill V3 for Windows` หรือ `Build OilBill V3 Android APK` แล้วกด Run workflow
4. เมื่อเสร็จ ดาวน์โหลดไฟล์จาก Artifacts ของ workflow run
   - Windows: `OilBill-V3-Windows`
   - Android: `OilBill-V3-Android-APK`

## ข้อจำกัดที่ต้องทราบ
- OCR เป็นการดึงข้อมูลเบื้องต้นจากข้อความที่อ่านได้ ไม่รับประกันความถูกต้องทุกช่อง โดยเฉพาะภาพเอียง/เบลอ/เอกสารซ้อน ต้องตรวจทานก่อนบันทึก
- PDF ที่เป็นภาพสแกนจะต้องใช้ OCR เพิ่มเติม; รุ่นนี้อ่านข้อความที่ฝังอยู่ใน PDF ได้โดยตรง แต่ยังไม่แปลงหน้า PDF แบบภาพเป็น OCR
- ข้อมูลอยู่ในอุปกรณ์นั้น ๆ ยังไม่มีระบบซิงก์ PC ↔ Android หรือบัญชีผู้ใช้
- การนำเข้า Excel ใช้ชื่อหัวคอลัมน์ที่รู้จักเป็นหลัก หากไฟล์มีหัวคอลัมน์เฉพาะองค์กรควรจัดคอลัมน์ให้ตรงก่อน
- Android APK ใน workflow เป็น debug APK สำหรับทดสอบภายใน ไม่ใช่ signed release สำหรับ Play Store
