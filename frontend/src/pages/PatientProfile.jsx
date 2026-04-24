import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useParams, useNavigate } from 'react-router-dom';
import { 
	User, Calendar, Mail, Phone, FileImage, 
	CheckCircle, AlertTriangle, Edit, Trash2, 
	Lock, ShieldCheck, ChevronRight, ChevronDown, 
	Eye, Download, Edit3, ArrowLeftRight, Star, 
	History, Plus, Settings, MoreVertical, 
	FileText, Activity, Layers, Boxes 
} from 'lucide-react';

// Enhanced Mock Data to support the Timeline redesign
const fetchPatientFull = async (id) => {
	await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay
	return {
		id,
		nom: 'Dupont',
		prenom: 'Marie',
		num_dossier: 'DOS-2024-0013',
		created_at: '2024-03-01',
		date_naissance: '1972-06-15',
		sexe: 'Féminin',
		telephone: '06 12 34 56 78',
		email: 'marie.dupont@hopital.com',
		pathologie: 'Alzheimer',
		stade: 'Modéré',
		notes: 'Patiente suivie pour troubles mnésiques évolutifs.',
		anonymisation: true,
		original_folder: {
			date: '08 novembre 2024',
			file_count: 4,
			files: [
				{ name: 'IRM_T1_baseline.nii.gz', type: 'IRM T1', size: '18.4 MB', date: '08 nov. 2024' },
				{ name: 'IRM_T2_FLAIR.nii.gz', type: 'IRM T2 FLAIR', size: '16.1 MB', date: '08 nov. 2024' },
				{ name: 'Compte_rendu_initial.pdf', type: 'Rapport', size: '412 KB', date: '08 nov. 2024' },
				{ name: 'Anamnese_neurologique.pdf', type: 'Anamnèse', size: '284 KB', date: '08 nov. 2024' },
			]
		},
		sessions: [
			{
				id: 3,
				title: 'Nouvelle analyse',
				session_num: 'Session #3',
				date: '12 avril 2026',
				time: '15:32',
				author: 'Dr. Karim Haddad',
				role: 'Neuro-radiologue',
				note: 'Suivi à 18 mois — comparaison avec baseline.',
				is_new: true,
				groups: [
					{
						type: 'registration',
						label: "Recalage d'images",
						count: 1,
						color: 'violet',
						files: [
							{ name: 'recalage_T1_vs_baseline.nii.gz', type: 'NIfTI', size: '19.2 MB' }
						]
					},
					{
						type: 'segmentation',
						label: 'Segmentation volumétrique de l\'hippocampe',
						count: 2,
						color: 'emerald',
						files: [
							{ name: 'mask_hippocampus_left.nii.gz', type: 'Mask', size: '2.4 MB' },
							{ name: 'mask_hippocampus_right.nii.gz', type: 'Mask', size: '2.5 MB' }
						]
					},
					{
						type: 'reconstruction',
						label: 'Reconstruction 3D corticale',
						count: 2,
						color: 'orange',
						files: [
							{ name: 'cortex_mesh_simplified.obj', type: 'Mesh', size: '45.1 MB' },
							{ name: 'reconstruction_report.pdf', type: 'Analyse', size: '1.2 MB' }
						]
					}
				]
			}
		]
	};
};

const ANALYSIS_COLORS = {
	registration: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', icon: Boxes, badge: 'rgba(var(--type-registration), 0.1)' },
	segmentation: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: Layers, badge: 'rgba(var(--type-segmentation), 0.1)' },
	reconstruction: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', icon: Activity, badge: 'rgba(var(--type-reconstruction), 0.1)' },
};

function Badge({ children, type = 'blue', pulse = false }) {
	const colors = {
		blue: 'bg-blue-100 text-blue-700',
		green: 'bg-emerald-100 text-emerald-700',
		violet: 'bg-violet-100 text-violet-700',
		orange: 'bg-orange-100 text-orange-700',
		gray: 'bg-slate-100 text-slate-600',
		darkBlue: 'bg-[#1e3a8a] text-white',
	};
	return (
		<span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[type]} ${pulse ? 'pulse-green' : ''}`}>
			{children}
		</span>
	);
}

function FileActionRow({ file, sessionColor }) {
	return (
		<div className="group flex items-center justify-between p-3 mr-2 bg-white border border-slate-100/60 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all duration-200">
			<div className="flex items-center gap-3">
				<div className={`p-2 rounded-lg ${sessionColor ? `bg-${sessionColor}-50` : 'bg-slate-50'}`}>
					<FileText className={`w-4 h-4 ${sessionColor ? `text-${sessionColor}-600` : 'text-slate-400'}`} />
				</div>
				<div>
					<div className="text-sm font-semibold text-slate-800">{file.name}</div>
					<div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
						<span className="uppercase">{file.type}</span> • {file.size}
					</div>
				</div>
			</div>
			
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<button title="Voir" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
				<button title="Télécharger" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Download className="w-4 h-4" /></button>
				<button title="Annoter" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
				<button title="Comparer" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><ArrowLeftRight className="w-4 h-4" /></button>
			</div>
		</div>
	);
}

function SessionCard({ session }) {
	const [isOpen, setIsOpen] = useState(true);

	return (
		<div className="relative pl-12 pb-12">
			{/* Timeline Dot */}
			<div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
				<div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md border-4 border-white ${session.is_new ? 'bg-emerald-500 text-white pulse-green' : 'bg-blue-600 text-white'}`}>
					{session.is_new ? <Star className="w-5 h-5 fill-current" /> : <Plus className="w-5 h-5" />}
				</div>
			</div>

			<div className={`bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden ${isOpen ? 'border-emerald-500 shadow-xl shadow-emerald-500/5' : 'border-slate-100 shadow-sm hover:border-slate-200'}`}>
				{/* Session Header */}
				<div className="p-6 cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
					<div className="flex items-start justify-between">
						<div>
							<div className="flex items-center gap-3 mb-2">
								{session.is_new && <Badge type="green" pulse>Nouvelle analyse</Badge>}
								<h3 className="text-lg font-extrabold text-slate-900 tracking-tight">{session.session_num}</h3>
								<div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
									<Calendar className="w-4 h-4" /> {session.date} • {session.time}
								</div>
							</div>
							<div className="flex items-center gap-2 mb-4">
								<div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
									{session.author.split(' ').map(n=>n[0]).join('')}
								</div>
								<div className="text-sm">
									<span className="font-bold text-slate-700">{session.author}</span>
									<span className="mx-2 text-slate-300">•</span>
									<span className="text-slate-500">{session.role}</span>
								</div>
							</div>
							{session.note && (
								<p className="text-sm text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100 italic">
									"{session.note}"
								</p>
							)}
						</div>
						<div className="flex items-center gap-4">
							<div className="flex gap-2">
								{session.groups.map((g, idx) => (
									<div key={idx} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${ANALYSIS_COLORS[g.type]?.bg} ${ANALYSIS_COLORS[g.type]?.text} text-[10px] font-bold border ${ANALYSIS_COLORS[g.type]?.border}`}>
										{React.createElement(ANALYSIS_COLORS[g.type]?.icon, { className: 'w-3.5 h-3.5' })}
										{g.label} <span className="opacity-60">{g.count}</span>
									</div>
								))}
							</div>
							<div className={`p-2 rounded-xl transition-colors ${isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
								{isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
							</div>
						</div>
					</div>
				</div>

				{/* Session Content */}
				{isOpen && (
					<div className="px-6 pb-6 space-y-6">
						{session.groups.map((group, gIdx) => (
							<div key={gIdx} className="space-y-3">
								<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 px-1">
									{React.createElement(ANALYSIS_COLORS[group.type]?.icon, { className: `w-4 h-4 ${ANALYSIS_COLORS[group.type]?.text}` })}
									{group.label} <span className="ml-1 text-slate-300">({group.count})</span>
								</div>
								<div className="grid grid-cols-1 gap-2 border-l-2 ml-2 pl-4" style={{ borderColor: ANALYSIS_COLORS[group.type]?.text.replace('text-', 'var(--') }}>
									{group.files.map((file, fIdx) => (
										<FileActionRow key={fIdx} file={file} sessionColor={group.color} />
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default function PatientProfile() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [patient, setPatient] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetchPatientFull(id).then(p => { setPatient(p); setLoading(false); });
	}, [id]);

	if (loading) return (
		<div className="flex min-h-screen bg-[#f8fafc]">
			<Sidebar />
			<main className="flex-1 ml-64 flex items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
					<div className="text-slate-500 font-bold tracking-tight">Chargement du dossier clinique...</div>
				</div>
			</main>
		</div>
	);

	if (!patient) return <div className="p-10 text-center text-red-600">Patient introuvable.</div>;

	return (
		<div className="flex min-h-screen bg-[#f1f5f9] font-['Inter']">
			<Sidebar />
			<main className="flex-1 ml-64 overflow-y-auto">
				{/* Premium Header Container */}
				<div className="relative">
					<div className="h-48 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 absolute top-0 left-0 right-0 z-0"></div>
					
					{/* Header Content */}
					<div className="relative z-10 max-w-6xl mx-auto pt-10 px-8">
						<div className="flex items-end justify-between gap-6 pb-6">
							<div className="flex items-center gap-6">
								<div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-md border-[6px] border-white/20 flex items-center justify-center text-white text-4xl font-black shadow-2xl overflow-hidden relative group">
									<div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-20 transition-opacity"></div>
									{(patient.prenom?.[0]||'').toUpperCase()}{(patient.nom?.[0]||'').toUpperCase()}
								</div>
								<div className="mb-2">
									<div className="flex items-center gap-4 mb-3">
										<h1 className="text-3xl font-black text-white tracking-tighter shadow-sm">{patient.nom} {patient.prenom}</h1>
										<span className="px-4 py-1.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-widest leading-none">
											ID: {patient.num_dossier}
										</span>
									</div>
									<div className="flex items-center gap-4 text-blue-100/80 text-sm font-bold">
										<div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
											<Calendar className="w-4 h-4" /> Né le {new Date(patient.date_naissance).toLocaleDateString()}
										</div>
										<div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
											<User className="w-4 h-4" /> {patient.sexe}
										</div>
										<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs shadow-inner">
											<ShieldCheck className="w-4 h-4" /> Données Anonymisées
										</div>
									</div>
								</div>
							</div>
							<div className="flex gap-3 mb-2">
								<button className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md transition-all">
									<Settings className="w-5 h-5" />
								</button>
								<button className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black shadow-lg shadow-blue-900/20 transition-all active:scale-95">
									<History className="w-4 h-4" /> Nouvelle Session
								</button>
							</div>
						</div>
					</div>
				</div>

				<div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-12 gap-8 relative">
					{/* Layout Legend & Title */}
					<div className="col-span-12 flex items-center justify-between mb-2">
						<div>
							<h2 className="text-xl font-black text-slate-900 tracking-tight">Chronologie du dossier</h2>
							<p className="text-sm text-slate-500 font-medium mt-1">Du plus récent au plus ancien — le dossier initial sert de référence.</p>
						</div>
						<div className="flex items-center gap-6 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 rounded-full bg-blue-600"></div>
								<span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Original</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 rounded-full bg-emerald-500"></div>
								<span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nouveau</span>
							</div>
						</div>
					</div>

					{/* Timeline Layout */}
					<div className="col-span-12 relative">
						<div className="timeline-line"></div>

						{/* 1. Original Folder (Baseline) */}
						<div className="relative pl-12 pb-12">
							{/* Timeline Icon */}
							<div className="absolute left-[20px] top-4 -translate-x-1/2 z-10">
								<div className="w-10 h-10 rounded-full bg-blue-900 text-white flex items-center justify-center shadow-lg border-4 border-white">
									<Lock className="w-5 h-5" />
								</div>
							</div>

							{/* Card Content */}
							<div className="bg-[#e9f0ff]/50 rounded-3xl border border-blue-200/60 shadow-sm overflow-hidden">
								<div className="p-6">
									<div className="flex items-start justify-between mb-6">
										<div className="flex items-start gap-4">
											<div className="w-14 h-14 rounded-2xl bg-blue-900 flex items-center justify-center text-white shadow-xl">
												<Lock className="w-7 h-7" />
											</div>
											<div>
												<div className="flex items-center gap-3 mb-1">
													<h3 className="text-lg font-black text-blue-900">Dossier initial du patient</h3>
													<Badge type="darkBlue">Original</Badge>
												</div>
												<p className="text-sm text-blue-800/60 font-semibold uppercase tracking-wider">
													Lecture seule • Référence pour toutes les analyses ultérieures
												</p>
											</div>
										</div>
										<div className="bg-white/60 border border-white px-4 py-2 rounded-xl text-blue-900 font-black text-xs">
											{patient.original_folder.file_count} fichiers
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{patient.original_folder.files.map((file, i) => (
											<div key={i} className="flex items-center gap-4 bg-white/80 p-4 rounded-2xl border border-white hover:border-blue-300 transition-colors cursor-default">
												<div className="p-2.5 bg-blue-50 rounded-xl">
													<FileText className="w-5 h-5 text-blue-700" />
												</div>
												<div className="flex-1">
													<div className="font-bold text-blue-950 text-sm leading-tight">{file.name}</div>
													<div className="text-[10px] text-blue-600/60 font-bold uppercase mt-1 tracking-widest">{file.type} • {file.date} • {file.size}</div>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* 2. Analysis Sessions */}
						{patient.sessions.map((session, idx) => (
							<SessionCard key={idx} session={session} />
						))}
					</div>
				</div>
			</main>
		</div>
	);
}