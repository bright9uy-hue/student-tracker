# إعداد نظام التراخيص (Supabase)

هذا الدليل خطوات تفعيل نظام الترخيص المدفوع بعد دمج الكود. الكود جاهز بالكامل؛
الخطوات هنا كلها إعداد حساب/مشروع خارجي لا يمكن أداؤه من الكود نفسه.

## 1. إنشاء مشروع Supabase
- أنشئ حساباً/مشروعاً جديداً على supabase.com (الباقة المجانية تكفي البداية).
- من إعدادات المشروع، انسخ:
  - **Project URL** (مثال: `https://xxxxx.supabase.co`)

## 2. تطبيق جدول قاعدة البيانات
افتح **SQL Editor** في لوحة تحكم Supabase، وألصق محتوى الملف
`supabase/migrations/0001_licenses.sql` بالكامل، ثم نفّذه.

## 3. نشر الدالة السحابية (Edge Function)
إذا كان لديك Supabase CLI مُثبّتاً محلياً:
```
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy verify-license
```
(`config.toml` في هذا المجلد يضبط `verify_jwt = false` تلقائياً، أي لا حاجة
لأي مفتاح Authorization عند استدعائها من التطبيق.)

بدون CLI، يمكن لصق محتوى `supabase/functions/verify-license/index.ts` مباشرة
عبر واجهة Supabase على الويب (Edge Functions -> Create a new function).

## 4. ضبط السر (Secret) الخاص بالتوقيع
الدالة تحتاج مفتاحاً خاصاً (Ed25519) لتوقيع تصاريح التشغيل. **هذا المفتاح لا
يُكتب في أي ملف بالمستودع أبداً** - تم توليده وتسليمه لك بشكل منفصل خارج الكود.
اضبطه كسرّ في مشروع Supabase:
```
supabase secrets set LICENSE_SIGNING_KEY=<القيمة السرية التي استلمتها>
```
(أو من لوحة تحكم Supabase: Edge Functions -> Secrets)

المفتاح **العام** المطابق له مضمّن مسبقاً كقيمة افتراضية داخل `licensing.js`
(`LICENSE_PUBLIC_KEY_HEX`) - لا حاجة لأي إعداد إضافي على هذا الطرف، وهو آمن أن
يبقى ظاهراً في الكود (مفتاح عام، لا يستطيع توقيع أي شيء، فقط التحقق).

## 5. ربط التطبيق بالدالة
بعد النشر، ستحصل على رابط الدالة بالشكل:
```
https://<project-ref>.supabase.co/functions/v1/verify-license
```
اضبط هذا الرابط كمتغيّر بيئة `LICENSE_VERIFY_URL` قبل تشغيل `server.js`
(أو أضِفه إلى طريقة تشغيل البرنامج الحالية - ملف `.bat`/تشغيل Electron).
مثال على ويندوز (داخل ملف `.bat`):
```bat
set LICENSE_VERIFY_URL=https://<project-ref>.supabase.co/functions/v1/verify-license
node server.js
```

## 6. إصدار أول مفتاح ترخيص (اختبار)
طبّق أيضاً `supabase/migrations/0002_generate_license_key.sql` (نفس طريقة
الخطوة 2) - يضيف دالة `generate_license_key()` تولّد كوداً عشوائياً
سهل القراءة (مثل `K7M2-QX9F-2ATB`)، بدون أرقام/حروف متشابهة الشكل (0/O، 1/I).

من SQL Editor في Supabase:
```sql
insert into public.licenses (key, owner_name, expires_at)
values (generate_license_key(), 'اسم المعلم هنا', now() + interval '1 year')
returning key;
```
`returning key` يعرض لك الكود المُولَّد مباشرة بعد التنفيذ لتنسخه وترسله
للمشتري. هذا هو **المفتاح الرئيسي**. لإصدار مفتاح فرعي لنفس المشتري (جهاز
إضافي):
```sql
insert into public.licenses (key, parent_key, owner_name, expires_at)
values (generate_license_key(), 'ABC123-XXXX', 'اسم المعلم هنا', now() + interval '1 year')
returning key;
```
(ضع مكان `'ABC123-XXXX'` قيمة المفتاح الرئيسي الفعلية اللي ولّدتها بالخطوة
السابقة. الاسم يُكرَّر يدوياً في كل صف حالياً - أبسط ما يمكن للبداية، دون
تعقيد إضافي لربط الاسم تلقائياً بين المفتاح الرئيسي والفرعي.)

## 7. اختبار سريع
```
curl -X POST https://<project-ref>.supabase.co/functions/v1/verify-license \
  -H "Content-Type: application/json" \
  -d '{"key":"ABC123-XXXX"}'
```
استجابة ناجحة تُرجع `{"payload": "...", "signature": "..."}`.

## الشراء لاحقاً
عند وصول عملية شراء جديدة (عبر رابط دفع Moyasar/Tap مثلاً): نفّذ استعلام
`insert` مشابه للأعلى بمفتاح جديد، ثم أرسل المفتاح للمشتري.
