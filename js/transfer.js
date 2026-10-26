/* ===================================================================
   TRANSFER QUEUE MANAGER — WEB MOCI
   Manages transfer queue to Micro SD Moci (Simulation & ESP32 API)
   =================================================================== */

class MociTransferManager {
  constructor() {
    this.queue = [];
    this.isTransferring = false;
    this.currentItem = null;
  }

  init() {
    this.bindEvents();
    this.renderQueue();
  }

  bindEvents() {
    const multiFileInput = document.getElementById('transferMultiFileInput');
    if (multiFileInput) {
      multiFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(f => this.addFileToQueue(f));
        multiFileInput.value = '';
      });
    }

    // Transfer dropzone
    const transferDropzone = document.getElementById('transferDropzone');
    if (transferDropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        transferDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          transferDropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        transferDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          transferDropzone.classList.remove('dragover');
        });
      });
      transferDropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        files.forEach(f => this.addFileToQueue(f));
      });
    }
  }

  addFileToQueue(file) {
    const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i);
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|bmp)$/i);

    if (!isAudio && !isImage) {
      if (window.mociUI) window.mociUI.showToast(`Format file "${file.name}" tidak didukung untuk Micro SD Moci.`, 'error');
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    const item = {
      id: 'queue-' + Date.now() + Math.random().toString(36).substr(2, 4),
      rawFile: file,
      name: file.name,
      size: sizeFormatted,
      type: isAudio ? 'audio' : 'image',
      status: 'pending', // 'pending', 'transferring', 'success', 'failed', 'cancelled'
      progress: 0,
      errorMessage: null,
      isCancelled: false
    };

    this.queue.push(item);
    this.renderQueue();

    if (window.mociUI) {
      window.mociUI.showToast(`"${file.name}" ditambahkan ke antrean transfer.`, 'info');
    }
  }

  queueTrackForTransfer(trackId) {
    const track = window.mociState.tracks.find(t => t.id === trackId);
    if (!track) return;

    if (track.location === 'sd') {
      if (window.mociUI) window.mociUI.showToast(`Lagu "${track.title}" sudah berada di Micro SD Moci.`, 'warning');
      return;
    }

    const item = {
      id: 'queue-track-' + Date.now(),
      name: `${track.title}.mp3`,
      size: track.sizeFormatted || '3.4 MB',
      type: 'audio',
      status: 'pending',
      progress: 0,
      isCancelled: false,
      trackRef: track
    };

    this.queue.push(item);
    this.renderQueue();

    if (window.mociUI) {
      window.mociUI.showToast(`"${item.name}" ditambahkan ke antrean Micro SD.`, 'info');
      window.mociUI.openModal('transferModal');
    }
  }

  queuePhotoForTransfer(photoId) {
    const photo = window.mociState.photos.find(p => p.id === photoId);
    if (!photo) return;

    if (photo.location === 'sd') {
      if (window.mociUI) window.mociUI.showToast(`Foto "${photo.name}" sudah berada di Micro SD Moci.`, 'warning');
      return;
    }

    const item = {
      id: 'queue-photo-' + Date.now(),
      name: `${photo.name}.bmp`,
      size: photo.size || '128 KB',
      type: 'image',
      status: 'pending',
      progress: 0,
      isCancelled: false,
      photoRef: photo
    };

    this.queue.push(item);
    this.renderQueue();

    if (window.mociUI) {
      window.mociUI.showToast(`"${item.name}" ditambahkan ke antrean Micro SD.`, 'info');
      window.mociUI.openModal('transferModal');
    }
  }

  async startQueueTransfer() {
    if (this.isTransferring) return;

    const pendingItems = this.queue.filter(i => i.status === 'pending');
    if (!pendingItems.length) {
      if (window.mociUI) window.mociUI.showToast('Tidak ada file dalam antrean yang menunggu transfer.', 'warning');
      return;
    }

    this.isTransferring = true;
    this.updateTransferControlsUI();

    for (const item of pendingItems) {
      if (item.isCancelled) continue;

      this.currentItem = item;
      item.status = 'transferring';
      this.renderQueue();

      try {
        await window.mociApi.transferFile(item, (percent) => {
          item.progress = percent;
          this.updateItemProgressUI(item.id, percent);
        });

        item.status = 'success';
        item.progress = 100;

        // If it was a local track or photo, mark it as synchronized
        if (item.trackRef) {
          item.trackRef.location = 'sd';
          window.mociState.saveTracks();
        }
        if (item.photoRef) {
          item.photoRef.location = 'sd';
          window.mociState.savePhotos();
        }

        window.mociState.logActivity('Transfer Selesai (Simulasi)', `"${item.name}" tersalin ke Micro SD.`);
      } catch (err) {
        if (item.isCancelled) {
          item.status = 'cancelled';
        } else {
          item.status = 'failed';
          item.errorMessage = err.message;
        }
      }

      this.renderQueue();
    }

    this.isTransferring = false;
    this.currentItem = null;
    this.updateTransferControlsUI();

    if (window.mociUI) {
      window.mociUI.showToast('Semua proses transfer selesai diproses.', 'success');
    }
  }

  cancelItem(itemId) {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) return;

    item.isCancelled = true;
    if (item.status === 'transferring') {
      item.status = 'cancelled';
    } else if (item.status === 'pending') {
      this.removeItem(itemId);
    }
    this.renderQueue();
  }

  removeItem(itemId) {
    this.queue = this.queue.filter(i => i.id !== itemId);
    this.renderQueue();
  }

  clearFinished() {
    this.queue = this.queue.filter(i => i.status === 'pending' || i.status === 'transferring');
    this.renderQueue();
  }

  renderQueue() {
    const container = document.getElementById('transferQueueList');
    if (!container) return;

    if (!this.queue.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 24px 0;">
          <div class="empty-state-icon" style="width: 48px; height: 48px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          </div>
          <div class="empty-state-title" style="font-size: 0.95rem;">Antrean Transfer Kosong</div>
          <div class="empty-state-desc" style="font-size: 0.8rem;">Pilih file audio atau foto untuk dikirimkan ke Micro SD Moci.</div>
        </div>
      `;
      this.updateTransferControlsUI();
      return;
    }

    container.innerHTML = this.queue.map(item => {
      let statusBadge = '';
      if (item.status === 'pending') statusBadge = '<span class="badge badge-demo">Menunggu</span>';
      if (item.status === 'transferring') statusBadge = `<span class="badge badge-local">${item.progress}% Mengirim</span>`;
      if (item.status === 'success') statusBadge = '<span class="badge badge-connected">Berhasil</span>';
      if (item.status === 'failed') statusBadge = '<span class="badge badge-disconnected">Gagal</span>';
      if (item.status === 'cancelled') statusBadge = '<span class="badge" style="background:#5e7399;">Batal</span>';

      const iconSvg = item.type === 'audio'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

      return `
        <div class="transfer-queue-item" id="item-${item.id}">
          <div class="queue-item-icon">${iconSvg}</div>
          <div class="queue-item-meta">
            <div class="queue-item-name" title="${item.name}">${item.name}</div>
            <div class="queue-item-sub">
              <span>${item.size}</span> &bull; 
              ${statusBadge}
            </div>
            ${item.status === 'transferring' ? `
              <div class="progress-bar-wrap" style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-top: 6px; overflow: hidden;">
                <div class="progress-bar-inner" style="width: ${item.progress}%; height: 100%; background: var(--accent-mint); transition: width 0.1s linear;"></div>
              </div>
            ` : ''}
          </div>
          <div class="queue-item-actions">
            ${item.status === 'transferring' ? `
              <button class="btn-icon-subtle" onclick="window.mociTransfer.cancelItem('${item.id}')" title="Batalkan">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            ` : `
              <button class="btn-icon-subtle btn-delete-row" onclick="window.mociTransfer.removeItem('${item.id}')" title="Hapus dari antrean">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    this.updateTransferControlsUI();
  }

  updateItemProgressUI(itemId, percent) {
    const itemEl = document.getElementById(`item-${itemId}`);
    if (itemEl) {
      const bar = itemEl.querySelector('.progress-bar-inner');
      if (bar) bar.style.width = `${percent}%`;
    }
  }

  updateTransferControlsUI() {
    const startBtn = document.getElementById('btnStartTransfer');
    const clearBtn = document.getElementById('btnClearTransfer');

    if (startBtn) {
      const hasPending = this.queue.some(i => i.status === 'pending');
      startBtn.disabled = !hasPending || this.isTransferring;
      startBtn.innerHTML = this.isTransferring
        ? `<svg width="16" height="16" viewBox="0 0 24 24" class="spin-icon" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Sedang Mengirim...`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Mulai Transfer`;
    }

    if (clearBtn) {
      clearBtn.disabled = this.isTransferring || !this.queue.some(i => i.status === 'success' || i.status === 'failed' || i.status === 'cancelled');
    }
  }
}

// Global transfer manager instance
window.mociTransfer = new MociTransferManager();
