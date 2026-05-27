CREATE TABLE IF NOT EXISTS drugs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  generic_name TEXT NOT NULL,
  generic_name_normalized TEXT NOT NULL,
  drug_class TEXT NOT NULL,
  renal_dosing JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS drug_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drug_a_id UUID REFERENCES drugs(id),
  drug_b_id UUID REFERENCES drugs(id),
  severity TEXT NOT NULL,
  mechanism TEXT,
  clinical_effect TEXT,
  management TEXT
);

CREATE TABLE IF NOT EXISTS allergy_cross_reactivity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drug_class_a TEXT NOT NULL,
  drug_class_b TEXT NOT NULL,
  cross_reactivity_pct TEXT,
  clinical_guidance TEXT
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  sex TEXT,
  weight_kg NUMERIC,
  conditions TEXT[],
  current_medications JSONB,
  allergies JSONB,
  labs JSONB,
  vitals JSONB
);