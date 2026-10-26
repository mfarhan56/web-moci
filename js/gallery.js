/* ===================================================================
   PHOTO GALLERY, LIGHTBOX & TFT PREVIEW — WEB MOCI
   Image handling, 128x160 TFT crop visualizer, and Slideshow engine
   =================================================================== */

class MociGallery {
  constructor() {
    this.currentLightboxIndex = 0;
    this.activePhotos = [];
    this.slideshowTimer = null;
    this.isSlideshowPlaying = false;
    this.searchQuery = '';
    this.currentFilter = 'all'; // 'all', 'favorite', 'local', 'sd'
    this.currentSort = 'newest'; // 'newest', 'oldest', 'name'
  }

  init() {
    this.bindEvents();
    this.renderGallery();
  }

  bindEvents() {
    // File picker upload
    const fileInput = document.getElementById('photoFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(f => this.handleImageUpload(f));
        fileInput.value = '';
      });
    }

    // Drag and drop zone
    const dropzone = document.getElementById('photoDropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files);
        files.filter(f => f.type.startsWith('image/')).forEach(f => this.handleImageUpload(f));
      });
    }

    // Search and filters
    const searchInput = document.getElementById('photoSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderGallery();
      });
    }

    const sortSelect = document.getElementById('photoSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.renderGallery();
      });
    }

    // Filter pills
    document.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.photo-filter-btn');
      if (filterBtn) {
        document.querySelectorAll('.photo-filter-btn').forEach(b => b.classList.remove('active'));
        filterBtn.classList.add('active');
        this.currentFilter = filterBtn.getAttribute('data-filter') || 'all';
        this.renderGallery();
      }
    });

    // Keyboard navigation in Lightbox
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('photoLightboxModal');
      if (modal && modal.classList.contains('active')) {
        if (e.key === 'ArrowRight') this.nextLightbox();
        if (e.key === 'ArrowLeft') this.prevLightbox();
        if (e.key === 'Escape') this.closeLightbox();
      }
    });
  }

  handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
      if (window.mociUI) window.mociUI.showToast('File bukan format gambar yang valid.', 'error');
      return;
    }

    // Check size (warn if > 5MB)
    const sizeKb = Math.round(file.size / 1024);
    const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    const objectUrl = URL.createObjectURL(file);
    const newPhoto = {
      id: 'photo-user-' + Date.now() + Math.random().toString(36).substr(2, 4),
      name: file.name.replace(/\.[^/.]+$/, ""),
      url: objectUrl,
      size: sizeFormatted,
      date: new Date().toISOString().split('T')[0],
      location: 'local', // Lokal browser
      isFavorite: false,
      rawFile: file,
      tftCompatible: true
    };

    window.mociState.addPhoto(newPhoto);

    if (window.mociUI) {
      window.mociUI.showToast(`Foto "${newPhoto.name}" berhasil diunggah ke browser!`, 'success');
    }

    this.renderGallery();
  }

  getFilteredPhotos() {
    let photos = [...(window.mociState?.photos || [])];

    // Filter category
    if (this.currentFilter === 'favorite') {
      photos = photos.filter(p => p.isFavorite);
    } else if (this.currentFilter === 'local') {
      photos = photos.filter(p => p.location === 'local');
    } else if (this.currentFilter === 'sd') {
      photos = photos.filter(p => p.location === 'sd');
    }

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      photos = photos.filter(p => p.name.toLowerCase().includes(q));
    }

    // Sorting
    if (this.currentSort === 'newest') {
      // items added later are first
    } else if (this.currentSort === 'oldest') {
      photos.reverse();
    } else if (this.currentSort === 'name') {
      photos.sort((a, b) => a.name.localeCompare(b.name));
    }

    return photos;
  }

  renderGallery() {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;

    this.activePhotos = this.getFilteredPhotos();

    if (!this.activePhotos.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </div>
          <div class="empty-state-title">Belum ada foto yang cocok</div>
          <div class="empty-state-desc">Unggah foto baru atau sesuaikan filter pencarian.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.activePhotos.map((photo, index) => {
      const isSd = photo.location === 'sd';
      return `
        <div class="photo-card" data-photo-id="${photo.id}">
          <div class="photo-thumbnail-wrap" onclick="window.mociGallery.openLightbox(${index})">
            <img src="${photo.url}" alt="${photo.name}" loading="lazy" class="photo-thumb-img" />
            <div class="photo-hover-overlay">
              <span class="btn-preview-circle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </span>
            </div>
            <span class="photo-source-badge badge ${isSd ? 'badge-robot' : 'badge-local'}">
              ${isSd ? 'SD Moci' : 'Lokal'}
            </span>
            <button class="photo-fav-btn ${photo.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); window.mociGallery.toggleFavorite('${photo.id}')" title="Favorit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${photo.isFavorite ? '#ff6b6b' : 'none'}" stroke="${photo.isFavorite ? '#ff6b6b' : '#fff'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>
          <div class="photo-card-info">
            <div class="photo-card-title" title="${photo.name}">${photo.name}</div>
            <div class="photo-card-meta">
              <span>${photo.size}</span>
              <div class="photo-card-actions">
                <button class="btn-icon-subtle" onclick="window.mociGallery.previewOnMociScreen('${photo.id}')" title="Tampilkan pada Layar TFT Moci">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                </button>
                <button class="btn-icon-subtle" onclick="window.mociTransfer.queuePhotoForTransfer('${photo.id}')" title="Kirim ke Micro SD Moci">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </button>
                <button class="btn-icon-subtle btn-delete-row" onclick="window.mociGallery.confirmDelete('${photo.id}')" title="Hapus Foto">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Lightbox Modal ---
  openLightbox(index) {
    if (!this.activePhotos.length || index < 0 || index >= this.activePhotos.length) return;
    this.currentLightboxIndex = index;
    const photo = this.activePhotos[index];

    const modal = document.getElementById('photoLightboxModal');
    if (!modal) return;

    document.getElementById('lightboxPhotoImg').src = photo.url;
    document.getElementById('lightboxPhotoTitle').textContent = photo.name;
    document.getElementById('lightboxPhotoSize').textContent = photo.size;
    document.getElementById('lightboxPhotoLocation').textContent = photo.location === 'sd' ? 'Micro SD Moci' : 'Lokal Browser';
    document.getElementById('lightboxPhotoCounter').textContent = `${index + 1} / ${this.activePhotos.length}`;

    modal.classList.add('active');
  }

  closeLightbox() {
    const modal = document.getElementById('photoLightboxModal');
    if (modal) modal.classList.remove('active');
    if (this.isSlideshowPlaying) this.stopSlideshow();
  }

  nextLightbox() {
    if (!this.activePhotos.length) return;
    this.currentLightboxIndex = (this.currentLightboxIndex + 1) % this.activePhotos.length;
    this.openLightbox(this.currentLightboxIndex);
  }

  prevLightbox() {
    if (!this.activePhotos.length) return;
    this.currentLightboxIndex = (this.currentLightboxIndex - 1 + this.activePhotos.length) % this.activePhotos.length;
    this.openLightbox(this.currentLightboxIndex);
  }

  toggleFavorite(photoId) {
    window.mociState.togglePhotoFavorite(photoId);
    this.renderGallery();
  }

  confirmDelete(photoId) {
    const photo = window.mociState.photos.find(p => p.id === photoId);
    if (!photo) return;

    window.mociUI.confirmAction(
      'Hapus Foto',
      `Apakah kamu yakin ingin menghapus foto "${photo.name}"?`,
      () => {
        window.mociState.removePhoto(photoId);
        this.renderGallery();
        if (window.mociUI) window.mociUI.showToast(`Foto "${photo.name}" dihapus.`, 'info');
      }
    );
  }

  previewOnMociScreen(photoId) {
    const photo = window.mociState.photos.find(p => p.id === photoId);
    if (!photo) return;

    if (window.mociMascot) {
      window.mociMascot.renderTftDisplay(photo.url);
    }
    window.mociApi.displayPhoto(photo);
    window.mociState.logActivity('Tampilan Layar TFT Diperbarui', `Foto "${photo.name}" dikirim ke TFT 1.8" simulator.`);

    if (window.mociUI) {
      window.mociUI.showToast(`Foto "${photo.name}" ditampilkan pada simulasi layar TFT 128×160 Moci!`, 'success');
      // If user is not on Kontrol Moci, can navigate there or notify
    }
  }

  // --- Slideshow Mode ---
  toggleSlideshow() {
    if (this.isSlideshowPlaying) {
      this.stopSlideshow();
    } else {
      this.startSlideshow();
    }
  }

  startSlideshow() {
    const photos = this.getFilteredPhotos();
    if (!photos.length) {
      if (window.mociUI) window.mociUI.showToast('Tidak ada foto untuk slideshow.', 'warning');
      return;
    }

    this.isSlideshowPlaying = true;
    document.querySelectorAll('.btn-slideshow-toggle').forEach(b => {
      b.classList.add('btn-primary');
      b.classList.remove('btn-secondary');
      b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Hentikan Slideshow`;
    });

    const durationSec = window.mociState?.settings?.slideshowDuration || 5;
    this.openLightbox(0);

    if (this.slideshowTimer) clearInterval(this.slideshowTimer);
    this.slideshowTimer = setInterval(() => {
      this.nextLightbox();
    }, durationSec * 1000);

    if (window.mociUI) {
      window.mociUI.showToast(`Mode Slideshow aktif (${durationSec} detik per foto).`, 'info');
    }
  }

  stopSlideshow() {
    this.isSlideshowPlaying = false;
    if (this.slideshowTimer) {
      clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
    }

    document.querySelectorAll('.btn-slideshow-toggle').forEach(b => {
      b.classList.remove('btn-primary');
      b.classList.add('btn-secondary');
      b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Mulai Slideshow`;
    });

    if (window.mociUI) {
      window.mociUI.showToast('Slideshow dihentikan.', 'info');
    }
  }
}

// Global gallery instance
window.mociGallery = new MociGallery();
