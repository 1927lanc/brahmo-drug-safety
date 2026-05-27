import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, patientContext, constraintText, mode } = body;
    const key = process.env.GEMINI_API_KEY || '';
    const prompt = mode === 'generic' ? 'You are a general AI. Answer helpfully.\n\nPatient: ' + patientContext + '\n\nQuestion: ' + question : 'You are a safety AI. FOLLOW THESE CONSTRAINTS:\n\n' + constraintText + '\n\nPatient: ' + patientContext + '\n\nQuestion: ' + question;
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=' + key, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({contents:[{parts:[{text:prompt}]}]}) });
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || d.error?.message || 'Error';
    return NextResponse.json({success:true, response:text});
  } catch(e:any) { return NextResponse.json({success:false,error:e.message},{status:500}); }
}
