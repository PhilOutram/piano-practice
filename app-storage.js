// Load global practice data
function loadGlobalData() {
    const saved = localStorage.getItem('pianoPracticeGlobal');
    if (saved) {
        const data = JSON.parse(saved);
        totalPracticeTime = data.totalPracticeTime || 0;
    }
}

// Save global practice data
function saveGlobalData() {
    localStorage.setItem('pianoPracticeGlobal', JSON.stringify({
        totalPracticeTime: totalPracticeTime,
        lastSession: {
            fileName: currentFileName,
            songId: currentSongId,
            timestamp: Date.now()
        }
    }));
}

// Generate unique ID for a song based on filename and duration
function generateSongId(fileName, duration) {
    return `${fileName}_${Math.floor(duration)}`;
}

// Load song-specific data
function loadSongData(songId) {
    const saved = localStorage.getItem(`song_${songId}`);
    if (saved) {
        const data = JSON.parse(saved);
        bookmarks = data.bookmarks || [];
        loopMode = data.loopMode || false;
        loopStart = data.loopStart || null;
        loopEnd = data.loopEnd || null;
        currentSpeed = data.speed || 1.0;
        countdownEnabled = data.countdownEnabled !== undefined ? data.countdownEnabled : true;
        
        // Update countdown button state
        const countdownBtn = document.getElementById('toggleCountdown');
        if (countdownEnabled) {
            countdownBtn.classList.add('active');
        } else {
            countdownBtn.classList.remove('active');
        }
        
        // Restore volume setting
        const savedVolume = data.volume !== undefined ? data.volume : 100;
        audioPlayer.volume = savedVolume / 100;
        document.getElementById('volumeSlider').value = savedVolume;
        document.getElementById('volumeSlider').style.setProperty('--volume-percent', savedVolume + '%');
        
        // Update UI
        audioPlayer.playbackRate = currentSpeed;
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-speed="${currentSpeed}"]`)?.classList.add('active');
        
        if (loopMode) {
            document.getElementById('toggleLoop').textContent = '🔁 Loop Mode: On';
            document.getElementById('toggleLoop').classList.add('active');
        }
        
        updateBookmarkList();
        console.log(`Loaded ${bookmarks.length} bookmarks for "${currentFileName}" (Volume: ${savedVolume}%)`);
        return true;
    } else {
        // New song - set countdown enabled by default
        countdownEnabled = true;
        document.getElementById('toggleCountdown').classList.add('active');
    }
    return false;
}

// Save song-specific data
function saveSongData() {
    if (!currentSongId) return;
    
    const currentVolume = Math.round(audioPlayer.volume * 100);
    
    const songData = {
        fileName: currentFileName,
        bookmarks: bookmarks,
        loopMode: loopMode,
        loopStart: loopStart,
        loopEnd: loopEnd,
        speed: currentSpeed,
        volume: currentVolume,
        countdownEnabled: countdownEnabled,
        lastPracticed: Date.now(),
        totalPracticeTime: getSongPracticeTime()
    };
    
    localStorage.setItem(`song_${currentSongId}`, JSON.stringify(songData));
    
    // Update recent songs list
    updateRecentSongs(currentSongId, currentFileName);
    saveGlobalData();
}

// Get practice time for current song
function getSongPracticeTime() {
    const saved = localStorage.getItem(`song_${currentSongId}`);
    if (saved) {
        return JSON.parse(saved).totalPracticeTime || 0;
    }
    return 0;
}

// Update recent songs list
function updateRecentSongs(songId, fileName) {
    const saved = localStorage.getItem('recentSongs');
    let recent = saved ? JSON.parse(saved) : [];
    
    // Remove if already exists
    recent = recent.filter(s => s.id !== songId);
    
    // Add to front
    recent.unshift({
        id: songId,
        name: fileName,
        lastPracticed: Date.now()
    });
    
    // Keep only 10 most recent
    recent = recent.slice(0, 10);
    
    localStorage.setItem('recentSongs', JSON.stringify(recent));
    showRecentSongs();
}

// Show recent songs in UI
function showRecentSongs() {
    const saved = localStorage.getItem('recentSongs');
    if (!saved) return;
    
    const recent = JSON.parse(saved);
    if (recent.length === 0) return;
    
    const buttonsContainer = document.getElementById('recentSongsButtons');
    const fileNameDiv = document.getElementById('fileName');
    
    // Only show if no file is currently loaded
    if (!currentFileName && recent.length > 0) {
        buttonsContainer.innerHTML = `
            <div class="recent-song-btn-container">
                <div class="recent-song-label">📂 Quick Load Recent Songs:</div>
                ${recent.slice(0, 9).map(song => {
                    const songData = localStorage.getItem(`song_${song.id}`);
                    const bookmarkCount = songData ? JSON.parse(songData).bookmarks.length : 0;
                    return `
                        <button class="recent-song-btn" onclick="requestSongFile('${song.name}', '${song.id}')">
                            ${song.name}
                            ${bookmarkCount > 0 ? `<span style="color: #9333ea;">(${bookmarkCount} 📖)</span>` : ''}
                        </button>
                    `;
                }).join('')}
                <div style="margin-top: 8px; font-size: 0.85em; color: #6b21a8;">
                    💡 Click a song name and select the same file to restore all bookmarks
                </div>
            </div>
        `;
        
        fileNameDiv.innerHTML = `
            <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 8px;">
                <div style="font-weight: 600; color: #78350f; margin-bottom: 8px;">📊 Recent Practice Sessions:</div>
                ${recent.slice(0, 5).map(song => {
                    const songData = localStorage.getItem(`song_${song.id}`);
                    const bookmarkCount = songData ? JSON.parse(songData).bookmarks.length : 0;
                    return `
                        <div style="padding: 6px 0; color: #92400e; font-size: 0.9em;">
                            <strong>${song.name}</strong> 
                            <span style="color: #a16207;">(${bookmarkCount} bookmarks, ${getTimeSince(song.lastPracticed)})</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        buttonsContainer.innerHTML = '';
    }
}

// Request file upload for specific song
window.requestSongFile = function(songName, songId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await loadAudioFile(file);
        }
    };
    input.click();
};

function getTimeSince(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}