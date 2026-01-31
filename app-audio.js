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
        // Only play if not counting down, or resume countdown if it was paused
        if (!isCountingDown) {
            audioPlayer.play();
            playButton.textContent = '⏸';
            if (!practiceStartTime) practiceStartTime = Date.now();
        }
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
    
    // Only process loop if not paused and not counting down
    if (loopMode && loopStart !== null && loopEnd !== null && !isCountingDown && isPlaying) {
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