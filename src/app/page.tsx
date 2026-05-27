 'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Patient, SafetyAlert } from '@/lib/types';

export default function Home() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [newDrug, setNewDrug] = useState('');
  const [question, setQuestion] = useState('');
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [constraintText, setConstraintText] = useState('');
  const [genericResponse, setGenericResponse] = useState('');
  const [enhancedResponse, setEnhancedResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [egfr, setEgfr] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('patients').select('*').then(({ data }) => {
      if (data) setPatients(data);
    });
  }, []);

  const runSafetyCheck = async () => {
    if (!selectedPatient || !newDrug) return;
    setSafetyLoading(true);
    setAlerts([]);
    setConstraintText('');

    const meds = selectedPatient.current_medications.map((m: any) => m.name);

    const isPatient8 = selectedPatient.name.includes('Patient 8') || 
      selectedPatient.conditions?.includes('AF');

    const res = await fetch('/api/safety-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newDrug,
        currentMeds: meds,
        allergies: selectedPatient.allergies,
        labs: selectedPatient.labs,
        patientAge: selectedPatient.age,
        patientSex: selectedPatient.sex,
        calculators: {
          egfr: true,
          cha2ds2vasc: isPatient8 ? {
            chf: selectedPatient.conditions?.includes('HF'),
            hypertension: selectedPatient.conditions?.includes('HTN'),
            diabetes: selectedPatient.conditions?.includes('T2DM'),
            strokeOrTIA: selectedPatient.conditions?.includes('Previous TIA'),
            vascularDisease: false,
          } : undefined,
        },
      }),
    });

    const data = await res.json();
    setAlerts(data.alerts || []);
    setConstraintText(data.constraintText || '');
    if (data.egfr) setEgfr(data.egfr);
    setSafetyLoading(false);
  };

  const askAI = async (mode: 'generic' | 'enhanced') => {
    if (!selectedPatient || !question) return;
    setLoading(true);

    const patientContext = `
Name: ${selectedPatient.name}
Age: ${selectedPatient.age} | Sex: ${selectedPatient.sex}
Conditions: ${selectedPatient.conditions?.join(', ')}
Current Medications: ${selectedPatient.current_medications.map((m: any) => `${m.name} ${m.dose}`).join(', ')}
Allergies: ${selectedPatient.allergies.map((a: any) => `${a.drug} (${a.reaction})`).join(', ')}
Labs: ${JSON.stringify(selectedPatient.labs)}
${egfr ? `Calculated eGFR: ${egfr}` : ''}
    `;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, patientContext, constraintText, mode }),
    });

    const data = await res.json();
    if (mode === 'generic') setGenericResponse(data.response);
    else setEnhancedResponse(data.response);
    setLoading(false);
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'HARD_BLOCK': return 'bg-red-900 border-red-500';
      case 'SEVERE': return 'bg-red-800 border-red-400';
      case 'MODERATE': return 'bg-yellow-800 border-yellow-400';
      case 'MINOR': return 'bg-blue-800 border-blue-400';
      default: return 'bg-gray-800 border-gray-400';
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-blue-400">🏥 Brahmo Drug Safety Engine</h1>
          <p className="text-gray-400 mt-1">Deterministic AI Safety Layer for Clinical Decision Support</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Panel - Patient Selection */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 text-blue-300">👤 Select Patient</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPatient(p); setAlerts([]); setConstraintText(''); setGenericResponse(''); setEnhancedResponse(''); }}
                  className={`w-full text-left p-2 rounded-lg border text-sm transition-all ${
                    selectedPatient?.id === p.id
                      ? 'bg-blue-800 border-blue-400'
                      : 'bg-gray-800 border-gray-600 hover:border-blue-500'
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-gray-400 text-xs">{p.age}y {p.sex} | eGFR: {p.labs?.egfr || 'N/A'}</div>
                </button>
              ))}
            </div>

            {selectedPatient && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-blue-300 mb-2">📋 Patient Summary</h3>
                <div className="bg-gray-800 rounded-lg p-3 text-xs space-y-1">
                  <div><span className="text-gray-400">Conditions:</span> {selectedPatient.conditions?.join(', ')}</div>
                  <div><span className="text-gray-400">Meds:</span> {selectedPatient.current_medications?.map((m: any) => m.name).join(', ')}</div>
                  <div><span className="text-red-400">Allergies:</span> {selectedPatient.allergies?.map((a: any) => `${a.drug} (${a.reaction})`).join(', ')}</div>
                  <div><span className="text-gray-400">Labs:</span> {Object.entries(selectedPatient.labs || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</div>
                </div>
              </div>
            )}
          </div>

          {/* Middle Panel - Safety Check */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 text-yellow-300">🔍 Safety Check</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">New Drug to Prescribe</label>
                <input
                  type="text"
                  value={newDrug}
                  onChange={(e) => setNewDrug(e.target.value)}
                  placeholder="e.g. Clarithromycin"
                  className="w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm focus:border-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">Doctor's Question</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Can I add Clarithromycin 500mg for pneumonia?"
                  rows={3}
                  className="w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm focus:border-blue-400 outline-none resize-none"
                />
              </div>

              <button
                onClick={runSafetyCheck}
                disabled={safetyLoading || !selectedPatient || !newDrug}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 rounded-lg p-2 font-semibold text-sm transition-all"
              >
                {safetyLoading ? '🔄 Running Safety Check...' : '🛡️ Run Safety Check'}
              </button>

              {egfr && (
                <div className="bg-blue-900 border border-blue-500 rounded-lg p-2 text-xs">
                  <span className="text-blue-300">ℹ️ Calculated eGFR: </span>
                  <span className="font-bold text-white">{egfr} mL/min/1.73m²</span>
                </div>
              )}
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-red-300">🚨 Safety Alerts ({alerts.length})</h3>
                {alerts.map((alert, i) => (
                  <div key={i} className={`rounded-lg p-2 border text-xs ${getAlertColor(alert.type)}`}>
                    <div className="font-semibold">{alert.message}</div>
                    <div className="text-gray-300 mt-1">{alert.details}</div>
                    {alert.management && (
                      <div className="text-green-300 mt-1">✅ {alert.management}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {alerts.length === 0 && constraintText && (
              <div className="mt-4 bg-green-900 border border-green-500 rounded-lg p-2 text-xs">
                ✅ No safety issues detected
              </div>
            )}
          </div>

          {/* Right Panel - AI Comparison */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 text-green-300">🤖 AI Comparison</h2>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => askAI('generic')}
                disabled={loading || !question || !selectedPatient}
                className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 rounded-lg p-2 text-xs font-semibold transition-all"
              >
                {loading ? '...' : '❌ Generic AI'}
              </button>
              <button
                onClick={() => askAI('enhanced')}
                disabled={loading || !question || !selectedPatient || !constraintText}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-800 rounded-lg p-2 text-xs font-semibold transition-all"
              >
                {loading ? '...' : '✅ Safety-Enhanced AI'}
              </button>
            </div>

            <div className="space-y-3">
              {genericResponse && (
                <div className="bg-red-950 border border-red-700 rounded-lg p-3">
                  <div className="text-xs font-bold text-red-400 mb-2">❌ GENERIC AI (No Safety Layer)</div>
                  <div className="text-xs text-gray-300 whitespace-pre-wrap">{genericResponse}</div>
                </div>
              )}

              {enhancedResponse && (
                <div className="bg-green-950 border border-green-700 rounded-lg p-3">
                  <div className="text-xs font-bold text-green-400 mb-2">✅ SAFETY-ENHANCED AI</div>
                  <div className="text-xs text-gray-300 whitespace-pre-wrap">{enhancedResponse}</div>
                </div>
              )}

              {!genericResponse && !enhancedResponse && (
                <div className="text-center text-gray-500 text-xs mt-8">
                  Run safety check first, then compare AI responses
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}




