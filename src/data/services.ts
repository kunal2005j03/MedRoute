import type { HealthcareCategory, MedicalService, StartingLocation } from '../types/medroute';

export const HEALTHCARE_CATEGORIES: HealthcareCategory[] = [
  'Consultation',
  'Diagnostics',
  'Treatment',
];

export const MEDICAL_SERVICES: MedicalService[] = [
  // Consultation
  {
    id: 'consult-general-medicine',
    name: 'General Medicine Consultation',
    category: 'Consultation',
    description: 'Outpatient physician consultation for internal medicine and general clinical evaluation.',
    liveSearchKeyword: 'multi specialty hospital general medicine clinic',
  },
  {
    id: 'consult-cardiology',
    name: 'Cardiology Consultation',
    category: 'Consultation',
    description: 'Specialist heart consultation for chest pain, hypertension, and cardiac risk assessment.',
    liveSearchKeyword: 'cardiology hospital heart specialist clinic',
  },
  {
    id: 'consult-orthopedics',
    name: 'Orthopedic Consultation',
    category: 'Consultation',
    description: 'Specialist consultation for joint pain, fractures, spine, and musculoskeletal care.',
    liveSearchKeyword: 'orthopedic hospital bone and joint clinic',
  },
  {
    id: 'consult-neurology',
    name: 'Neurology Consultation',
    category: 'Consultation',
    description: 'Neurologist outpatient evaluation for migraine, seizures, stroke follow-up, and nerve disorders.',
    liveSearchKeyword: 'neurology hospital brain and spine specialist',
  },
  {
    id: 'consult-gynecology',
    name: 'Obstetrics & Gynecology Consultation',
    category: 'Consultation',
    description: 'Outpatient women’s health, prenatal checkup, and gynecological specialist visit.',
    liveSearchKeyword: 'maternity hospital gynecology clinic',
  },

  // Diagnostics
  {
    id: 'diag-mri-brain',
    name: 'Brain MRI Scan (Plain)',
    category: 'Diagnostics',
    description: 'Non-contrast Magnetic Resonance Imaging of the brain at an imaging or hospital diagnostic unit.',
    liveSearchKeyword: 'MRI diagnostic centre radiology hospital',
  },
  {
    id: 'diag-ct-chest',
    name: 'Chest CT Scan (HRCT)',
    category: 'Diagnostics',
    description: 'High-resolution computed tomography scan of the chest and lungs.',
    liveSearchKeyword: 'CT scan diagnostic centre imaging hospital',
  },
  {
    id: 'diag-echo-2d',
    name: '2D Echocardiography with Doppler',
    category: 'Diagnostics',
    description: 'Ultrasound imaging of heart chambers and valve function.',
    liveSearchKeyword: 'cardiac diagnostic centre echocardiography hospital',
  },
  {
    id: 'diag-cbc-panel',
    name: 'Complete Blood Count (CBC) & Lipid Profile',
    category: 'Diagnostics',
    description: 'Routine pathology blood panel including hemoglobin, cell counts, and cholesterol profile.',
    liveSearchKeyword: 'pathology lab diagnostic centre blood test',
  },
  {
    id: 'diag-usg-abdomen',
    name: 'Ultrasound Whole Abdomen',
    category: 'Diagnostics',
    description: 'Diagnostic abdominal ultrasonography for liver, kidneys, gallbladder, and pelvic organs.',
    liveSearchKeyword: 'ultrasound diagnostic centre radiology clinic',
  },

  // Treatment
  {
    id: 'treat-cataract-phaco',
    name: 'Cataract Surgery (Phacoemulsification)',
    category: 'Treatment',
    description: 'Day-care phacoemulsification cataract procedure with standard foldable intraocular lens.',
    liveSearchKeyword: 'eye hospital cataract surgery ophthalmology',
  },
  {
    id: 'treat-lap-cholecystectomy',
    name: 'Laparoscopic Gallbladder Surgery',
    category: 'Treatment',
    description: 'Minimally invasive laparoscopic cholecystectomy procedure and standard ward stay.',
    liveSearchKeyword: 'multi specialty surgical hospital gastroenterology',
  },
  {
    id: 'treat-coronary-angiography',
    name: 'Coronary Angiography',
    category: 'Treatment',
    description: 'Diagnostic cardiac catheterization procedure to evaluate coronary arteries.',
    liveSearchKeyword: 'cardiac hospital cath lab cardiology institute',
  },
  {
    id: 'treat-knee-replacement',
    name: 'Total Knee Replacement (Unilateral)',
    category: 'Treatment',
    description: 'Surgical joint replacement procedure with standard hospital recovery care.',
    liveSearchKeyword: 'orthopedic joint replacement hospital',
  },
  {
    id: 'treat-hemodialysis',
    name: 'Hemodialysis Session',
    category: 'Treatment',
    description: 'Single outpatient renal dialysis session at a hospital or nephrology dialysis unit.',
    liveSearchKeyword: 'dialysis centre nephrology hospital',
  },
];

export function getServicesByCategory(category: HealthcareCategory): MedicalService[] {
  return MEDICAL_SERVICES.filter((service) => service.category === category);
}

export function getServiceById(serviceId: string): MedicalService | undefined {
  return MEDICAL_SERVICES.find((service) => service.id === serviceId);
}

// Pan-India quick starting locations (Kolkata localities for initial Demo Dataset + major Indian cities)
export const PAN_INDIA_PRESET_LOCATIONS: StartingLocation[] = [
  { label: 'Esplanade, Central Kolkata, West Bengal', lat: 22.5646, lng: 88.3522, source: 'preset' },
  { label: 'Howrah Junction, West Bengal', lat: 22.5839, lng: 88.3426, source: 'preset' },
  { label: 'Salt Lake Sector V, Kolkata, West Bengal', lat: 22.5726, lng: 88.4317, source: 'preset' },
  { label: 'Jadavpur, South Kolkata, West Bengal', lat: 22.4989, lng: 88.3717, source: 'preset' },
  { label: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, source: 'preset' },
  { label: 'Dadar, Mumbai, Maharashtra', lat: 19.0178, lng: 72.8478, source: 'preset' },
  { label: 'Indiranagar, Bengaluru, Karnataka', lat: 12.9784, lng: 77.6408, source: 'preset' },
  { label: 'T. Nagar, Chennai, Tamil Nadu', lat: 13.0418, lng: 80.2341, source: 'preset' },
  { label: 'Banjara Hills, Hyderabad, Telangana', lat: 17.4156, lng: 78.4347, source: 'preset' },
  { label: 'Shivajinagar, Pune, Maharashtra', lat: 18.5308, lng: 73.8475, source: 'preset' },
  { label: 'C-Scheme, Jaipur, Rajasthan', lat: 26.9047, lng: 75.7988, source: 'preset' },
  { label: 'Paltan Bazar, Guwahati, Assam', lat: 26.1815, lng: 91.7498, source: 'preset' },
];

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];
