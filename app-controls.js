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
    
    // Force initial display update
    updateAllTracks();
    
    const countdownInterval = setInterval(() => {
        countdownValue--;
        updateAllTracks(); // Force display update to show countdown
        
        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            isCountingDown = false;
            updateAllTracks(); // Update to show normal time again
            if (callback) callback();
            if (wasPlaying) {
                audioPlayer.play();
            }
        }
    }, 1000);
}

// Bookmark functions
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