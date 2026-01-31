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