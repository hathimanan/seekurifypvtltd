let allPasswords = [];
let currentTab = 'all';

// Load analytics
function loadAnalytics() {
  chrome.runtime.sendMessage({ type: "GET_ANALYTICS" }, (analytics) => {
    if (!analytics) return;
    
    document.getElementById('total-count').textContent = analytics.total;
    document.getElementById('weak-count').textContent = analytics.weak;
    document.getElementById('reused-count').textContent = analytics.reused;
    document.getElementById('expired-count').textContent = analytics.expired;
  });
}

// Load passwords
function loadPasswords() {
  chrome.runtime.sendMessage({ type: "GET_ALL_PASSWORDS" }, (passwords) => {
    allPasswords = passwords || [];
    filterPasswords(currentTab);
  });
}

// Filter passwords by tab
function filterPasswords(tab) {
  currentTab = tab;
  let filtered = [];
  
  switch(tab) {
    case 'weak':
      filtered = allPasswords.filter(p => p.strength === 'weak');
      break;
    case 'reused':
      filtered = allPasswords.filter(p => p.isReused);
      break;
    case 'expired':
      filtered = allPasswords.filter(p => p.isExpired);
      break;
    default:
      filtered = allPasswords;
  }
  
  renderPasswords(filtered);
}

// Render passwords
function renderPasswords(passwords) {
  const content = document.getElementById('content');
  
  if (passwords.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <p>No passwords found</p>
      </div>
    `;
    return;
  }
  
  content.innerHTML = passwords.map(p => `
    <div class="password-item">
      <div class="password-header">
        <div>
          <div class="domain">${p.domain}</div>
          <div class="username">${p.username}</div>
        </div>
      </div>
      <div class="badges">
        <span class="badge badge-${p.strength}">${p.strength.toUpperCase()}</span>
        ${p.isReused ? '<span class="badge badge-reused">REUSED</span>' : ''}
        ${p.isExpired ? '<span class="badge badge-expired">EXPIRED</span>' : ''}
      </div>
      <div class="actions" style="margin-top: 8px;">
        <button class="btn btn-view" data-id="${p.id}">View</button>
        <button class="btn btn-delete" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => viewPassword(btn.dataset.id));
  });
  
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deletePassword(btn.dataset.id));
  });
}

// View password details
function viewPassword(id) {
  chrome.runtime.sendMessage({ type: "GET_PASSWORD", id: parseInt(id) }, (password) => {
    if (!password) return;
    
    alert(`
Domain: ${password.domain}
Username: ${password.username}
Password: ${password.password}
Strength: ${password.strength}
${password.isReused ? `Reused on: ${password.reusedDomains.join(', ')}` : ''}
${password.isExpired ? 'Status: EXPIRED' : ''}
    `.trim());
  });
}

// Delete password
function deletePassword(id) {
  if (!confirm('Are you sure you want to delete this password?')) return;
  
  chrome.runtime.sendMessage({ type: "DELETE_PASSWORD", id: parseInt(id) }, () => {
    loadPasswords();
    loadAnalytics();
  });
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    filterPasswords(tab.dataset.tab);
  });
});

// Initialize
loadAnalytics();
loadPasswords();