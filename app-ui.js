// Update all progress tracks with smooth tracking
function updateAllTracksSmooth(deltaTime) {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    const isPlaying = !audioPlayer.paused;
    
    if (!duration || isNaN(duration) || duration === 0) return;
    
    // Show countdown or regular time
    const timeDisplay = document.getElementById('currentTimeDisplay');
    if (isCountingDown) {
        timeDisplay.textContent = countdownValue;
        timeDisplay.classList.add('countdown');
    } else {
        timeDisplay.textContent = formatTime(current);
        timeDisplay.classList.remove('countdown');
    }
    
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

// Update bookmark list display
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

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

setInterval(updatePracticeTimeDisplay, 1000);