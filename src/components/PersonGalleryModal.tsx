import React, { useState, useEffect } from 'react';
import { getPersonPhotos, PersonDetectedPhoto, PersonPhotosResponse } from '../api/client';

interface PersonGalleryModalProps {
  personId: string | null;
  personName: string;
  onClose: () => void;
}

export const PersonGalleryModal: React.FC<PersonGalleryModalProps> = ({
  personId,
  personName,
  onClose,
}) => {
  const [data, setData] = useState<PersonPhotosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<PersonDetectedPhoto | null>(null);
  const [minScore, setMinScore] = useState<number>(0);

  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    getPersonPhotos(personId).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [personId]);

  if (!personId) return null;

  const photos = (data?.photos || []).filter((p) => p.similarityScore >= minScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-8 animate-fadeIn">
      <div className="bg-[#0f172a] border border-[#334155] rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#e2e8f0]">
        {/* Top Header */}
        <div className="p-5 bg-[#1e293b]/90 border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-4">
            {data?.person?.photoBase64 ? (
              <img
                src={data.person.photoBase64}
                alt={personName}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#3b82f6] shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#3b82f6]/20 border-2 border-[#3b82f6] flex items-center justify-center text-[#3b82f6]">
                <span className="material-symbols-outlined text-[28px]">person</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white tracking-wide font-mono">
                  {personName.toUpperCase()}
                </h2>
                <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase rounded-full bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#fca5a5]">
                  {data?.person?.threatLevel || 'WATCHLIST'} TARGET
                </span>
              </div>
              <p className="text-[12px] text-[#94a3b8] font-mono mt-0.5">
                Google Photos Biometric Cluster • {data?.totalMatches || 0} Total Detected Photos & Evidence Captures
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#334155]/50 hover:bg-[#334155] text-[#94a3b8] hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-3 bg-[#0f172a] border-b border-[#334155]/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono text-[#94a3b8]">Min Match Score:</span>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="accent-[#3b82f6] cursor-pointer"
            />
            <span className="text-[12px] font-mono font-bold text-[#3b82f6]">{minScore}%+</span>
          </div>

          <div className="text-[12px] font-mono text-[#64748b]">
            Showing {photos.length} of {data?.totalMatches || 0} captures
          </div>
        </div>

        {/* Photos Grid Body */}
        <div className="flex-1 p-6 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[13px] font-mono text-[#94a3b8]">Extracting deep feature photo embeddings…</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#475569]">photo_library</span>
              <p className="text-base font-bold text-[#cbd5e1]">No Face Captures Found</p>
              <p className="text-[13px] text-[#64748b] max-w-md font-mono">
                No live surveillance captures match this target above {minScore}% confidence yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedPhoto(item)}
                  className="group relative bg-[#1e293b] border border-[#334155]/60 rounded-xl overflow-hidden cursor-pointer hover:border-[#3b82f6] hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all flex flex-col"
                >
                  <div className="relative aspect-square w-full bg-[#020617] overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt="Captured Face"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-[#60a5fa] border border-[#3b82f6]/30">
                      {item.similarityScore}% Match
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#1e293b] flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#e2e8f0]">
                      <span className="font-bold text-[#93c5fd]">{item.cameraCode}</span>
                      <span className="text-[10px] text-[#94a3b8]">{item.type}</span>
                    </div>
                    <p className="text-[10px] font-mono text-[#64748b] truncate">
                      {item.timestamp || 'Just now'} • {item.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1e293b]/90 border-t border-[#334155] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#334155] hover:bg-[#475569] text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors"
          >
            Close Gallery
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f172a] border border-[#334155] rounded-2xl max-w-3xl w-full p-6 flex flex-col gap-4 shadow-2xl relative"
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 text-[#94a3b8] hover:text-white"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <div className="max-h-[60vh] flex items-center justify-center bg-black rounded-xl overflow-hidden p-2">
              <img
                src={selectedPhoto.imageUrl}
                alt="Enlarged Biometric Face"
                className="max-h-[55vh] object-contain rounded-lg"
              />
            </div>

            <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155] flex flex-col gap-2 font-mono text-xs text-[#e2e8f0]">
              <div className="flex justify-between items-center">
                <span className="text-[#94a3b8]">Target Subject:</span>
                <span className="font-bold text-[#60a5fa]">{personName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#94a3b8]">Cosine Similarity Confidence:</span>
                <span className="font-bold text-green-400">{selectedPhoto.similarityScore}% Match</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#94a3b8]">Capture Node:</span>
                <span>{selectedPhoto.cameraCode} ({selectedPhoto.location})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#94a3b8]">Timestamp:</span>
                <span>{selectedPhoto.timestamp}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
