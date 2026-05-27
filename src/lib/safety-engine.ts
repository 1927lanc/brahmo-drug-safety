 import { supabase } from './supabase';
import { Drug, SafetyAlert, SafetyCheckResult } from './types';
import { calculateEGFR } from './calculators';

let drugsCache: Drug[] | null = null;
let interactionsCache: any[] | null = null;

async function getDrugs(): Promise<Drug[]> {
  if (drugsCache) return drugsCache;
  const { data } = await supabase.from('drugs').select('*');
  drugsCache = data || [];
  return drugsCache;
}

async function getInteractions(): Promise<any[]> {
  if (interactionsCache) return interactionsCache;
  const { data } = await supabase.from('drug_interactions').select(`
    *,
    drug_a:drug_a_id(generic_name, drug_class),
    drug_b:drug_b_id(generic_name, drug_class)
  `);
  interactionsCache = data || [];
  return interactionsCache;
}

function normalizeName(name: string): string {
   if (!name) return '';
return name.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'CONTRAINDICATED':
    case 'SEVERE': return '⛔';
    case 'MODERATE': return '⚠️';
    case 'MINOR': return '⚠️';
    default: return 'ℹ️';
  }
}

export async function checkDrugInteractions(
  newDrug: string,
  currentMeds: string[]
): Promise<SafetyAlert[]> {
  const alerts: SafetyAlert[] = [];
  try {
    const drugs = await getDrugs();
    const interactions = await getInteractions();
    const newDrugNorm = normalizeName(newDrug);
    const newDrugObj = drugs.find(d => d.generic_name_normalized === newDrugNorm);
    if (!newDrugObj) return alerts;

    const currentMedNorms = currentMeds.map(normalizeName);

    for (const interaction of interactions) {
      const drugAName = interaction.drug_a?.generic_name || '';
      const drugBName = interaction.drug_b?.generic_name || '';
      const drugANorm = normalizeName(drugAName);
      const drugBNorm = normalizeName(drugBName);

      const isNewDrugA = drugANorm === newDrugNorm;
      const isNewDrugB = drugBNorm === newDrugNorm;

      if (!isNewDrugA && !isNewDrugB) continue;

      const otherDrugNorm = isNewDrugA ? drugBNorm : drugANorm;
      const otherDrugName = isNewDrugA ? drugBName : drugAName;

      if (currentMedNorms.includes(otherDrugNorm)) {
        alerts.push({
          type: interaction.severity === 'SEVERE' || interaction.severity === 'CONTRAINDICATED'
            ? 'SEVERE' : interaction.severity as any,
          category: 'INTERACTION',
          message: `${getSeverityIcon(interaction.severity)} ${interaction.severity}: ${newDrug} + ${otherDrugName}`,
          details: `${interaction.mechanism} → ${interaction.clinical_effect}`,
          management: interaction.management,
          icon: getSeverityIcon(interaction.severity),
        });
      }
    }
  } catch (e) {
    console.error('Drug interaction check error:', e);
  }
  return alerts;
}

export async function checkAllergyConflicts(
  newDrug: string,
  allergies: { drug: string; reaction: string }[]
): Promise<SafetyAlert[]> {
  const alerts: SafetyAlert[] = [];
  try {
    const drugs = await getDrugs();
    const newDrugNorm = normalizeName(newDrug);
    const newDrugObj = drugs.find(d => d.generic_name_normalized === newDrugNorm);
    if (!newDrugObj) return alerts;

    for (const allergy of allergies) {
      if (allergy.drug === 'NKDA') continue;

      const allergyNorm = normalizeName(allergy.drug);

      if (newDrugNorm === allergyNorm || newDrugObj.drug_class === allergyNorm) {
        alerts.push({
          type: allergy.reaction?.toUpperCase().includes('ANAPHYLAXIS') ? 'HARD_BLOCK' : 'SEVERE',
          category: 'ALLERGY',
          message: `⛔ ALLERGY BLOCK: ${newDrug} — Patient has ${allergy.reaction} to ${allergy.drug}`,
          details: `Direct match: ${newDrug} is a ${newDrugObj.drug_class}. Patient documented ${allergy.reaction} to ${allergy.drug}.`,
          management: 'DO NOT PRESCRIBE. Find alternative.',
          icon: '⛔',
        });
        continue;
      }

      try {
        const { data: crossReact } = await supabase
          .from('allergy_cross_reactivity')
          .select('*')
          .or(`drug_class_a.eq.${allergyNorm},drug_class_b.eq.${allergyNorm}`);

        if (crossReact) {
          for (const cr of crossReact) {
            const crossClass = cr.drug_class_a === allergyNorm ? cr.drug_class_b : cr.drug_class_a;
            if (newDrugObj.drug_class === crossClass && cr.cross_reactivity_pct !== '0%') {
              alerts.push({
                type: 'MODERATE',
                category: 'ALLERGY',
                message: `⚠️ CROSS-REACTIVITY: ${newDrug} (${newDrugObj.drug_class}) — ${cr.cross_reactivity_pct} cross-reactivity with ${allergy.drug} allergy`,
                details: cr.clinical_guidance,
                management: cr.clinical_guidance,
                icon: '⚠️',
              });
            }
          }
        }
      } catch (e) {
        console.log('Cross-reactivity check skipped:', e);
      }
    }
  } catch (e) {
    console.error('Allergy check error:', e);
  }
  return alerts;
}

export async function checkRenalDosing(
  newDrug: string,
  egfr: number
): Promise<SafetyAlert[]> {
  const alerts: SafetyAlert[] = [];
  try {
    const drugs = await getDrugs();
    const newDrugNorm = normalizeName(newDrug);
    const newDrugObj = drugs.find(d => d.generic_name_normalized === newDrugNorm);

    if (!newDrugObj || !newDrugObj.renal_dosing) return alerts;

    const rd = newDrugObj.renal_dosing;

    if (rd.egfr_30 && egfr < 30) {
      const isContraindicated = rd.egfr_30 === 'contraindicated' || rd.egfr_30 === 'avoid';
      alerts.push({
        type: isContraindicated ? 'SEVERE' : 'MODERATE',
        category: 'RENAL',
        message: `⚠️ RENAL DOSE ADJUSTMENT: ${newDrug} — eGFR ${egfr} (threshold: 30)`,
        details: `Action required: ${rd.egfr_30}`,
        management: rd.egfr_30,
        icon: '⚠️',
      });
    } else if (rd.egfr_15_30 && egfr >= 15 && egfr < 30) {
      alerts.push({
        type: 'MODERATE',
        category: 'RENAL',
        message: `⚠️ RENAL DOSE ADJUSTMENT: ${newDrug} — eGFR ${egfr}`,
        details: `Action required: ${rd.egfr_15_30}`,
        management: rd.egfr_15_30,
        icon: '⚠️',
      });
    } else if (rd.egfr_20 && egfr < 20) {
      alerts.push({
        type: 'SEVERE',
        category: 'RENAL',
        message: `⚠️ RENAL DOSE ADJUSTMENT: ${newDrug} — eGFR ${egfr} (threshold: 20)`,
        details: `Action required: ${rd.egfr_20}`,
        management: rd.egfr_20,
        icon: '⚠️',
      });
    } else if (rd.egfr_50 && egfr < 50) {
      alerts.push({
        type: 'MODERATE',
        category: 'RENAL',
        message: `⚠️ RENAL DOSE ADJUSTMENT: ${newDrug} — eGFR ${egfr} (threshold: 50)`,
        details: `Action required: ${rd.egfr_50}`,
        management: rd.egfr_50,
        icon: '⚠️',
      });
    }
  } catch (e) {
    console.error('Renal check error:', e);
  }
  return alerts;
}

export function generateConstraintText(alerts: SafetyAlert[]): string {
  if (alerts.length === 0) {
    return 'SAFETY ENGINE: No drug interactions, allergy conflicts, or renal dosing issues detected.';
  }

  const hardBlocks = alerts.filter(a => a.type === 'HARD_BLOCK');
  const severe = alerts.filter(a => a.type === 'SEVERE');
  const moderate = alerts.filter(a => a.type === 'MODERATE');
  const minor = alerts.filter(a => a.type === 'MINOR' || a.type === 'INFO');

  let text = '=== DRUG SAFETY ENGINE CONSTRAINTS ===\n';
  text += 'DETERMINISTIC results from database lookups. MUST respect these constraints.\n\n';

  if (hardBlocks.length > 0) {
    text += '⛔ HARD BLOCKS (NON-OVERRIDABLE):\n';
    hardBlocks.forEach(a => {
      text += `- ${a.message}\n  ${a.details}\n  Action: ${a.management}\n`;
    });
    text += '\n';
  }

  if (severe.length > 0) {
    text += '⛔ SEVERE WARNINGS:\n';
    severe.forEach(a => {
      text += `- ${a.message}\n  ${a.details}\n  Action: ${a.management}\n`;
    });
    text += '\n';
  }

  if (moderate.length > 0) {
    text += '⚠️ MODERATE WARNINGS:\n';
    moderate.forEach(a => {
      text += `- ${a.message}\n  ${a.details}\n  Action: ${a.management}\n`;
    });
    text += '\n';
  }

  if (minor.length > 0) {
    text += 'ℹ️ MINOR/INFO:\n';
    minor.forEach(a => {
      text += `- ${a.message}\n`;
    });
    text += '\n';
  }

  text += '=== END SAFETY CONSTRAINTS ===\n';
  text += 'Provide clinical response WITHIN these safety constraints only.';

  return text;
}

export async function runFullSafetyCheck(
  newDrug: string,
  currentMeds: string[],
  allergies: { drug: string; reaction: string }[],
  egfr?: number
): Promise<SafetyCheckResult> {
  const [interactionAlerts, allergyAlerts, renalAlerts] = await Promise.all([
    checkDrugInteractions(newDrug, currentMeds),
    checkAllergyConflicts(newDrug, allergies),
    egfr !== undefined ? checkRenalDosing(newDrug, egfr) : Promise.resolve([]),
  ]);

  const allAlerts = [...allergyAlerts, ...interactionAlerts, ...renalAlerts];
  const constraintText = generateConstraintText(allAlerts);

  return { alerts: allAlerts, constraintText };
}