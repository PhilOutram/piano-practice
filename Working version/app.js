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
let loadedFiles = new Map();
let countdownEnabled = false;
let isCountingDown = false;
let countdownValue = 0;

// Smooth tracking state for windowed views
let window30Center = 0;
let window10Center = 0;
let lastUpdateTime = 0;

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

// File upload handler
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
        await loadAudioFile(file);
    }
});

// Load audio file
async function loadAudioFile(file) {
    currentFileName = file.name;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('recentSongsButtons').innerHTML = '';
    
    if (audioPlayer.src && audioPlayer.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioPlayer.src);
    }
    
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;
    
    audioPlayer.addEventListener('loadedmetadata', () => {
        currentSongId = generateSongId(currentFileName, audioPlayer.duration);
        
        const hasData = loadSongData(currentSongId);
        
        if (hasData) {
            const msg = document.createElement('div');
            msg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000;';
            msg.innerHTML = `✓ Restored ${bookmarks.length} bookmarks for "${currentFileName}"`;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        } else {
            bookmarks = [];
            loopMode = false;
            loopStart = null;
            loopEnd = null;
            loopCount = 0;
            currentSpeed = 1.0;
            countdownEnabled = true;
            document.getElementById('toggleCountdown').classList.add('active');
            updateBookmarkList();
        }
        
        window30Center = audioPlayer.currentTime;
        window10Center = audioPlayer.currentTime;
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

// Generate waveform
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
            let sumSquares = 0;
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < blockSize; j++) {
                const sample = rawData[i * blockSize + j];
                sumSquares += sample * sample;
                min = Math.min(min, sample);
                max = Math.max(max, sample);
            }
            
            const rms = Math.sqrt(sumSquares / blockSize);
            const peak = Math.max(Math.abs(min), Math.abs(max));
            
            waveformData.push({
                rms: rms,
                peak: peak,
                value: (rms * 0.7) + (peak * 0.3)
            });
        }
        
        drawWaveform('fullWaveform', waveformData, 0, waveformData.length);
        updateWaveforms();
    } catch (error) {
        console.error('Error generating waveform:', error);
    }
}

// Draw waveform
function drawWaveform(canvasId, data, startIdx, endIdx) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const sliceData = data.slice(startIdx, endIdx);
    const barWidth = canvas.width / sliceData.length;
    
    sliceData.forEach((item, i) => {
        const value = typeof item === 'object' ? item.value : item;
        const rms = typeof item === 'object' ? item.rms : value;
        const peak = typeof item === 'object' ? item.peak : value;
        
        const x = i * barWidth;
        
        const peakHeight = peak * canvas.height * 2;
        const peakY = (canvas.height - peakHeight) / 2;
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(x, peakY, barWidth - 1, peakHeight);
        
        const rmsHeight = rms * canvas.height * 2.5;
        const rmsY = (canvas.height - rmsHeight) / 2;
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(x, rmsY, barWidth - 1, rmsHeight);
    });
}

// Update waveforms
function updateWaveforms() {
    if (!waveformData || !audioPlayer.duration) return;
    
    const duration = audioPlayer.duration;
    const currentTime = audioPlayer.currentTime;
    
    if (!window30Center || window30Center === 0) {
        window30Center = currentTime;
    }
    if (!window10Center || window10Center === 0) {
        window10Center = currentTime;
    }
    
    const window30Start = Math.max(0, window30Center - 15);
    const window30End = Math.min(duration, window30Center + 15);
    const idx30Start = Math.floor((window30Start / duration) * waveformData.length);
    const idx30End = Math.floor((window30End / duration) * waveformData.length);
    drawWaveform('window30Waveform', waveformData, idx30Start, idx30End);
    
    const window10Start = Math.max(0, window10Center - 5);
    const window10End = Math.min(duration, window10Center + 5);
    const idx10Start = Math.floor((window10Start / duration) * waveformData.length);
    const idx10End = Math.floor((window10End / duration) * waveformData.length);
    drawWaveform('window10Waveform', waveformData, idx10Start, idx10End);
}

// Play/Pause
playButton.addEventListener('click', () => {
    if (loopMode && loopStart !== null && loopEnd !== null && loopStart === loopEnd) {
        alert('⚠️ Loop Error: Loop start and end are at the same position!');
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

// Audio events
audioPlayer.addEventListener('timeupdate', () => {
    const isPlaying = !audioPlayer.paused;
    const now = Date.now();
    const deltaTime = (isPlaying && lastUpdateTime) ? (now - lastUpdateTime) / 1000 : 0;
    
    if (isPlaying) {
        lastUpdateTime = now;
    } else {
        lastUpdateTime = 0;
    }
    
    updateAllTracksSmooth(deltaTime);
    updateWaveforms();
    
    if (loopMode && loopStart !== null && loopEnd !== null && !isCountingDown) {
        if (audioPlayer.currentTime >= loopEnd) {
            if (countdownEnabled) {
                startCountdown(loopStart, () => {
                    loopCount++;
                    document.getElementById('loopCount').textContent = loopCount;
                });
            } else {
                audioPlayer.currentTime = loopStart;
                loopCount++;
                document.getElementById('loopCount').textContent = loopCount;
            }
        }
    }
});

audioPlayer.addEventListener('loadedmetadata', () => {
    audioPlayer.playbackRate = currentSpeed;
    audioPlayer.volume = document.getElementById('volumeSlider').value / 100;
    window30Center = audioPlayer.currentTime;
    window10Center = audioPlayer.currentTime;
    updateAllTracks();
    updateBookmarkMarkers();
    updateLoopDisplay();
    if (waveformData) {
        drawWaveform('fullWaveform', waveformData, 0, waveformData.length);
        updateWaveforms();
    }
});

// Update tracks
function updateAllTracksSmooth(deltaTime) {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    const isPlaying = !audioPlayer.paused;
    
    if (!duration || isNaN(duration) || duration === 0) return;
    
    document.getElementById('currentTimeDisplay').textContent = formatTime(current);
    document.getElementById('fullTime').textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    const fullPercent = (current / duration) * 100;
    document.getElementById('fullProgress').style.width = fullPercent + '%';
    document.getElementById('fullPosition').style.left = fullPercent + '%';
    
    updateWindowTrack(current, duration, 30, isPlaying, deltaTime);
    updateWindowTrack(current, duration, 10, isPlaying, deltaTime);
    
    updateBookmarkMarkers();
    updateLoopDisplay();
}

function updateWindowTrack(currentTime, duration, windowSize, isPlaying, deltaTime) {
    if (!duration || isNaN(duration) || duration === 0) return;
    
    const halfWindow = windowSize / 2;
    const prefix = windowSize === 30 ? 'window30' : 'window10';
    let windowCenter = windowSize === 30 ? window30Center : window10Center;
    
    if (!windowCenter || windowCenter === 0 || isNaN(windowCenter)) {
        windowCenter = currentTime || 0;
        if (windowSize === 30) {
            window30Center = windowCenter;
        } else {
            window10Center = windowCenter;
        }
    }
    
    const playheadOffset = currentTime - windowCenter;
    let windowStart = windowCenter - halfWindow;
    let windowEnd = windowCenter + halfWindow;
    
    if (currentTime < windowStart || currentTime > windowEnd) {
        windowCenter = currentTime;
        if (windowSize === 30) {
            window30Center = currentTime;
        } else {
            window10Center = currentTime;
        }
    } else if (isPlaying && deltaTime > 0) {
        const centerThreshold = windowSize === 30 ? 0.5 : 0.2;
        const catchupSpeed = 2.0;
        const absOffset = Math.abs(playheadOffset);
        
        if (absOffset <= centerThreshold) {
            windowCenter += audioPlayer.playbackRate * deltaTime;
            if (windowSize === 30) {
                window30Center = windowCenter;
            } else {
                window10Center = windowCenter;
            }
        } else if (playheadOffset > 0) {
            windowCenter += audioPlayer.playbackRate * catchupSpeed * deltaTime;
            if (windowSize === 30) {
                window30Center = windowCenter;
            } else {
                window10Center = windowCenter;
            }
        }
    }
    
    windowCenter = Math.max(halfWindow, Math.min(duration - halfWindow, windowCenter));
    if (windowSize === 30) {
        window30Center = windowCenter;
    } else {
        window10Center = windowCenter;
    }
    
    windowStart = Math.max(0, windowCenter - halfWindow);
    windowEnd = Math.min(duration, windowCenter + halfWindow);
    
    if (windowStart === 0) {
        windowEnd = Math.min(duration, windowSize);
    } else if (windowEnd === duration) {
        windowStart = Math.max(0, duration - windowSize);
    }
    
    const windowRange = windowEnd - windowStart;
    if (windowRange === 0) return;
    
    const playheadPercent = ((currentTime - windowStart) / windowRange) * 100;
    document.getElementById(`${prefix}Time`).textContent = `${formatTime(windowStart)} - ${formatTime(windowEnd)}`;
    document.getElementById(`${prefix}Progress`).style.width = Math.max(0, Math.min(100, playheadPercent)) + '%';
    document.getElementById(`${prefix}Position`).style.left = Math.max(0, Math.min(100, playheadPercent)) + '%';
}

function updateAllTracks() {
    updateAllTracksSmooth(0);
}

// Track clicks
document.getElementById('fullTrack').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
    window30Center = audioPlayer.currentTime;
    window10Center = audioPlayer.currentTime;
});

document.getElementById('window30Track').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const windowStart = Math.max(0, window30Center - 15);
    const windowEnd = Math.min(audioPlayer.duration, window30Center + 15);
    const windowRange = windowEnd - windowStart;
    const newTime = windowStart + (percent * windowRange);
    audioPlayer.currentTime = newTime;
    if (newTime < windowStart || newTime > windowEnd) {
        window30Center = newTime;
        window10Center = newTime;
    }
});

document.getElementById('window10Track').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const windowStart = Math.max(0, window10Center - 5);
    const windowEnd = Math.min(audioPlayer.duration, window10Center + 5);
    const windowRange = windowEnd - windowStart;
    const newTime = windowStart + (percent * windowRange);
    audioPlayer.currentTime = newTime;
    if (newTime < windowStart || newTime > windowEnd) {
        window10Center = newTime;
    }
});

// Buttons
document.getElementById('rewindStart').addEventListener('click', () => {
    if (countdownEnabled) {
        startCountdown(0);
    } else {
        audioPlayer.currentTime = 0;
    }
});
document.getElementById('rewind30').addEventListener('click', () => seek(-30));
document.getElementById('rewind10').addEventListener('click', () => seek(-10));
document.getElementById('rewind5').addEventListener('click', () => seek(-5));
document.getElementById('rewind1').addEventListener('click', () => seek(-1));
document.getElementById('forward1').addEventListener('click', () => seek(1));

function seek(seconds) {
    audioPlayer.currentTime = Math.max(0, Math.min(audioPlayer.duration, audioPlayer.currentTime + seconds));
}

// Speed
document.querySelectorAll('.btn-speed').forEach(btn => {
    btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        currentSpeed = speed;
        audioPlayer.playbackRate = speed;
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveSongData();
    });
});

// Volume
const volumeSlider = document.getElementById('volumeSlider');
volumeSlider.addEventListener('input', (e) => {
    const volume = e.target.value;
    audioPlayer.volume = volume / 100;
    e.target.style.setProperty('--volume-percent', volume + '%');
});
volumeSlider.addEventListener('change', () => saveSongData());
volumeSlider.style.setProperty('--volume-percent', '100%');

// Bookmarks
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
    updateBookmarkMarkers();
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

// Loop
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
        
        if (countdownEnabled) {
            startCountdown(loopStart);
        } else {
            audioPlayer.currentTime = loopStart;
        }
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

// Countdown toggle
document.getElementById('toggleCountdown').addEventListener('click', () => {
    countdownEnabled = !countdownEnabled;
    const btn = document.getElementById('toggleCountdown');
    if (countdownEnabled) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
    saveSongData();
});

// Countdown function
function startCountdown(targetTime, callback) {
    if (isCountingDown) return;
    
    isCountingDown = true;
    countdownValue = 3;
    const wasPlaying = !audioPlayer.paused;
    
    if (wasPlaying) {
        audioPlayer.pause();
    }
    
    // Move to target position immediately
    audioPlayer.currentTime = targetTime;
    
    const countdownInterval = setInterval(() => {
        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            isCountingDown = false;
            if (callback) callback();
            if (wasPlaying) {
                audioPlayer.play();
            }
        } else {
            countdownValue--;
        }
    }, 1000);
}

function updateBookmarkList() {
    const list = document.getElementById('bookmarkList');
    if (bookmarks.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">No bookmarks yet</div>';
        return;
    }

    list.innerHTML = bookmarks.map((b) => {
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
            if (loopEnd !== null && loopStart === loopEnd) {
                alert('⚠️ Loop start and end cannot be at the same position!');
                loopStart = null;
                return;
            }
        } else {
            loopEnd = bookmark.time;
            if (loopStart !== null && loopStart === loopEnd) {
                alert('⚠️ Loop start and end cannot be at the same position!');
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
        if (loopStart !== null && loopEnd !== null) {
            audioPlayer.currentTime = loopStart;
        }
    }
};

window.deleteBookmark = function(id) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    updateBookmarkList();
    updateBookmarkMarkers();
    saveSongData();
};

function updateBookmarkMarkers() {
    if (!audioPlayer.duration) return;
    const duration = audioPlayer.duration;
    
    ['full', 'window30', 'window10'].forEach(prefix => {
        const container = document.getElementById(`${prefix}Bookmarks`);
        container.innerHTML = '';
        
        bookmarks.forEach(b => {
            let percent;
            let show = true;
            
            if (prefix === 'full') {
                percent = (b.time / duration) * 100;
            } else if (prefix === 'window30') {
                const center = window30Center || audioPlayer.currentTime;
                const start = Math.max(0, center - 15);
                const end = Math.min(duration, center + 15);
                if (b.time < start || b.time > end) {
                    show = false;
                } else {
                    const range = end - start;
                    percent = ((b.time - start) / range) * 100;
                }
            } else {
                const center = window10Center || audioPlayer.currentTime;
                const start = Math.max(0, center - 5);
                const end = Math.min(duration, center + 5);
                if (b.time < start || b.time > end) {
                    show = false;
                } else {
                    const range = end - start;
                    percent = ((b.time - start) / range) * 100;
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

function updatePracticeTimeDisplay() {
    let totalSeconds = Math.floor(totalPracticeTime / 1000);
    if (practiceStartTime) {
        totalSeconds += Math.floor((Date.now() - practiceStartTime) / 1000);
    }
    document.getElementById('practiceTime').textContent = formatTime(totalSeconds);
}

setInterval(updatePracticeTimeDisplay, 1000);

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

window.addEventListener('beforeunload', () => {
    if (currentSongId) {
        saveSongData();
    }
});