export function calculateEGFR(creatinine: number, age: number, sex: 'M' | 'F'): number {
  const kappa = sex === 'F' ? 0.7 : 0.9;
  const alpha = sex === 'F' ? -0.241 : -0.302;
  const multiplier = sex === 'F' ? 1.012 : 1.0;

  const ratio = creatinine / kappa;
  const egfr =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age) *
    multiplier;

  return Math.round(egfr * 10) / 10;
}

export interface CHA2DS2VAScInputs {
  chf: boolean;
  hypertension: boolean;
  age: number;
  diabetes: boolean;
  strokeOrTIA: boolean;
  vascularDisease: boolean;
  sex: 'M' | 'F';
}

export function calculateCHA2DS2VASc(inputs: CHA2DS2VAScInputs): number {
  let score = 0;
  if (inputs.chf) score += 1;
  if (inputs.hypertension) score += 1;
  if (inputs.age >= 75) score += 2;
  else if (inputs.age >= 65) score += 1;
  if (inputs.diabetes) score += 1;
  if (inputs.strokeOrTIA) score += 2;
  if (inputs.vascularDisease) score += 1;
  if (inputs.sex === 'F') score += 1;
  return score;
}

export function getStrokeRisk(score: number): string {
  const risks: Record<number, string> = {
    0: '0%', 1: '1.3%', 2: '2.2%', 3: '3.2%',
    4: '4.0%', 5: '6.7%', 6: '9.8%', 7: '9.6%',
    8: '6.7%', 9: '15.2%'
  };
  return risks[score] || '>15%';
}

export function getAnticoagulationRecommendation(score: number, sex: 'M' | 'F'): string {
  if (sex === 'M' && score >= 2) return 'STRONGLY RECOMMENDED';
  if (sex === 'F' && score >= 3) return 'STRONGLY RECOMMENDED';
  if (sex === 'M' && score === 1) return 'CONSIDER';
  return 'NOT RECOMMENDED';
}