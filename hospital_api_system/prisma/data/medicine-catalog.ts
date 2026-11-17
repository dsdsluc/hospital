/**
 * Danh mục nhóm thuốc và thuốc dùng chung cho các script seed
 * (prisma/seed.ts và prisma/seed-medicine-catalog.ts).
 */
export const MEDICINE_CATEGORIES = [
  { code: 'COLD_MEDICINE', name: 'Thuốc cảm', description: 'Thuốc hỗ trợ điều trị các triệu chứng cảm thông thường.' },
  { code: 'PAIN_RELIEF', name: 'Thuốc giảm đau', description: 'Thuốc hỗ trợ giảm đau.' },
  { code: 'HEADACHE', name: 'Thuốc đau đầu', description: 'Thuốc thường dùng khi có triệu chứng đau đầu.' },
  { code: 'FEVER_REDUCER', name: 'Thuốc hạ sốt', description: 'Thuốc hỗ trợ hạ sốt.' },
  { code: 'ALLERGY', name: 'Thuốc dị ứng', description: 'Thuốc hỗ trợ điều trị các triệu chứng dị ứng.' },
  { code: 'DIGESTIVE', name: 'Thuốc tiêu hóa', description: 'Thuốc hỗ trợ điều trị các vấn đề tiêu hóa.' },
  { code: 'ANTIBIOTIC', name: 'Thuốc kháng sinh', description: 'Thuốc kháng sinh chỉ sử dụng theo chỉ định của bác sĩ.' },
  { code: 'INSURANCE_COVERED', name: 'Thuốc bảo hiểm y tế', description: 'Nhóm thuốc được đánh dấu thuộc phạm vi bảo hiểm y tế trong dữ liệu mẫu.' },
];

/** stock = tồn kho ban đầu khi tạo mới. */
export const MEDICINES = [
  { code: 'MED-0001', name: 'Paracetamol 500mg', unit: 'Viên', stock: 500, categories: ['PAIN_RELIEF', 'HEADACHE', 'FEVER_REDUCER', 'INSURANCE_COVERED'] },
  { code: 'MED-0002', name: 'Ibuprofen 400mg', unit: 'Viên', stock: 300, categories: ['PAIN_RELIEF', 'HEADACHE', 'FEVER_REDUCER'] },
  { code: 'MED-0003', name: 'Chlorpheniramine 4mg', unit: 'Viên', stock: 250, categories: ['COLD_MEDICINE', 'ALLERGY', 'INSURANCE_COVERED'] },
  { code: 'MED-0004', name: 'Loratadine 10mg', unit: 'Viên', stock: 200, categories: ['ALLERGY'] },
  { code: 'MED-0005', name: 'Omeprazole 20mg', unit: 'Viên', stock: 250, categories: ['DIGESTIVE', 'INSURANCE_COVERED'] },
  { code: 'MED-0006', name: 'Oresol ORS', unit: 'Gói', stock: 150, categories: ['DIGESTIVE', 'INSURANCE_COVERED'] },
  { code: 'MED-0007', name: 'Amoxicillin 500mg', unit: 'Viên', stock: 200, categories: ['ANTIBIOTIC', 'INSURANCE_COVERED'] },
  { code: 'MED-0008', name: 'Azithromycin 500mg', unit: 'Viên', stock: 100, categories: ['ANTIBIOTIC'] },
  { code: 'MED-0009', name: 'Dextromethorphan 15mg', unit: 'Viên', stock: 180, categories: ['COLD_MEDICINE'] },
  { code: 'MED-0010', name: 'Acetylcysteine 200mg', unit: 'Gói', stock: 160, categories: ['COLD_MEDICINE'] },
  { code: 'MED-0011', name: 'Cetirizine 10mg', unit: 'Viên', stock: 200, categories: ['ALLERGY', 'INSURANCE_COVERED'] },
  { code: 'MED-0012', name: 'Domperidone 10mg', unit: 'Viên', stock: 180, categories: ['DIGESTIVE'] },
  { code: 'MED-0013', name: 'Diosmectite 3g (Smecta)', unit: 'Gói', stock: 150, categories: ['DIGESTIVE', 'INSURANCE_COVERED'] },
  { code: 'MED-0014', name: 'Cefuroxime 500mg', unit: 'Viên', stock: 120, categories: ['ANTIBIOTIC'] },
  { code: 'MED-0015', name: 'Ciprofloxacin 500mg', unit: 'Viên', stock: 120, categories: ['ANTIBIOTIC', 'INSURANCE_COVERED'] },
  { code: 'MED-0016', name: 'Paracetamol 500mg sủi', unit: 'Viên', stock: 200, categories: ['PAIN_RELIEF', 'FEVER_REDUCER'] },
  { code: 'MED-0017', name: 'Diclofenac 50mg', unit: 'Viên', stock: 200, categories: ['PAIN_RELIEF'] },
  { code: 'MED-0018', name: 'Ambroxol 30mg', unit: 'Viên', stock: 180, categories: ['COLD_MEDICINE'] },
  { code: 'MED-0019', name: 'Fexofenadine 180mg', unit: 'Viên', stock: 100, categories: ['ALLERGY'] },
  { code: 'MED-0020', name: 'Esomeprazole 40mg', unit: 'Viên', stock: 120, categories: ['DIGESTIVE'] },
];
