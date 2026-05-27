export interface Drug {
  id: string;
  generic_name: string;
  generic_name_normalized: string;
  drug_class: string;
  renal_dosing: Record<string, string>;
}

export interface DrugInteraction {
  id: string;
  drug_a_id: string;
  drug_b_id: string;
  severity: 'CONTRAINDICATED' | 'SEVERE' | 'MODERATE' | 'MINOR';
  mechanism: string;
  clinical_effect: string;
  management: string;
  drug_a?: Drug;
  drug_b?: Drug;
}

export interface AllergyCrossReactivity {
  id: string;
  drug_class_a: string;
  drug_class_b: string;
  cross_reactivity_pct: string;
  clinical_guidance: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: string;
  conditions: string[];
  current_medications: { name: string; dose: string }[];
  allergies: { drug: string; reaction: string; year: number | null }[];
  labs: Record<string, number>;
  vitals: Record<string, string | number>;
}

export interface SafetyAlert {
  type: 'HARD_BLOCK' | 'SEVERE' | 'MODERATE' | 'MINOR' | 'INFO';
  category: 'INTERACTION' | 'ALLERGY' | 'RENAL' | 'CALCULATOR';
  message: string;
  details: string;
  management?: string;
  icon: string;
}

export interface SafetyCheckResult {
  alerts: SafetyAlert[];
  constraintText: string;
  calculatorResults?: Record<string, number | string>;
}