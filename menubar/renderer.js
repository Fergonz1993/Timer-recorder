// UI Elements
const timerStatus = document.getElementById('timerStatus');
const statusIcon = document.getElementById('statusIcon');
const categoryName = document.getElementById('categoryName');
const timerDuration = document.getElementById('timerDuration');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const categorySelector = document.getElementById('categorySelector');
const categoryList = document.getElementById('categoryList');
const todayTotal = document.getElementById('todayTotal');
const dashboardBtn = document.getElementById('dashboardBtn');

let currentStatus = null;
let updateTimer = null;
let showingSelector = false;

// Format duration
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

function formatShortDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// Update UI
function updateUI(status) {
  currentStatus = status;

  if (status.activeTimer) {
    timerStatus.classList.add('active');
    categoryName.textContent = status.activeTimer.category_name || 'Unknown';
    timerDuration.textContent = formatDuration(status.elapsed);
    startBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    categorySelector.style.display = 'none';
    showingSelector = false;
  } else {
    timerStatus.classList.remove('active');
    categoryName.textContent = 'No active timer';
    timerDuration.textContent = '--:--:--';
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
  }

  todayTotal.textContent = formatShortDuration(status.todayTotal);
}

// Render categories
function renderCategories(categories) {
  categoryList.innerHTML = categories.map(cat => `
    <div class="category-item" data-name="${cat.name}">
      <div class="category-color" style="background: ${cat.color || '#888'}"></div>
      <span class="category-name-item">${cat.name}</span>
    </div>
  `).join('');

  // Add click handlers
  categoryList.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
      const name = item.dataset.name;
      startTimer(name);
    });
  });
}

// Start timer
async function startTimer(category) {
  try {
    await window.timerAPI.runCommand(`start ${category}`);
    categorySelector.style.display = 'none';
    showingSelector = false;
    await refreshStatus();
  } catch (err) {
    console.error('Failed to start timer:', err);
  }
}

// Stop timer
async function stopTimer() {
  try {
    await window.timerAPI.runCommand('stop');
    await refreshStatus();
  } catch (err) {
    console.error('Failed to stop timer:', err);
  }
}

// Refresh status
async function refreshStatus() {
  try {
    const status = await window.timerAPI.getStatus();
    updateUI(status);

    if (status.categories && status.categories.length > 0) {
      renderCategories(status.categories);
    }
  } catch (err) {
    console.error('Failed to get status:', err);
  }
}

// Event listeners
startBtn.addEventListener('click', () => {
  if (showingSelector) {
    categorySelector.style.display = 'none';
    showingSelector = false;
  } else {
    categorySelector.style.display = 'block';
    showingSelector = true;
  }
});

stopBtn.addEventListener('click', stopTimer);

dashboardBtn.addEventListener('click', () => {
  window.timerAPI.openDashboard();
});

// Initial load
refreshStatus();

// Update every second
updateTimer = setInterval(async () => {
  if (currentStatus && currentStatus.activeTimer) {
    currentStatus.elapsed++;
    timerDuration.textContent = formatDuration(currentStatus.elapsed);
  }

  // Full refresh every 5 seconds
  if (Date.now() % 5000 < 1000) {
    await refreshStatus();
  }
}, 1000);
