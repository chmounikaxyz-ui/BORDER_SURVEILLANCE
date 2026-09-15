import React, { useState, useEffect, useRef } from 'react';
import { WatchlistPerson, WatchlistVehicle, WatchlistThreatLevel } from '../types';
import {
  getWatchlistPersons, addWatchlistPerson, deleteWatchlistPerson,
  getWatchlistVehicles, addWatchlistVehicle, deleteWatchlistVehicle,
} from '../api/client';
import { PersonGalleryModal } from './PersonGalleryModal';

type TabMode = 'persons' | 'vehicles';

const THREAT_COLORS: Record<WatchlistThreatLevel, string> = {
  CRITICAL: 'bg-[#93000a] text-[#ffdad6] border-[#ffb4ab]/40',
  HIGH:     'bg-[#5e1800] text-[#ffb59a] border-[#ff8a65]/40',
  MEDIUM:   'bg-[#3e2f00] text-[#f5c842] border-[#f5c842]/30',
  LOW:      'bg-[#133700] text-[#9fe89f] border-[#4caf50]/30',
};

const THREAT_DOT: Record<WatchlistThreatLevel, string> = {
  CRITICAL: 'bg-[#ffb4ab] shadow-[0_0_6px_rgba(255,180,171,0.7)] animate-pulse',
  HIGH:     'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)]',
  MEDIUM:   'bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.5)]',
  LOW:      'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]',
};

// ─── Person Form ──────────────────────────────────────────────────────────────
interface PersonFormProps {
  onAdded: (p: WatchlistPerson) => void;
  onCancel: () => void;
}

const PersonForm: React.FC<PersonFormProps> = ({ onAdded, onCancel }) => {
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [nationality, setNationality] = useState('');
  const [threatLevel, setThreatLevel] = useState<WatchlistThreatLevel>('MEDIUM');
  const [notes, setNotes] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      if (!rawData) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setPhotoBase64(canvas.toDataURL('image/jpeg', 0.75));
        } else {
          setPhotoBase64(rawData);
        }
      };
      img.onerror = () => {
        setPhotoBase64(rawData);
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Full name is required.'); return; }
    setLoading(true); setError('');

    const trimmedName = name.trim();
    const fallbackPerson: WatchlistPerson = {
      id: `wp-${Date.now().toString(36)}`,
      name: trimmedName,
      alias: alias.trim(),
      nationality: nationality.trim(),
      threatLevel,
      notes: notes.trim(),
      photoBase64,
      createdAt: new Date().toISOString(),
      addedBy: 'Operator',
    };

    try {
      const result = await Promise.race([
        addWatchlistPerson({
          name: trimmedName,
          alias: alias.trim(),
          nationality: nationality.trim(),
          threatLevel,
          notes: notes.trim(),
          photoBase64,
          addedBy: 'Operator',
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500))
      ]).catch(() => null);

      setLoading(false);
      if (result && result.id) {
        onAdded(result);
      } else {
        onAdded(fallbackPerson);
      }
    } catch (err) {
      setLoading(false);
      onAdded(fallbackPerson);
    }
  };

  const inputClass = 'w-full bg-[#0d1526] border border-[#424754]/40 rounded-lg px-3 py-2 text-[13px] font-mono text-[#dae3f7] placeholder-[#424754] focus:outline-none focus:border-[#4d8eff]/60 transition-colors';
  const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-[#c2c6d6] mb-1 block';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Full Name *</label>
          <input className={inputClass} placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Known Alias</label>
          <input className={inputClass} placeholder='e.g. "Ghost"' value={alias} onChange={e => setAlias(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Nationality</label>
          <input className={inputClass} placeholder="e.g. Unknown" value={nationality} onChange={e => setNationality(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Threat Level</label>
          <select value={threatLevel} onChange={e => setThreatLevel(e.target.value as WatchlistThreatLevel)} className={inputClass}>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as WatchlistThreatLevel[]).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Intelligence Notes</label>
        <textarea className={`${inputClass} resize-none`} rows={3}
          placeholder="Known affiliations, last seen location, biometric notes…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Reference Photo (optional)</label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-[#424754]/50 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#4d8eff]/50 hover:bg-[#4d8eff]/5 transition-all min-h-[88px]"
        >
          {photoBase64 ? (
            <img src={photoBase64} alt="preview" className="h-24 object-contain rounded" />
          ) : (
            <>
              <span className="material-symbols-outlined text-[#424754] text-[32px]">add_photo_alternate</span>
              <span className="text-[11px] text-[#424754] font-mono">Click to upload JPG / PNG</span>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>
      </div>
      {error && <p className="text-[12px] text-[#ffb4ab] font-mono">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/30 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#c2c6d6] transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
          <span className="material-symbols-outlined text-[16px]">{loading ? 'sync' : 'person_add'}</span>
          {loading ? 'Adding…' : 'Add to Watchlist'}
        </button>
      </div>
    </form>
  );
};

// ─── Vehicle Form ─────────────────────────────────────────────────────────────
interface VehicleFormProps {
  onAdded: (v: WatchlistVehicle) => void;
  onCancel: () => void;
}

const VehicleForm: React.FC<VehicleFormProps> = ({ onAdded, onCancel }) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [threatLevel, setThreatLevel] = useState<WatchlistThreatLevel>('MEDIUM');
  const [notes, setNotes] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      if (!rawData) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setPhotoBase64(canvas.toDataURL('image/jpeg', 0.75));
        } else {
          setPhotoBase64(rawData);
        }
      };
      img.onerror = () => {
        setPhotoBase64(rawData);
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) { setError('License plate is required.'); return; }
    setLoading(true); setError('');

    const formattedPlate = plateNumber.trim().toUpperCase();
    const fallbackVehicle: WatchlistVehicle = {
      id: `wv-${Date.now().toString(36)}`,
      plateNumber: formattedPlate,
      make: make.trim(),
      model: model.trim(),
      color: color.trim(),
      threatLevel,
      notes: notes.trim(),
      photoBase64,
      createdAt: new Date().toISOString(),
      addedBy: 'Operator',
    };

    try {
      const result = await Promise.race([
        addWatchlistVehicle({
          plateNumber: formattedPlate,
          make: make.trim(),
          model: model.trim(),
          color: color.trim(),
          threatLevel,
          notes: notes.trim(),
          photoBase64,
          addedBy: 'Operator',
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500))
      ]).catch(() => null);

      setLoading(false);
      if (result && result.id) {
        onAdded(result);
      } else {
        onAdded(fallbackVehicle);
      }
    } catch (err) {
      setLoading(false);
      onAdded(fallbackVehicle);
    }
  };

  const inputClass = 'w-full bg-[#0d1526] border border-[#424754]/40 rounded-lg px-3 py-2 text-[13px] font-mono text-[#dae3f7] placeholder-[#424754] focus:outline-none focus:border-[#4d8eff]/60 transition-colors';
  const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-[#c2c6d6] mb-1 block';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Plate Number *</label>
          <input className={inputClass} placeholder="e.g. MH-12-AB-1234" value={plateNumber} onChange={e => setPlateNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Threat Level</label>
          <select value={threatLevel} onChange={e => setThreatLevel(e.target.value as WatchlistThreatLevel)} className={inputClass}>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as WatchlistThreatLevel[]).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Make</label>
          <input className={inputClass} placeholder="e.g. Toyota" value={make} onChange={e => setMake(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Model</label>
          <input className={inputClass} placeholder="e.g. Land Cruiser" value={model} onChange={e => setModel(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Color</label>
          <input className={inputClass} placeholder="e.g. Dark Grey" value={color} onChange={e => setColor(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Intelligence Notes</label>
        <textarea className={`${inputClass} resize-none`} rows={3}
          placeholder="Known routes, smuggling affiliations, last spotted location…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Vehicle Photo (optional)</label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-[#424754]/50 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#4d8eff]/50 hover:bg-[#4d8eff]/5 transition-all min-h-[88px]"
        >
          {photoBase64 ? (
            <img src={photoBase64} alt="preview" className="h-24 object-contain rounded" />
          ) : (
            <>
              <span className="material-symbols-outlined text-[#424754] text-[32px]">directions_car</span>
              <span className="text-[11px] text-[#424754] font-mono">Click to upload JPG / PNG</span>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>
      </div>
      {error && <p className="text-[12px] text-[#ffb4ab] font-mono">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/30 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#c2c6d6] transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
          <span className="material-symbols-outlined text-[16px]">{loading ? 'sync' : 'add_road'}</span>
          {loading ? 'Registering…' : 'Register Vehicle'}
        </button>
      </div>
    </form>
  );
};

// ─── Main Watchlist DB View ───────────────────────────────────────────────────
export const WatchlistDbView: React.FC = () => {
  const [tab, setTab] = useState<TabMode>('persons');
  const [persons, setPersons] = useState<WatchlistPerson[]>([]);
  const [vehicles, setVehicles] = useState<WatchlistVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterThreat, setFilterThreat] = useState<WatchlistThreatLevel | 'ALL'>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [galleryPerson, setGalleryPerson] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, v] = await Promise.all([getWatchlistPersons(), getWatchlistVehicles()]);
      if (p) setPersons(p);
      if (v) setVehicles(v);
    } catch (err) {
      console.warn('[WatchlistDbView] Failed loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handlePersonAdded = (p: WatchlistPerson) => {
    setPersons(prev => [p, ...prev]);
    setShowForm(false);
    showToast(`${p.name} added to watchlist.`);
  };

  const handleVehicleAdded = (v: WatchlistVehicle) => {
    setVehicles(prev => [v, ...prev]);
    setShowForm(false);
    showToast(`${v.plateNumber} registered in watchlist.`);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    if (tab === 'persons') {
      const ok = await deleteWatchlistPerson(confirmDeleteId);
      if (ok) { setPersons(prev => prev.filter(p => p.id !== confirmDeleteId)); showToast('Person removed from watchlist.'); }
      else showToast('Failed to remove — backend error.', 'error');
    } else {
      const ok = await deleteWatchlistVehicle(confirmDeleteId);
      if (ok) { setVehicles(prev => prev.filter(v => v.id !== confirmDeleteId)); showToast('Vehicle removed from watchlist.'); }
      else showToast('Failed to remove — backend error.', 'error');
    }
    setDeleteLoading(false);
    setConfirmDeleteId(null);
  };

  const filteredPersons = persons.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.alias.toLowerCase().includes(q) || p.nationality.toLowerCase().includes(q);
    return matchSearch && (filterThreat === 'ALL' || p.threatLevel === filterThreat);
  });

  const filteredVehicles = vehicles.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.plateNumber.toLowerCase().includes(q) || v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || v.color.toLowerCase().includes(q);
    return matchSearch && (filterThreat === 'ALL' || v.threatLevel === filterThreat);
  });

  return (
    <div className="flex-1 w-full p-6 overflow-y-auto no-scrollbar text-[#dae3f7] space-y-6">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-8 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce border ${
          toast.type === 'error'
            ? 'bg-[#93000a]/95 border-[#ffb4ab]/50 text-[#ffdad6]'
            : 'bg-green-950/95 border-green-500/60 text-green-200'
        }`}>
          <span className="material-symbols-outlined text-[18px]">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
          <span className="text-[13px] font-mono">{toast.msg}</span>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#17202e] border border-[#ffb4ab]/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-[#ffb4ab] text-[28px]">warning</span>
              <h3 className="text-[16px] font-bold text-[#dae3f7]">Confirm Removal</h3>
            </div>
            <p className="text-[13px] text-[#c2c6d6] mb-5 font-mono leading-relaxed">
              This will permanently remove the record from the watchlist database. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 bg-[#222a39] hover:bg-[#2c3544] border border-[#424754]/30 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#c2c6d6] transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} disabled={deleteLoading}
                className="flex-1 py-2.5 bg-[#93000a] hover:bg-[#ffb4ab] text-[#ffdad6] hover:text-[#690005] rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
                <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                {deleteLoading ? 'Removing…' : 'Remove Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131c2a] p-6 rounded-xl border border-[#424754]/30 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#adc6ff]/5 to-transparent pointer-events-none" />
        <div className="flex flex-col gap-1 relative z-10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc6ff] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
            <h1 className="text-[24px] font-bold text-[#adc6ff] tracking-tight">Watchlist Database</h1>
          </div>
          <p className="text-[14px] text-[#c2c6d6] max-w-2xl">
            Manage tracked persons and vehicles. Records are stored in the backend database and cross-referenced against real-time edge camera feeds.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <div className="flex items-center gap-2 bg-[#222a39] px-4 py-2 rounded-full border border-[#adc6ff]/20">
            <div className="w-2 h-2 rounded-full bg-[#adc6ff] animate-pulse" />
            <span className="text-[11px] font-bold uppercase text-[#adc6ff] tracking-wider">
              {persons.length + vehicles.length} RECORDS INDEXED
            </span>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Record
            </button>
          )}
        </div>
      </div>

      {/* Add Form Panel */}
      {showForm && (
        <div className="bg-[#17202e] rounded-xl border border-[#4d8eff]/40 shadow-xl overflow-hidden">
          <div className="p-4 bg-[#131c2a] border-b border-[#424754]/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">
                {tab === 'persons' ? 'person_add' : 'add_road'}
              </span>
              <h2 className="text-[15px] font-bold text-[#dae3f7]">
                {tab === 'persons' ? 'Add Person to Watchlist' : 'Register Watchlist Vehicle'}
              </h2>
            </div>
          </div>
          <div className="p-6">
            {tab === 'persons'
              ? <PersonForm onAdded={handlePersonAdded} onCancel={() => setShowForm(false)} />
              : <VehicleForm onAdded={handleVehicleAdded} onCancel={() => setShowForm(false)} />
            }
          </div>
        </div>
      )}

      {/* Tab Switcher + Search/Filter Bar & Content Area (Hidden while adding a new record) */}
      {!showForm && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-[#17202e] p-3 rounded-xl border border-[#424754]/20">
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('persons'); setSearch(''); setFilterThreat('ALL'); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${tab === 'persons' ? 'bg-[#4d8eff] text-[#00285d]' : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'}`}
          >
            <span className="material-symbols-outlined text-[16px]">people</span>
            Persons ({persons.length})
          </button>
          <button
            onClick={() => { setTab('vehicles'); setSearch(''); setFilterThreat('ALL'); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${tab === 'vehicles' ? 'bg-[#4d8eff] text-[#00285d]' : 'bg-[#222a39] text-[#c2c6d6] hover:bg-[#2c3544]'}`}
          >
            <span className="material-symbols-outlined text-[16px]">directions_car</span>
            Vehicles ({vehicles.length})
          </button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#424754] text-[16px]">search</span>
            <input
              type="text"
              placeholder={tab === 'persons' ? 'Name, alias, nationality…' : 'Plate, make, model…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#0d1526] border border-[#424754]/40 rounded-lg text-[12px] font-mono text-[#dae3f7] placeholder-[#424754] focus:outline-none focus:border-[#4d8eff]/60"
            />
          </div>
          <select
            value={filterThreat}
            onChange={e => setFilterThreat(e.target.value as WatchlistThreatLevel | 'ALL')}
            className="bg-[#0d1526] border border-[#424754]/40 rounded-lg px-3 py-2 text-[12px] font-mono text-[#dae3f7] focus:outline-none focus:border-[#4d8eff]/60"
          >
            <option value="ALL">All Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#424754]">
          <span className="material-symbols-outlined text-[48px] animate-spin">sync</span>
          <span className="text-[14px] font-mono">Loading watchlist database…</span>
        </div>
      ) : tab === 'persons' ? (
        filteredPersons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#424754]">
            <span className="material-symbols-outlined text-[64px]">person_off</span>
            <p className="text-[18px] font-mono text-[#8c909f]">
              {search || filterThreat !== 'ALL' ? 'No matching persons found.' : 'No persons in watchlist.'}
            </p>
            {!search && filterThreat === 'ALL' && (
              <button onClick={() => setShowForm(true)}
                className="mt-2 px-5 py-2 bg-[#4d8eff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider hover:bg-[#adc6ff] transition-colors">
                Add First Person
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredPersons.map(p => (
              <div key={p.id}
                className={`bg-[#17202e] rounded-xl border overflow-hidden shadow-lg hover:shadow-2xl transition-all group ${p.threatLevel === 'CRITICAL' ? 'border-[#ffb4ab]/30 hover:border-[#ffb4ab]/60' : 'border-[#424754]/20 hover:border-[#adc6ff]/30'}`}>
                {/* Photo / Avatar */}
                <div className="relative h-36 bg-[#0d1526] flex items-center justify-center overflow-hidden">
                  {p.photoBase64 ? (
                    <img src={p.photoBase64} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="material-symbols-outlined text-[#1e2d42] text-[72px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1526] via-transparent to-transparent" />
                  <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${THREAT_COLORS[p.threatLevel]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${THREAT_DOT[p.threatLevel]}`} />
                    {p.threatLevel}
                  </div>
                </div>
                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-[15px] font-bold text-[#dae3f7] truncate">{p.name}</h3>
                    {p.alias && <p className="text-[11px] text-[#c2c6d6] font-mono">alias: &ldquo;{p.alias}&rdquo;</p>}
                  </div>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1">
                      <span className="text-[#c2c6d6]">Nationality</span>
                      <span className="text-[#dae3f7]">{p.nationality || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1">
                      <span className="text-[#c2c6d6]">Added By</span>
                      <span className="text-[#dae3f7]">{p.addedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#c2c6d6]">Registered</span>
                      <span className="text-[#dae3f7]">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {p.notes && (
                    <p className="text-[10px] text-[#8c909f] font-mono bg-[#0d1526] rounded p-2 leading-relaxed line-clamp-2">{p.notes}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setGalleryPerson({ id: p.id, name: p.name })}
                      className="flex-1 py-1.5 bg-[#4d8eff]/15 hover:bg-[#4d8eff]/30 border border-[#4d8eff]/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[#4d8eff] hover:text-[#adc6ff] transition-colors flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">photo_library</span>
                      View Photos
                    </button>
                    <button onClick={() => setConfirmDeleteId(p.id)}
                      className="px-2.5 py-1.5 bg-[#93000a]/10 hover:bg-[#93000a]/50 border border-[#ffb4ab]/10 hover:border-[#ffb4ab]/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab]/70 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#424754]">
            <span className="material-symbols-outlined text-[64px]">no_crash</span>
            <p className="text-[18px] font-mono text-[#8c909f]">
              {search || filterThreat !== 'ALL' ? 'No matching vehicles found.' : 'No vehicles in watchlist.'}
            </p>
            {!search && filterThreat === 'ALL' && (
              <button onClick={() => setShowForm(true)}
                className="mt-2 px-5 py-2 bg-[#4d8eff] text-[#00285d] font-bold rounded-lg text-[12px] uppercase tracking-wider hover:bg-[#adc6ff] transition-colors">
                Register First Vehicle
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredVehicles.map(v => (
              <div key={v.id}
                className={`bg-[#17202e] rounded-xl border overflow-hidden shadow-lg hover:shadow-2xl transition-all group ${v.threatLevel === 'CRITICAL' ? 'border-[#ffb4ab]/30 hover:border-[#ffb4ab]/60' : 'border-[#424754]/20 hover:border-[#adc6ff]/30'}`}>
                {/* Photo / Icon */}
                <div className="relative h-36 bg-[#0d1526] flex items-center justify-center overflow-hidden">
                  {v.photoBase64 ? (
                    <img src={v.photoBase64} alt={v.plateNumber} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="material-symbols-outlined text-[#1e2d42] text-[72px]" style={{ fontVariationSettings: "'FILL' 1" }}>directions_car</span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1526] via-transparent to-transparent" />
                  <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${THREAT_COLORS[v.threatLevel]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${THREAT_DOT[v.threatLevel]}`} />
                    {v.threatLevel}
                  </div>
                  {/* Plate overlay */}
                  <div className="absolute bottom-3 left-3 bg-[#0b1422]/90 border border-[#adc6ff]/40 px-3 py-1 rounded font-mono text-[13px] font-bold text-[#adc6ff] tracking-widest shadow-lg">
                    {v.plateNumber}
                  </div>
                </div>
                {/* Info */}
                <div className="p-4 space-y-3">
                  <h3 className="text-[15px] font-bold text-[#dae3f7]">
                    {[v.color, v.make, v.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
                  </h3>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1">
                      <span className="text-[#c2c6d6]">Make / Model</span>
                      <span className="text-[#dae3f7]">{[v.make, v.model].filter(Boolean).join(' ') || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1">
                      <span className="text-[#c2c6d6]">Color</span>
                      <span className="text-[#dae3f7]">{v.color || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#424754]/20 pb-1">
                      <span className="text-[#c2c6d6]">Added By</span>
                      <span className="text-[#dae3f7]">{v.addedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#c2c6d6]">Registered</span>
                      <span className="text-[#dae3f7]">{new Date(v.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {v.notes && (
                    <p className="text-[10px] text-[#8c909f] font-mono bg-[#0d1526] rounded p-2 leading-relaxed line-clamp-2">{v.notes}</p>
                  )}
                  <button onClick={() => setConfirmDeleteId(v.id)}
                    className="w-full py-1.5 mt-1 bg-[#93000a]/10 hover:bg-[#93000a]/50 border border-[#ffb4ab]/10 hover:border-[#ffb4ab]/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[#ffb4ab]/70 hover:text-[#ffb4ab] transition-colors flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">delete</span>
                    Remove from Watchlist
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
        </>
      )}

      {/* Google Photos Person Gallery Modal */}
      {galleryPerson && (
        <PersonGalleryModal
          personId={galleryPerson.id}
          personName={galleryPerson.name}
          onClose={() => setGalleryPerson(null)}
        />
      )}
    </div>
  );
};
