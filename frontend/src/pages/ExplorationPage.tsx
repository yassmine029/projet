import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    MapPin,
    Activity,
    Info,
    ChevronRight,
    Layers,
    ArrowLeft,
    Target,
    Wind,
    Compass,
    FileText
} from 'lucide-react';
import { getPatientSeries, getPatientFile } from '../api';
import atlasLabels from '../constants/atlas_labels.json';

const ATLAS_ID = "brodmann";

export default function ExplorationPage() {
    const [atlasSeries, setAtlasSeries] = useState<any[]>([]);
    const [patientSeries, setPatientSeries] = useState<any[]>([]);
    const [currentAtlasIndex, setCurrentAtlasIndex] = useState(0);
    const [currentPatientIndex, setCurrentPatientIndex] = useState(0);
    const [identifiedZone, setIdentifiedZone] = useState<string | null>(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSync, setIsSync] = useState(true);

    const handleAtlasChange = (val: number) => {
        setCurrentAtlasIndex(val);
        if (isSync && patientSeries.length > 0) {
            const percent = val / (atlasSeries.length - 1);
            const patIndex = Math.round(percent * (patientSeries.length - 1));
            setCurrentPatientIndex(patIndex);
        }
    };

    const handlePatientChange = (val: number) => {
        setCurrentPatientIndex(val);
        if (isSync && atlasSeries.length > 0) {
            const percent = val / (patientSeries.length - 1);
            const atlIndex = Math.round(percent * (atlasSeries.length - 1));
            setCurrentAtlasIndex(atlIndex);
        }
    };

    const patientId = sessionStorage.getItem("patientId") || "DefaultPatient";
    const patientImgRef = useRef<HTMLImageElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        async function initData() {
            try {
                const atlasRes = await getPatientSeries(ATLAS_ID);
                setAtlasSeries(atlasRes.data || []);

                const patientStatId = sessionStorage.getItem("patientId");
                if (patientStatId) {
                    const patientRes = await getPatientSeries(patientStatId);
                    setPatientSeries(patientRes.data || []);
                }
            } catch (err) {
                console.error("Error loading exploration data:", err);
            } finally {
                setLoading(false);
            }
        }
        initData();
    }, []);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!patientImgRef.current) return;

        const rect = patientImgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Normalize coordinates (0-100)
        const normX = (x / rect.width) * 100;
        const normY = (y / rect.height) * 100;

        setHoverPos({ x: e.clientX, y: e.clientY });
        setIsHovering(true);

        const labels = atlasLabels as Record<string, string>;

        // Refined mock identification logic based on brain quadrants/regions
        // This is a more comprehensive mapping for the demo
        if (normX > 45 && normX < 55 && normY > 35 && normY < 48) {
            setIdentifiedZone(labels["4"]); // Cortex Moteur
        } else if (normX > 32 && normX < 44 && normY > 58 && normY < 72) {
            setIdentifiedZone(labels["44"]); // Broca
        } else if (normX > 32 && normX < 44 && normY > 72 && normY < 85) {
            setIdentifiedZone(labels["45"]); // Broca second part
        } else if (normX > 62 && normX < 78 && normY > 45 && normY < 62) {
            setIdentifiedZone(labels["22"]); // Wernicke
        } else if (normX > 45 && normX < 55 && normY > 75 && normY < 92) {
            setIdentifiedZone(labels["17"]); // Visual
        } else if (normX > 45 && normX < 55 && normY > 92 && normY < 98) {
            setIdentifiedZone(labels["18"]); // Secondary Visual
        } else if (normX > 52 && normX < 65 && normY > 30 && normY < 45) {
            setIdentifiedZone(labels["1"]); // Somatosensory
        } else if (normX > 30 && normX < 45 && normY > 20 && normY < 40) {
            setIdentifiedZone(labels["6"]); // Premotor
        } else if (normX > 20 && normX < 40 && normY > 40 && normY < 60) {
            setIdentifiedZone(labels["46"]); // DLPFC
        } else {
            setIdentifiedZone(null);
        }
    };

    const currentAtlas = atlasSeries[currentAtlasIndex];
    const currentPatient = patientSeries[currentPatientIndex] || patientSeries[0];

    if (loading) {
        return (
            <div className="min-h-screen bg-blue-50/20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 text-blue-600 animate-bounce" />
                    <span className="text-blue-900 font-bold tracking-tight">Initialisation de l'exploration...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-50/20 text-gray-900 font-sans selection:bg-blue-100">
            {/* Background Decor */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#3b82f605_1px,transparent_1px),linear-gradient(to_bottom,#3b82f605_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-blue-100/50 z-50">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.history.back()}
                            className="p-2 hover:bg-blue-50 text-blue-900 rounded-lg transition-all border border-transparent hover:border-blue-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="h-8 w-px bg-blue-100 mx-1"></div>
                        <div>
                            <h1 className="text-xl font-bold text-blue-900 tracking-tight flex items-center gap-2">
                                <Compass className="w-5 h-5 text-blue-600" />
                                Exploration Corticale
                            </h1>
                            <p className="text-[10px] text-blue-500 uppercase tracking-widest font-bold flex items-center gap-2">
                                <Target className="w-3 h-3" /> ID: {patientId}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shadow-sm">
                            <Layers className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-blue-900">Standard Atlas MNI152</span>
                        </div>
                        <button className="p-2 text-blue-400 hover:text-blue-600 transition-colors">
                            <Info className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 pt-24 pb-32 px-6 max-w-[1600px] mx-auto grid lg:grid-cols-12 gap-8">
                {/* Left Sidebar: Analysis Tools */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm p-6 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity className="w-24 h-24 text-blue-900" />
                        </div>
                        <h2 className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" /> Diagnostic Aide
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed relative z-10">
                            Survolez les structures cérébrales sur l'image recalée pour identifier automatiquement les aires de Brodmann correspondantes.
                        </p>
                        <div className="mt-6 space-y-2">
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-2xl">
                                <span className="text-[10px] font-bold text-blue-500 uppercase">Qualité</span>
                                <span className="text-xs font-bold text-blue-900">0.82 RMSE</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white border border-blue-50 rounded-2xl shadow-sm">
                                <span className="text-[10px] font-bold text-blue-500 uppercase">Méthode</span>
                                <span className="text-xs font-bold text-blue-900">Probabiliste</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-blue-100 shadow-xl p-6 ring-2 ring-blue-500/5">
                        <h2 className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Search className="w-4 h-4 text-blue-500" /> Aire Détectée
                        </h2>
                        <div className="min-h-[100px] flex flex-col justify-center">
                            {identifiedZone ? (
                                <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-200 animate-in zoom-in-95 duration-200">
                                    <span className="text-[10px] text-blue-100 font-bold uppercase tracking-wider block mb-1">Localisation Active</span>
                                    <span className="text-lg font-bold text-white leading-tight">{identifiedZone}</span>
                                </div>
                            ) : (
                                <div className="p-6 border-2 border-dashed border-blue-100 rounded-2xl text-center">
                                    <span className="text-xs text-blue-400 italic">Interagissez avec l'image pour l'identification</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-blue-100 shadow-sm p-6">
                        <h2 className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-500" /> Légende Corticale
                        </h2>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.entries(atlasLabels).map(([id, label]) => (
                                <div key={id} className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-xl transition-colors cursor-default group">
                                    <div className={`w-2 h-2 rounded-full ${identifiedZone === label ? 'bg-blue-600 scale-125' : 'bg-blue-200 group-hover:bg-blue-400'} transition-all`}></div>
                                    <span className={`text-[11px] font-medium ${identifiedZone === label ? 'text-blue-900 font-bold' : 'text-gray-500'}`}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center: Viewports */}
                <div className="lg:col-span-9 grid md:grid-cols-2 gap-8">
                    {/* Atlas Viewport */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-tighter italic">RÉFÉRENCE ATLAS</h3>
                            <span className="text-[10px] font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full">
                                COUPE {currentAtlasIndex + 1}/{atlasSeries.length || '?'}
                            </span>
                        </div>
                        <div className="relative aspect-square bg-gray-950 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl shadow-blue-900/10 group transition-all duration-500 hover:shadow-blue-900/20">
                            {currentAtlas ? (
                                <img
                                    src={`/api/patient_file?jobId=${(currentAtlas as any).job_id}&relpath=${(currentAtlas as any).relpath}`}
                                    alt="Atlas"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                    <Layers className="w-12 h-12 text-slate-800 animate-pulse" />
                                </div>
                            )}
                            {identifiedZone && (
                                <div className="absolute inset-0 bg-blue-500/5 pointer-events-none ring-inset ring-[12px] ring-blue-500/10 animate-pulse"></div>
                            )}
                        </div>

                        <div className="px-4">
                            <input
                                type="range"
                                className="w-full h-1.5 bg-white border border-blue-100 rounded-full appearance-none cursor-pointer accent-blue-600 shadow-sm"
                                min={0}
                                max={Math.max(0, atlasSeries.length - 1)}
                                value={currentAtlasIndex}
                                onChange={(e) => handleAtlasChange(parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    {/* Patient Viewport */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-tight">PATIENT (RECALÉ)</h3>

                            <button
                                onClick={() => setIsSync(!isSync)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${isSync ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${isSync ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                <span className="text-[9px] font-bold uppercase tracking-wider">{isSync ? 'SYNC ON' : 'SYNC OFF'}</span>
                            </button>
                        </div>
                        <div
                            className="relative aspect-square bg-gray-950 rounded-[2.5rem] overflow-hidden border-4 border-blue-100 shadow-2xl shadow-blue-900/10 group cursor-crosshair transition-all duration-500 hover:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => { setIsHovering(false); setIdentifiedZone(null); }}
                        >
                            {currentPatient ? (
                                <img
                                    ref={patientImgRef}
                                    src={`/api/patient_file?jobId=${(currentPatient as any).job_id}&relpath=${(currentPatient as any).relpath}`}
                                    alt="Patient"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                    <Activity className="w-12 h-12 text-slate-800 animate-pulse" />
                                </div>
                            )}

                            {/* Floating Tooltip */}
                            {isHovering && identifiedZone && (
                                <div
                                    className="fixed z-[100] pointer-events-none transition-transform duration-75 ease-out"
                                    style={{
                                        left: hoverPos.x + 24,
                                        top: hoverPos.y - 24,
                                        transform: 'translate(0, -50%)'
                                    }}
                                >
                                    <div className="bg-white/90 backdrop-blur-xl border border-blue-100 p-4 rounded-2xl shadow-2xl flex flex-col gap-1 min-w-[200px]">
                                        <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest flex items-center gap-2 border-b border-blue-50 pb-2 mb-1">
                                            <MapPin className="w-3 h-3" /> Anatomie Corticale
                                        </div>
                                        <div className="text-base font-bold text-blue-900 leading-tight">
                                            {identifiedZone}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isHovering && (
                                <div
                                    className="fixed w-8 h-8 pointer-events-none z-[99] border-2 border-blue-500 rounded-full flex items-center justify-center animate-pulse"
                                    style={{
                                        left: hoverPos.x - 16,
                                        top: hoverPos.y - 16
                                    }}
                                >
                                    <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                                </div>
                            )}

                            {/* Clinical Grid Overlay */}
                            <div className="absolute inset-0 pointer-events-none opacity-10">
                                <div className="w-full h-full bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[size:20%_20%]"></div>
                            </div>
                        </div>
                        <div className="px-4">
                            <input
                                type="range"
                                className="w-full h-1.5 bg-white border border-blue-100 rounded-full appearance-none cursor-pointer accent-blue-600 shadow-sm"
                                min={0}
                                max={patientSeries.length - 1}
                                value={currentPatientIndex}
                                onChange={(e) => handlePatientChange(parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Action Bar */}
            <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/70 backdrop-blur-2xl border border-blue-100 rounded-[2rem] px-8 py-5 shadow-[0_20px_50px_rgba(59,130,246,0.15)] flex items-center gap-12 z-40 transition-all hover:bg-white animate-in slide-in-from-bottom-8">
                <div className="flex items-center gap-6 border-r border-blue-100 pr-10">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-1">Mode Actif</span>
                        <span className="text-sm font-bold text-blue-900 whitespace-nowrap">Identification Dynamique</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <Target className="w-5 h-5 text-blue-600 animate-pulse" />
                    </div>
                </div>

                <div className="flex gap-4">
                    <button className="flex items-center gap-2 px-6 py-3 bg-blue-900 text-white text-sm font-bold rounded-2xl transition-all hover:bg-blue-800 hover:shadow-xl hover:-translate-y-0.5 active:scale-95">
                        <FileText className="w-4 h-4" /> Générer Rapport
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-white text-blue-900 text-sm font-bold rounded-2xl transition-all border border-blue-100 hover:bg-blue-50 active:scale-95 shadow-sm">
                        Captures
                    </button>
                </div>
            </footer>
        </div>
    );
}
