# hospital

Hệ thống quản lý bệnh viện gồm 3 phần:

- `hospital_api_system` – API (Express, Prisma, PostgreSQL/Neon)
- `hospital_web_system` – Web cho bác sĩ / nhân viên và bệnh nhân (Next.js)
- `hospital_app_flutter` – Ứng dụng di động cho bệnh nhân (Flutter)

## Chạy dự án

### API
```bash
cd hospital_api_system
npm install
# tạo file src/.env với DATABASE_URL và JWT_SECRET
npx prisma generate
npm run dev        # cổng 4000
```

### Web
```bash
cd hospital_web_system
npm install
# tạo file .env với NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev
```

### Flutter
```bash
cd hospital_app_flutter
cp .env.example .env   # API_BASE_URL=http://10.0.2.2:4000/api cho Android emulator
flutter pub get
flutter run
```

Tài liệu mô tả chức năng: `patient.txt`, `doctor.txt`, `overview.docx`.
