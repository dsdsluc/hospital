import { resolve } from 'node:path';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BloodType,
  FloorStatus,
  Gender,
  MedicineCategoryStatus,
  MedicineStatus,
  PrismaClient,
  RoomStatus,
  UserRole,
} from '../src/generated/prisma/client.js';
import { MEDICINE_CATEGORIES, MEDICINES } from './data/medicine-catalog.js';

dotenv.config({ path: resolve(process.cwd(), 'src/.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Không tìm thấy DATABASE_URL trong file src/.env');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function upsertUser(email: string, role: UserRole, passwordHash: string) {
  const existingUser = await prisma.user.findFirst({ where: { email } });

  if (existingUser) {
    return prisma.user.update({
      where: { id: existingUser.id },
      data: { password_hash: passwordHash, role },
    });
  }

  return prisma.user.create({
    data: { email, password_hash: passwordHash, role },
  });
}

async function seedMedicines(): Promise<void> {
  const categories = MEDICINE_CATEGORIES;

  const categoryIds = new Map<string, string>();

  for (const category of categories) {
    const savedCategory = await prisma.medicineCategory.upsert({
      where: { category_code: category.code },
      update: {
        name: category.name,
        description: category.description,
        status: MedicineCategoryStatus.ACTIVE,
      },
      create: {
        category_code: category.code,
        name: category.name,
        description: category.description,
        status: MedicineCategoryStatus.ACTIVE,
      },
    });

    categoryIds.set(category.code, savedCategory.id);
  }

  const medicines = MEDICINES;

  for (const medicine of medicines) {
    const savedMedicine = await prisma.medicine.upsert({
      where: { medicine_code: medicine.code },
      update: {
        name: medicine.name,
        unit: medicine.unit,
        stock_quantity: medicine.stock,
        status: MedicineStatus.AVAILABLE,
      },
      create: {
        medicine_code: medicine.code,
        name: medicine.name,
        unit: medicine.unit,
        stock_quantity: medicine.stock,
        status: MedicineStatus.AVAILABLE,
      },
    });

    for (const categoryCode of medicine.categories) {
      const categoryId = categoryIds.get(categoryCode);

      if (!categoryId) {
        throw new Error(`Không tìm thấy danh mục ${categoryCode}.`);
      }

      await prisma.medicineCategoryAssignment.upsert({
        where: {
          medicine_id_category_id: {
            medicine_id: savedMedicine.id,
            category_id: categoryId,
          },
        },
        update: {},
        create: {
          medicine_id: savedMedicine.id,
          category_id: categoryId,
        },
      });
    }
  }
}

async function seedHospitalRooms(doctorId: string): Promise<void> {
  const floorFunctions = [
    { code: 'RECEPTION_EMERGENCY', name: 'Tiếp nhận và cấp cứu' },
    { code: 'OUTPATIENT_EXAMINATION', name: 'Khám bệnh ngoại trú' },
    { code: 'DIAGNOSTIC_IMAGING', name: 'Chẩn đoán và xét nghiệm' },
    { code: 'INPATIENT_TREATMENT', name: 'Điều trị và theo dõi' },
    { code: 'SURGERY_RECOVERY', name: 'Phẫu thuật và hồi sức' },
  ];
  const floorFunctionIds = new Map<string, string>();

  for (const item of floorFunctions) {
    const saved = await prisma.floorFunction.upsert({
      where: { function_code: item.code },
      update: { name: item.name },
      create: { function_code: item.code, name: item.name },
    });
    floorFunctionIds.set(item.code, saved.id);
  }

  const floors = [
    { code: 'FLOOR-01', number: 1, name: 'Tầng 1 - Tiếp nhận và cấp cứu', functionCode: 'RECEPTION_EMERGENCY' },
    { code: 'FLOOR-02', number: 2, name: 'Tầng 2 - Khám bệnh ngoại trú', functionCode: 'OUTPATIENT_EXAMINATION' },
    { code: 'FLOOR-03', number: 3, name: 'Tầng 3 - Chẩn đoán và xét nghiệm', functionCode: 'DIAGNOSTIC_IMAGING' },
    { code: 'FLOOR-04', number: 4, name: 'Tầng 4 - Điều trị và theo dõi', functionCode: 'INPATIENT_TREATMENT' },
    { code: 'FLOOR-05', number: 5, name: 'Tầng 5 - Phẫu thuật và hồi sức', functionCode: 'SURGERY_RECOVERY' },
  ];
  const floorIds = new Map<number, string>();

  for (const floor of floors) {
    const functionId = floorFunctionIds.get(floor.functionCode);
    if (!functionId) throw new Error(`Không tìm thấy chức năng tầng ${floor.functionCode}.`);

    const saved = await prisma.floor.upsert({
      where: { floor_code: floor.code },
      update: {
        floor_number: floor.number,
        name: floor.name,
        function_id: functionId,
        status: FloorStatus.ACTIVE,
      },
      create: {
        floor_code: floor.code,
        floor_number: floor.number,
        name: floor.name,
        function_id: functionId,
        status: FloorStatus.ACTIVE,
      },
    });
    floorIds.set(floor.number, saved.id);
  }

  const roomFunctions = [
    ['RECEPTION', 'Tiếp nhận'], ['EMERGENCY', 'Cấp cứu'],
    ['TRIAGE', 'Phân loại bệnh'], ['CASHIER', 'Thu ngân'], ['SAMPLE_COLLECTION', 'Lấy mẫu xét nghiệm'],
    ['PHARMACY', 'Nhà thuốc'], ['GENERAL_EXAMINATION', 'Khám tổng quát'],
    ['INTERNAL_MEDICINE', 'Khám nội khoa'], ['PEDIATRICS', 'Khám nhi'],
    ['ENT', 'Tai mũi họng'], ['DERMATOLOGY', 'Da liễu'],
    ['ULTRASOUND', 'Siêu âm'], ['X_RAY', 'X-quang'], ['CT_SCAN', 'Chụp CT'],
    ['BLOOD_TEST', 'Xét nghiệm máu'], ['ECG', 'Điện tim'],
    ['INPATIENT', 'Điều trị nội trú'], ['OBSERVATION', 'Theo dõi'],
    ['ISOLATION', 'Cách ly'], ['NURSING', 'Trực điều dưỡng'],
    ['SURGERY', 'Phẫu thuật'], ['PREOPERATIVE', 'Chuẩn bị phẫu thuật'],
    ['RECOVERY', 'Hồi tỉnh'], ['ICU', 'Hồi sức tích cực'],
  ] as const;
  const roomFunctionIds = new Map<string, string>();

  for (const [code, name] of roomFunctions) {
    const saved = await prisma.roomFunction.upsert({
      where: { function_code: code },
      update: { name },
      create: { function_code: code, name },
    });
    roomFunctionIds.set(code, saved.id);
  }

  const rooms = [
    ['REC-101', 'Phòng tiếp nhận', 1, 'RECEPTION'],
    ['ER-102', 'Phòng cấp cứu', 1, 'EMERGENCY'],
    // TRI-103 (phân loại bệnh, chưa dùng) đã đổi thành quầy thu ngân.
    ['CAS-103', 'Quầy thu ngân', 1, 'CASHIER'],
    ['LAB-104', 'Phòng lấy mẫu xét nghiệm', 1, 'SAMPLE_COLLECTION'],
    ['PHM-105', 'Nhà thuốc', 1, 'PHARMACY'],
    ['GEN-201', 'Phòng khám tổng quát 1', 2, 'GENERAL_EXAMINATION'],
    ['GEN-202', 'Phòng khám tổng quát 2', 2, 'GENERAL_EXAMINATION'],
    ['INT-203', 'Phòng khám nội khoa', 2, 'INTERNAL_MEDICINE'],
    ['PED-204', 'Phòng khám nhi', 2, 'PEDIATRICS'],
    ['ENT-205', 'Phòng tai mũi họng', 2, 'ENT'],
    ['DER-206', 'Phòng da liễu', 2, 'DERMATOLOGY'],
    ['US-301', 'Phòng siêu âm 1', 3, 'ULTRASOUND'],
    ['US-302', 'Phòng siêu âm 2', 3, 'ULTRASOUND'],
    ['XR-303', 'Phòng X-quang', 3, 'X_RAY'],
    ['CT-304', 'Phòng CT', 3, 'CT_SCAN'],
    ['LAB-305', 'Phòng xét nghiệm máu', 3, 'BLOOD_TEST'],
    ['ECG-306', 'Phòng điện tim', 3, 'ECG'],
    ['IP-401', 'Phòng bệnh 1', 4, 'INPATIENT'],
    ['IP-402', 'Phòng bệnh 2', 4, 'INPATIENT'],
    ['OBS-403', 'Phòng theo dõi', 4, 'OBSERVATION'],
    ['ISO-404', 'Phòng cách ly', 4, 'ISOLATION'],
    ['NUR-405', 'Phòng trực điều dưỡng', 4, 'NURSING'],
    ['OR-501', 'Phòng phẫu thuật 1', 5, 'SURGERY'],
    ['OR-502', 'Phòng phẫu thuật 2', 5, 'SURGERY'],
    ['PRE-503', 'Phòng chuẩn bị phẫu thuật', 5, 'PREOPERATIVE'],
    ['REC-504', 'Phòng hồi tỉnh', 5, 'RECOVERY'],
    ['ICU-505', 'Phòng hồi sức tích cực', 5, 'ICU'],
  ] as const;

  for (const [code, name, floorNumber, functionCode] of rooms) {
    const floorId = floorIds.get(floorNumber);
    const functionId = roomFunctionIds.get(functionCode);
    if (!floorId || !functionId) throw new Error(`Thiếu dữ liệu tham chiếu cho phòng ${code}.`);

    await prisma.room.upsert({
      where: { room_code: code },
      update: {
        name,
        floor_id: floorId,
        function_id: functionId,
        status: RoomStatus.AVAILABLE,
        ...(code === 'GEN-201' && { doctor_id: doctorId }),
      },
      create: {
        room_code: code,
        name,
        floor_id: floorId,
        function_id: functionId,
        status: RoomStatus.AVAILABLE,
        doctor_id: code === 'GEN-201' ? doctorId : null,
      },
    });
  }
}

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash('123456', 12);

  const patientUser = await upsertUser(
    'patient@gmail.com',
    UserRole.PATIENT,
    passwordHash,
  );
  const doctorUser = await upsertUser(
    'doctor@gmail.com',
    UserRole.DOCTOR,
    passwordHash,
  );

  await prisma.patient.upsert({
    where: { user_id: patientUser.id },
    update: {
      weight_kg: 65,
      height_cm: 170,
    },
    create: {
      user_id: patientUser.id,
      patient_code: 'PAT-000001',
      full_name: 'Patient Demo',
      date_of_birth: new Date('1995-01-01'),
      gender: Gender.MALE,
      blood_type: BloodType.O_POSITIVE,
      identity_number: 'PATIENT-DEMO-001',
      address: 'Chưa cập nhật',
      weight_kg: 65,
      height_cm: 170,
    },
  });

  const doctorProfile = await prisma.doctor.upsert({
    where: { user_id: doctorUser.id },
    update: {},
    create: {
      user_id: doctorUser.id,
      doctor_code: 'DOC-000001',
      full_name: 'Doctor Demo',
      date_of_birth: new Date('1985-01-01'),
      gender: Gender.MALE,
      specialization: 'Đa khoa',
      years_of_experience: 5,
    },
  });

  await seedMedicines();
  await seedHospitalRooms(doctorProfile.id);

  console.log('Đã tạo dữ liệu mẫu cho tài khoản, thuốc, tầng và phòng bệnh viện.');
}

seed()
  .catch((error: unknown) => {
    console.error('Seed database thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
