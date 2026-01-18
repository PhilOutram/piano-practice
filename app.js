// State variables
let bookmarks = [];
let currentSpeed = 1.0;
let loopMode = false;
let loopStart = null;
let loopEnd = null;
let loopCount = 0;
let practiceStartTime = null;
let totalPracticeTime = 0;
let waveformData = null;
let editingBookmarkId = null;
let currentSongId = null;
let currentFileName = null;
let lastFileHandle = null;
let loadedFiles = new Map(); // Store File objects for quick reload

// DOM elements
const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playerSection = document.getElementById('playerSection');
const playButton = document.getElementById('playButton');

// Load saved data on startup
window.addEventListener('load', () => {
    loadGlobalData();
    showRecentSongs();
});

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
        
        // Update UI
        audioPlayer.playbackRate = currentSpeed;
        document.getElementById('speedDisplay').textContent = currentSpeed;
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-speed="${currentSpeed}"]`)?.classList.add('active');
        
        if (loopMode) {
            document.getElementById('toggleLoop').textContent = '🔁 Loop Mode: On';
            document.getElementById('toggleLoop').classList.add('active');
        }
        
        updateBookmarkList();
        console.log(`Loaded ${bookmarks.length} bookmarks for "${currentFileName}"`);
        return true;
    }
    return false;
}

// Save song-specific data
function saveSongData() {
    if (!currentSongId) return;
    
    const songData = {
        fileName: currentFileName,
        bookmarks: bookmarks,
        loopMode: loopMode,
        loopStart: loopStart,
        loopEnd: loopEnd,
        speed: currentSpeed,
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
        // Show quick load buttons
        buttonsContainer.innerHTML = `
            <div class="recent-song-btn-container">
                <div class="recent-song-label">📂 Quick Load Recent Songs:</div>
                ${recent.slice(0, 9).map(song => {
                    const songData = localStorage.getItem(`song_${song.id}`);
                    const bookmarkCount = songData ? JSON.parse(songData).bookmarks.length : 0;
                    return `
                        <button class="recent-song-btn" onclick="requestSongFile('${song.name}', '${song.id}')">
                            ${song.name}
                            ${bookmarkCount > 0 ? `<span style="color: #9333ea;">(${bookmarkCount} 🔖)</span>` : ''}
                        </button>
                    `;
                }).join('')}
                <div style="margin-top: 8px; font-size: 0.85em; color: #6b21a8;">
                    💡 Click a song name and select the same file to restore all bookmarks
                </div>
            </div>
        `;
        
        // Also show in fileName area
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
    // Create a custom file input to pre-filter
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

// File upload handler
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
        await loadAudioFile(file);
    }
});

// Load audio file (shared function)
async function loadAudioFile(file) {
    currentFileName = file.name;
    document.getElementById('fileName').textContent = `Loaded: ${file.name}`;
    document.getElementById('recentSongsButtons').innerHTML = '';
    
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;
    
    // Wait for metadata to get duration
    audioPlayer.addEventListener('loadedmetadata', () => {
        currentSongId = generateSongId(currentFileName, audioPlayer.duration);
        
        // Try to load saved data for this song
        const hasData = loadSongData(currentSongId);
        
        if (hasData) {
            // Show notification that data was restored
            const msg = document.createElement('div');
            msg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; animation: slideIn 0.3s;';
            msg.innerHTML = `✓ Restored ${bookmarks.length} bookmarks for "${currentFileName}"`;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        } else {
            // New song
            bookmarks = [];
            loopMode = false;
            loopStart = null;
            loopEnd = null;
            loopCount = 0;
            currentSpeed = 1.0;
            updateBookmarkList();
        }
        
        // Initialize all tracks and waveforms immediately
        updateAllTracks();
        updateBookmarkMarkers();
        updateLoopDisplay();
        if (waveformData) {
            updateWaveforms();
        }
    }, { once: true });
    
    playerSection.style.display = 'block';
    await generateWaveform(file);
}

// Generate waveform visualization
async function generateWaveform(file) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0);
        const samples = 1000;
        const blockSize = Math.floor(rawData.length / samples);
        waveformData = [];
        
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[i * blockSize + j]);
            }
            waveformData.push(sum / blockSize);
        }
        
        drawWaveform('fullWaveform', waveformData, 0, waveformData.length);
        // Draw initial windowed waveforms
        updateWaveforms();
    } catch (error) {
        console.error('Error generating waveform:', error);
    }
}

// Draw waveform on canvas
function drawWaveform(canvasId, data, startIdx, endIdx) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6b7280';
    
    const sliceData = data.slice(startIdx, endIdx);
    const barWidth = canvas.width / sliceData.length;
    
    sliceData.forEach((value, i) => {
        const barHeight = value * canvas.height * 2;
        const x = i * barWidth;
        const y = (canvas.height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
}

// Update waveforms for windowed views
function updateWaveforms() {
    if (!waveformData || !audioPlayer.duration) return;
    
    const currentTime = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    
    // 30 second window
    const window30Start = Math.max(0, currentTime - 15);
    const window30End = Math.min(duration, currentTime + 15);
    const idx30Start = Math.floor((window30Start / duration) * waveformData.length);
    const idx30End = Math.floor((window30End / duration) * waveformData.length);
    drawWaveform('window30Waveform', waveformData, idx30Start, idx30End);
    
    // 10 second window
    const window10Start = Math.max(0, currentTime - 5);
    const window10End = Math.min(duration, currentTime + 5);
    const idx10Start = Math.floor((window10Start / duration) * waveformData.length);
    const idx10End = Math.floor((window10End / duration) * waveformData.length);
    drawWaveform('window10Waveform', waveformData, idx10Start, idx10End);
}

// Play/Pause button
playButton.addEventListener('click', () => {
    // Check for invalid loop state
    if (loopMode && loopStart !== null && loopEnd !== null && loopStart === loopEnd) {
        alert('⚠️ Loop Error: Loop start and end are at the same position!\n\nPlease set different start and end points for the loop.');
        return;
    }
    
    if (audioPlayer.paused) {
        audioPlayer.play();
        playButton.textContent = '⏸';
        if (!practiceStartTime) practiceStartTime = Date.now();
    } else {
        audioPlayer.pause();
        playButton.textContent = '▶';
        if (practiceStartTime) {
            totalPracticeTime += Date.now() - practiceStartTime;
            practiceStartTime = null;
            updatePracticeTimeDisplay();
            saveGlobalData();
        }
    }
});

// Audio event listeners
audioPlayer.addEventListener('timeupdate', () => {
    updateAllTracks();
    updateWaveforms();
    
    // Handle loop mode
    if (loopMode && loopStart !== null && loopEnd !== null) {
        if (audioPlayer.currentTime >= loopEnd) {
            audioPlayer.currentTime = loopStart;
            loopCount++;
            document.getElementById('loopCount').textContent = loopCount;
        }
    }
});

audioPlayer.addEventListener('loadedmetadata', () => {
    audioPlayer.playbackRate = currentSpeed;
    updateAllTracks();
    updateBookmarkMarkers();
    updateLoopDisplay();
    if (waveformData) {
        drawWaveform('fullWaveform', waveformData, 0, waveformData.length);
        updateWaveforms();
    }
});

// Update all progress tracks
function updateAllTracks() {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    
    // Full track
    document.getElementById('fullTime').textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    const fullPercent = (current / duration) * 100;
    document.getElementById('fullProgress').style.width = fullPercent + '%';
    document.getElementById('fullPosition').style.left = fullPercent + '%';
    
    // 30 second window
    const window30Start = Math.max(0, current - 15);
    const window30End = Math.min(duration, current + 15);
    const window30Range = window30End - window30Start;
    const window30Percent = ((current - window30Start) / window30Range) * 100;
    document.getElementById('windowTime30').textContent = `${formatTime(window30Start)} - ${formatTime(window30End)}`;
    document.getElementById('window30Progress').style.width = window30Percent + '%';
    document.getElementById('window30Position').style.left = window30Percent + '%';
    
    // 10 second window
    const window10Start = Math.max(0, current - 5);
    const window10End = Math.min(duration, current + 5);
    const window10Range = window10End - window10Start;
    const window10Percent = ((current - window10Start) / window10Range) * 100;
    document.getElementById('windowTime10').textContent = `${formatTime(window10Start)} - ${formatTime(window10End)}`;
    document.getElementById('window10Progress').style.width = window10Percent + '%';
    document.getElementById('window10Position').style.left = window10Percent + '%';
    
    updateBookmarkMarkers();
    updateLoopDisplay();
}

// Track clicking handlers
document.getElementById('fullTrack').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
});

document.getElementById('window30Track').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const window30Start = Math.max(0, audioPlayer.currentTime - 15);
    const window30End = Math.min(audioPlayer.duration, audioPlayer.currentTime + 15);
    const window30Range = window30End - window30Start;
    audioPlayer.currentTime = window30Start + (percent * window30Range);
});

document.getElementById('window10Track').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const window10Start = Math.max(0, audioPlayer.currentTime - 5);
    const window10End = Math.min(audioPlayer.duration, audioPlayer.currentTime + 5);
    const window10Range = window10End - window10Start;
    audioPlayer.currentTime = window10Start + (percent * window10Range);
});

// Rewind/Forward buttons
document.getElementById('rewindStart').addEventListener('click', () => audioPlayer.currentTime = 0);
document.getElementById('rewind30').addEventListener('click', () => seek(-30));
document.getElementById('rewind10').addEventListener('click', () => seek(-10));
document.getElementById('rewind5').addEventListener('click', () => seek(-5));
document.getElementById('rewind1').addEventListener('click', () => seek(-1));
document.getElementById('forward1').addEventListener('click', () => seek(1));

function seek(seconds) {
    audioPlayer.currentTime = Math.max(0, Math.min(audioPlayer.duration, audioPlayer.currentTime + seconds));
}

// Speed control
document.querySelectorAll('.btn-speed').forEach(btn => {
    btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        currentSpeed = speed;
        audioPlayer.playbackRate = speed;
        document.getElementById('speedDisplay').textContent = speed;
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSongData();
    });
});

// Bookmark management
document.getElementById('addBookmark').addEventListener('click', () => {
    const bookmark = {
        id: Date.now(),
        time: audioPlayer.currentTime,
        label: `Bookmark ${bookmarks.length + 1}`,
        color: '#ef4444',
        playCount: 0
    };
    bookmarks.push(bookmark);
    bookmarks.sort((a, b) => a.time - b.time);
    updateBookmarkList();
    saveSongData();
});

document.getElementById('prevBookmark').addEventListener('click', () => {
    const prev = bookmarks.filter(b => b.time < audioPlayer.currentTime - 0.5).pop();
    if (prev) {
        audioPlayer.currentTime = prev.time;
        prev.playCount++;
        updateBookmarkList();
        saveSongData();
    }
});

document.getElementById('nextBookmark').addEventListener('click', () => {
    const next = bookmarks.find(b => b.time > audioPlayer.currentTime + 0.5);
    if (next) {
        audioPlayer.currentTime = next.time;
        next.playCount++;
        updateBookmarkList();
        saveSongData();
    }
});

// Loop mode toggle
document.getElementById('toggleLoop').addEventListener('click', () => {
    if (!loopMode) {
        if (bookmarks.length < 2) {
            alert('Add at least 2 bookmarks to use loop mode');
            return;
        }
        loopMode = true;
        loopStart = bookmarks[0].time;
        loopEnd = bookmarks[1].time;
        loopCount = 0;
        document.getElementById('toggleLoop').textContent = '🔁 Loop Mode: On';
        document.getElementById('toggleLoop').classList.add('active');
    } else {
        loopMode = false;
        loopStart = null;
        loopEnd = null;
        document.getElementById('toggleLoop').textContent = '🔁 Loop Mode: Off';
        document.getElementById('toggleLoop').classList.remove('active');
    }
    updateBookmarkList();
    updateLoopDisplay();
    saveSongData();
});

// Update bookmark list display
function updateBookmarkList() {
    const list = document.getElementById('bookmarkList');
    if (bookmarks.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">No bookmarks yet</div>';
        return;
    }

    list.innerHTML = bookmarks.map((b, idx) => {
        const isLoopStart = loopMode && b.time === loopStart;
        const isLoopEnd = loopMode && b.time === loopEnd;
        const classes = ['bookmark-item'];
        if (isLoopStart) classes.push('loop-start');
        if (isLoopEnd) classes.push('loop-end');
        
        return `
            <div class="${classes.join(' ')}">
                <div class="bookmark-info" onclick="jumpToBookmark(${b.id})">
                    ${editingBookmarkId === b.id ? 
                        `<input type="text" class="bookmark-input" value="${b.label}" id="edit-${b.id}" onblur="saveBookmarkName(${b.id})" onkeypress="if(event.key==='Enter') saveBookmarkName(${b.id})">` :
                        `<span style="font-weight: 600;">${b.label}</span>`
                    }
                    <span style="color: #6b7280; margin-left: 8px;">(${formatTime(b.time)}) ${b.playCount > 0 ? `- Practiced ${b.playCount}x` : ''}</span>
                    ${isLoopStart ? '<span style="margin-left: 8px; color: #10b981;">▶ Loop Start</span>' : ''}
                    ${isLoopEnd ? '<span style="margin-left: 8px; color: #10b981;">◀ Loop End</span>' : ''}
                </div>
                <div class="bookmark-controls">
                    <input type="color" class="color-picker" value="${b.color}" onchange="changeBookmarkColor(${b.id}, this.value)">
                    <button onclick="editBookmarkName(${b.id})" style="color: #3b82f6;">✏️</button>
                    ${loopMode ? `<button onclick="setLoopPoint(${b.id}, 'start')" style="color: #10b981;">S</button>` : ''}
                    ${loopMode ? `<button onclick="setLoopPoint(${b.id}, 'end')" style="color: #10b981;">E</button>` : ''}
                    <button onclick="deleteBookmark(${b.id})" style="color: #ef4444;">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

// Bookmark functions (need to be global for onclick handlers)
window.jumpToBookmark = function(id) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (bookmark) {
        audioPlayer.currentTime = bookmark.time;
        bookmark.playCount++;
        updateBookmarkList();
        saveSongData();
    }
};

window.editBookmarkName = function(id) {
    editingBookmarkId = id;
    updateBookmarkList();
    setTimeout(() => {
        const input = document.getElementById(`edit-${id}`);
        if (input) {
            input.focus();
            input.select();
        }
    }, 0);
};

window.saveBookmarkName = function(id) {
    const input = document.getElementById(`edit-${id}`);
    if (input) {
        const bookmark = bookmarks.find(b => b.id === id);
        if (bookmark) {
            bookmark.label = input.value || bookmark.label;
        }
    }
    editingBookmarkId = null;
    updateBookmarkList();
    saveSongData();
};

window.changeBookmarkColor = function(id, color) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (bookmark) {
        bookmark.color = color;
        updateBookmarkMarkers();
        saveSongData();
    }
};

window.setLoopPoint = function(id, point) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (bookmark) {
        if (point === 'start') {
            loopStart = bookmark.time;
            // Check if this creates invalid loop
            if (loopEnd !== null && loopStart === loopEnd) {
                alert('⚠️ Loop start and end cannot be at the same position!\n\nPlease choose a different bookmark.');
                loopStart = null;
                return;
            }
        } else {
            loopEnd = bookmark.time;
            // Check if this creates invalid loop
            if (loopStart !== null && loopStart === loopEnd) {
                alert('⚠️ Loop start and end cannot be at the same position!\n\nPlease choose a different bookmark.');
                loopEnd = null;
                return;
            }
        }
        if (loopStart !== null && loopEnd !== null && loopStart > loopEnd) {
            [loopStart, loopEnd] = [loopEnd, loopStart];
        }
        loopCount = 0;
        document.getElementById('loopCount').textContent = loopCount;
        updateBookmarkList();
        updateLoopDisplay();
        saveSongData();
    }
};

window.deleteBookmark = function(id) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    updateBookmarkList();
    updateBookmarkMarkers();
    saveSongData();
};

// Update bookmark markers on tracks
function updateBookmarkMarkers() {
    if (!audioPlayer.duration) return;
    
    ['full', 'window30', 'window10'].forEach(prefix => {
        const container = document.getElementById(`${prefix}Bookmarks`);
        container.innerHTML = '';
        
        bookmarks.forEach(b => {
            let percent;
            let show = true;
            
            if (prefix === 'full') {
                percent = (b.time / audioPlayer.duration) * 100;
            } else if (prefix === 'window30') {
                const start = Math.max(0, audioPlayer.currentTime - 15);
                const end = Math.min(audioPlayer.duration, audioPlayer.currentTime + 15);
                if (b.time < start || b.time > end) {
                    show = false;
                } else {
                    percent = ((b.time - start) / (end - start)) * 100;
                }
            } else {
                const start = Math.max(0, audioPlayer.currentTime - 5);
                const end = Math.min(audioPlayer.duration, audioPlayer.currentTime + 5);
                if (b.time < start || b.time > end) {
                    show = false;
                } else {
                    percent = ((b.time - start) / (end - start)) * 100;
                }
            }
            
            if (show) {
                const marker = document.createElement('div');
                marker.className = 'bookmark-marker';
                marker.style.left = percent + '%';
                marker.style.background = b.color;
                marker.title = b.label;
                marker.onclick = () => jumpToBookmark(b.id);
                container.appendChild(marker);
            }
        });
    });
}

// Update loop visualization
function updateLoopDisplay() {
    if (!audioPlayer.duration || !loopMode || loopStart === null || loopEnd === null) {
        document.getElementById('fullLoop').innerHTML = '';
        return;
    }
    
    const startPercent = (loopStart / audioPlayer.duration) * 100;
    const endPercent = (loopEnd / audioPlayer.duration) * 100;
    const width = endPercent - startPercent;
    
    document.getElementById('fullLoop').innerHTML = `
        <div class="loop-marker" style="left: ${startPercent}%; width: ${width}%"></div>
    `;
}

// Practice time tracking
function updatePracticeTimeDisplay() {
    let totalSeconds = Math.floor(totalPracticeTime / 1000);
    if (practiceStartTime) {
        totalSeconds += Math.floor((Date.now() - practiceStartTime) / 1000);
    }
    document.getElementById('practiceTime').textContent = formatTime(totalSeconds);
}

setInterval(updatePracticeTimeDisplay, 1000);

// Format time helper
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key) {
        case ' ':
            e.preventDefault();
            playButton.click();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            seek(e.shiftKey ? -1 : -5);
            break;
        case 'ArrowRight':
            e.preventDefault();
            seek(e.shiftKey ? 1 : 5);
            break;
        case 'b':
        case 'B':
            e.preventDefault();
            document.getElementById('addBookmark').click();
            break;
        case 'l':
        case 'L':
            e.preventDefault();
            document.getElementById('toggleLoop').click();
            break;
    }
});

// Auto-save on page unload
window.addEventListener('beforeunload', () => {
    if (currentSongId) {
        saveSongData();
    }
});