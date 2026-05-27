 import { NextRequest, NextResponse } from 'next/server';
import { runFullSafetyCheck } from '@/lib/safety-engine';
import { calculateEGFR, calculateCHA2DS2VASc, getStrokeRisk, getAnticoagulationRecommendation } from '@/lib/calculators';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Safety check body:', JSON.stringify(body));
    
    const { newDrug, currentMeds, allergies, labs, patientAge, patientSex, calculators } = body;

    let egfr: number | undefined;
    if (labs?.creatinine && patientAge && patientSex) {
      egfr = calculateEGFR(Number(labs.creatinine), Number(patientAge), patientSex);
    } else if (labs?.egfr) {
      egfr = Number(labs.egfr);
    }

    console.log('Calculated eGFR:', egfr);

    const safetyResult = await runFullSafetyCheck(
      newDrug || '',
      currentMeds || [],
      allergies || [],
      egfr
    );

    const calculatorResults: Record<string, any> = {};

    if (calculators?.egfr && egfr) {
      calculatorResults.egfr = egfr;
      safetyResult.constraintText += `\nℹ️ CALCULATED eGFR (CKD-EPI 2021): ${egfr} mL/min/1.73m²`;
    }

    if (calculators?.cha2ds2vasc && patientAge && patientSex) {
      try {
        const score = calculateCHA2DS2VASc({
          chf: calculators.cha2ds2vasc.chf || false,
          hypertension: calculators.cha2ds2vasc.hypertension || false,
          age: Number(patientAge),
          diabetes: calculators.cha2ds2vasc.diabetes || false,
          strokeOrTIA: calculators.cha2ds2vasc.strokeOrTIA || false,
          vascularDisease: calculators.cha2ds2vasc.vascularDisease || false,
          sex: patientSex,
        });
        const strokeRisk = getStrokeRisk(score);
        const recommendation = getAnticoagulationRecommendation(score, patientSex);
        calculatorResults.cha2ds2vasc = { score, strokeRisk, recommendation };
        safetyResult.constraintText += `\nℹ️ CHA₂DS₂-VASc SCORE: ${score} — Stroke risk: ${strokeRisk}/year — Anticoagulation: ${recommendation}`;
      } catch (calcError: any) {
        console.error('Calculator error:', calcError.message);
      }
    }

    return NextResponse.json({
      success: true,
      alerts: safetyResult.alerts,
      constraintText: safetyResult.constraintText,
      calculatorResults,
      egfr,
    });
  } catch (error: any) {
    console.error('Safety check error:', error.stack || error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.stack || error.message 
    }, { status: 500 });
  }
}