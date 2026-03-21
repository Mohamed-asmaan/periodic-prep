/**
 * appFunc.js - Periodic Table Grid Rendering
 * =========================================
 * Renders the periodic table grid from ELEMENTS array (elements-data.js).
 * Run BEFORE app.js (load order in index.html).
 * - getElementCategory: maps element to category for CSS color (alkali, halogen, etc.)
 * - renderElement: builds 18x10 grid, fills cells with symbol + atomic number
 */

// Elements data from elements-data.js (must be loaded first)
let elements = ELEMENTS;
let periodicTableGrid = document.getElementById('periodicTable');

//object used to store constant keys
const STORAGE_KEYS = {
    PROFILE: 'chemistryRevision_profile',
    WELCOME_SEEN: 'chemistryRevision_welcomeSeen',
    WEAK_ELEMENTS: 'chemistryRevision_weakElements',
    LAST_VIEWED: 'chemistryRevision_lastViewed',
    STUDY_HIDDEN: 'chemistryRevision_studyHidden'
};
// Single source of truth — every feature reads/writes this
let state = {
    userName: null, // From profile form
    userEmail: null,
    studyMode: false, // Is study mode panel visible?
    studyHidden: {}, // { atomicNumber: true, atomicMass: false, ... }
    weakElements: {}, // { "Fe": "weak", "Au": "weak", ... }
    lastViewed: null, // Symbol of last clicked element, e.g. "Fe"
    compareSelection: [], // Up to 2 symbols for comparison
    filterMode: 'all', // 'all' | 'weak'
    filterPeriods: [], // [1, 2, 3] or [] for all
    quizScore: 0,
    quizTotal: 0,
    quizActive: false
};
/**
 * Returns element category for CSS styling (IUPAC-style colors).
 * Uses atomic number and group to determine: alkali, alkaline-earth, transition, etc.
 */
function getElementCategory(el) {
    const n = el.atomicNumber;
    const g = el.group;
    if (n === 1) return 'nonmetal';
    if (g === 1) return 'alkali';
    if (g === 2) return 'alkaline-earth';
    if (g >= 3 && g <= 12) return 'transition';
    if (n >= 57 && n <= 71) return 'lanthanide';
    if (n >= 89 && n <= 103) return 'actinide';
    if (g === 17) return 'halogen';
    if (g === 18) return 'noble-gas';
    if ([5, 14, 32, 33, 51, 52, 84].includes(n)) return 'metalloid';
    if (g >= 13 && g <= 16) return 'post-transition';
    return 'post-transition';
}

/**
 * Renders the periodic table grid.
 * - Builds lookup map: (xpos, ypos) -> element
 * - Loops 18 cols x 10 rows (standard layout)
 * - Empty cells: visibility hidden (keeps grid alignment)
 * - Cells get: element-cell, cat-{category}, data-symbol for search/filter
 */
function renderElement() {
    periodicTableGrid.innerHTML = '';

    const elementsToShow = getFilteredElements();

    if (elementsToShow.length === 0) {
        const msg = state.filterMode === 'weak'
            ? 'No elements need practice.'
            : 'No elements match the period filter.';
        periodicTableGrid.innerHTML = `<p>${msg}</p>`;
        return;
    }

    const grid = {};

    //  USE FILTERED DATA
    elementsToShow.forEach(el => {
        let keyName = `${el.xpos}-${el.ypos}`;
        grid[keyName] = el;
    });

    for (let i = 1; i <= 10; i++) {
        for (let j = 1; j <= 18; j++) {
            const key = `${j}-${i}`;
            const element = grid[key];

            const cell = document.createElement("div");
            cell.setAttribute('role', 'gridcell');
            cell.dataset.symbol = element ? element.symbol : '';

            if (element) {
                const category = getElementCategory(element);
                cell.className = `element-cell cat-${category}`;
                cell.innerHTML = `
               <span class="element-symbol">${element.symbol}</span>
               <span class="element-number">${element.atomicNumber}</span>
            `;
                cell.addEventListener('click', () => {
                    handleElementClick(element);
                });


                cell.style.gridColumn = j;
                cell.style.gridRow = i;
            } else {
                cell.style.visibility = "hidden";
                cell.style.gridColumn = j;
                cell.style.gridRow = i;
            }

            periodicTableGrid.appendChild(cell);
        }
    }
}



// element was clicked and updates the detail panel.
// It also removes highlight from all cells and highlights only the clicked one.
function handleElementClick(element) {
    if (!element) return;
    saveLastViewed(element.symbol);
    renderDetailPanel(element);
    // Only one cell highlighted at a time
    document.querySelectorAll('.element-cell.highlight').forEach(c =>
        c.classList.remove('highlight'));
    const cell = document.querySelector(`[data-symbol="${element.symbol}"]`);
    if (cell) cell.classList.add('highlight');

}



function saveLastViewed(symbol) {
    try {
        localStorage.setItem(STORAGE_KEYS.LAST_VIEWED, symbol);
    } catch (e) {
        console.warn('Could not save last viewed:', e);
    }
}
/**
 * Shows a banner if user previously opened an element.
 * Clicking it reopens the last viewed element.
 */

function loadContinueBanner() {
    const banner = document.getElementById('continueBanner');
    const btn = document.getElementById('continueYes');
    const dismissBtn = document.getElementById('continueDismiss');

    const last = localStorage.getItem(STORAGE_KEYS.LAST_VIEWED);

    // If no last viewed element → hide banner
    if (!last) {
        banner.style.display = 'none';
        return;
    }

    // Show the banner
    banner.style.display = 'flex';
    btn.textContent = `Continue learning: ${last}`;

    dismissBtn.addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.removeItem(STORAGE_KEYS.LAST_VIEWED);
    })

    // Click button → go to element
    btn.onclick = () => {
        const element = elements.find(el => el.symbol === last);
        if (element) {
            handleElementClick(element);
            banner.style.display = 'none';
        }
    };

    // --- Auto-resume last viewed element ---
    const lastCell = document.querySelector(`[data-symbol="${last}"]`);
    if (lastCell) {
        lastCell.classList.add('highlight'); // highlight the cell
        lastCell.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const elementData = elements.find(el => el.symbol === last);
        if (elementData) renderDetailPanel(elementData);
    }
}

// Load weak elements from localStorage when app starts
function loadWeakElements() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.WEAK_ELEMENTS);
        if (stored) {
            state.weakElements = JSON.parse(stored);
        }

        // Apply weak styling to elements
        Object.keys(state.weakElements).forEach(sym => {
            document.querySelectorAll(`[data-symbol="${sym}"]`).forEach(c => {
                c.classList.add('weak');
            });
        });
        updateProgressUI();

    } catch (e) {
        console.warn('Could not load weak elements:', e);
    }
}
// Updates progress bar based on weak elements count
function updateProgressUI() {
    const progressBar = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    const total = elements.length;
    const weakCount = Object.keys(state.weakElements).length;

    console.log("Total elements:", total, "Weak elements:", weakCount);

    const learned = total - weakCount;
    const percent = Math.round((learned / total) * 100);

    if (progressBar) {
        progressBar.style.width = percent + '%';
    }

    if (progressText) {
        progressText.textContent = `${percent}% completed`;
    }
}

// it fills the right-side panel with the element’s details (name, mass, number, etc.).
// It also manages the “Needs practice” checkbox and updates weak-element state + UI when toggled.
function renderDetailPanel(element) {
    const content = document.getElementById('detailContent');
    const actions = document.getElementById('detailActions');
    const hide = state.studyHidden;
    const showAtomicNumber = !hide.atomicNumber;
    const showAtomicMass = !hide.atomicMass;
    const showElectronConfig = !hide.electronConfiguration;
    const showGroup = !hide.group;
    const isWeak = state.weakElements[element.symbol] === 'weak';
    content.innerHTML = `
<h2>${element.name}</h2>
<label class="needs-practice-toggle">
<input type="checkbox" id="needsPracticeCheck" ${isWeak ? 'checked' :
            ''} data-symbol="${element.symbol}">
<span class="toggle-slider"></span>
<span class="toggle-label">Needs practice</span>
</label>
<div class="detail-row">
<span class="detail-label">Symbol</span>
<span class="detail-value">${element.symbol}</span>
</div>
<div class="detail-row">
<span class="detail-label">Atomic Number</span>
<span class="detail-value ${showAtomicNumber ? '' :
            'hidden'}">${showAtomicNumber ? element.atomicNumber : '???'}</span>
</div>
<div class="detail-row">
<span class="detail-label">Atomic Mass</span>
<span class="detail-value ${showAtomicMass ? '' :

            'hidden'}">${showAtomicMass ? element.atomicMass : '???'}</span>
</div>
<div class="detail-row">
<span class="detail-label">Group</span>
<span class="detail-value ${showGroup ? '' : 'hidden'}">${showGroup ?
            (element.group ?? '—') : '???'}</span>
</div>
<div class="detail-row">
<span class="detail-label">Period</span>
<span class="detail-value">${element.period}</span>
</div>
<div class="detail-row">
<span class="detail-label">Electron Configuration</span>
<span class="detail-value ${showElectronConfig ? '' :
            'hidden'}">${showElectronConfig ? element.electronConfiguration :
                '???'}</span>
</div>
`;
    actions.style.display = 'flex';
    actions.dataset.symbol = element.symbol; // Store for Reveal, Select to Compare
    const toggle = content.querySelector('#needsPracticeCheck');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            const sym = e.target.dataset.symbol;
            if (e.target.checked) {
                state.weakElements[sym] = 'weak';
            } else {
                delete state.weakElements[sym];
            }
            saveWeakElements();
            updateProgressUI();
            document.querySelectorAll(`[data-symbol="${sym}"]`).forEach(c =>
                c.classList.toggle('weak', e.target.checked));
        });
    }
    const compareBtn = document.getElementById('compareSelectBtn');

    if (compareBtn) {
        compareBtn.onclick = () => {
            handleCompareSelection(element);
        };
    }
}

function handleCompareSelection(element) {
    const sym = element.symbol;

    // Prevent duplicate selection
    if (state.compareSelection.includes(sym)) return;

    // Allow only 2 elements
    if (state.compareSelection.length >= 2) {
        state.compareSelection.shift(); // remove oldest
    }

    state.compareSelection.push(sym);

    renderComparison();
}

function renderComparison() {
    const panel = document.getElementById('comparisonPanel');
    const table = document.getElementById('comparisonTable');
    const hint = document.getElementById('comparisonHint');

    if (state.compareSelection.length < 2) {
        panel.style.display = 'block';
        hint.textContent = "Select 2 elements to compare";
        table.innerHTML = "";
        return;
    }

    const el1 = elements.find(e => e.symbol === state.compareSelection[0]);
    const el2 = elements.find(e => e.symbol === state.compareSelection[1]);

    panel.style.display = 'block';
    hint.textContent = "";

    table.innerHTML = `
        <table>
            <tr>
                <th>Property</th>
                <th>${el1.symbol}</th>
                <th>${el2.symbol}</th>
            </tr>
            <tr>
                <td>Name</td>
                <td>${el1.name}</td>
                <td>${el2.name}</td>
            </tr>
            <tr>
                <td>Atomic Number</td>
                <td>${el1.atomicNumber}</td>
                <td>${el2.atomicNumber}</td>
            </tr>
            <tr>
                <td>Atomic Mass</td>
                <td>${el1.atomicMass}</td>
                <td>${el2.atomicMass}</td>
            </tr>
            <tr>
                <td>Group</td>
                <td>${el1.group}</td>
                <td>${el2.group}</td>
            </tr>
            <tr>
                <td>Period</td>
                <td>${el1.period}</td>
                <td>${el2.period}</td>
            </tr>
            <tr>
                <td>Electron Config</td>
                <td>${el1.electronConfiguration}</td>
                <td>${el2.electronConfiguration}</td>
            </tr>
        </table>
    `;
}

document.getElementById('clearComparison').addEventListener('click', () => {
    state.compareSelection = [];
    document.getElementById('comparisonTable').innerHTML = "";
    document.getElementById('comparisonHint').textContent =
        "1. Click an element → 2. Select to Compare → 3. Repeat";
});

document.getElementById('closeComparison').addEventListener('click', () => {
    document.getElementById('comparisonPanel').style.display = 'none';
});

document.getElementById('compareBtn').addEventListener('click', () => {
    document.getElementById('comparisonPanel').style.display = 'block';
});

function saveWeakElements() {
    try {
        localStorage.setItem(STORAGE_KEYS.WEAK_ELEMENTS,
            JSON.stringify(state.weakElements));
    } catch (e) {
        console.warn('Could not save weak elements:', e);
    }
}


function loginModal() {
    const profileModal = document.getElementById("profileModal");
    const profileForm = document.getElementById("profileForm");
    const tagline = document.getElementById('headerTagline');

    // ✅ On load, check if profile already exists and update tagline
    const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (stored) {
        const profile = JSON.parse(stored);
        state.userName = profile.name;
        state.userEmail = profile.email;
        if (tagline) tagline.textContent = `Welcome, ${profile.name} — periodic table study tool`;
    } else {
        profileModal.style.display = "flex";
    }

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value.trim();
        const email = document.getElementById('profileEmail').value.trim();

        const profile = { name, email };
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
        state.userName = name;
        state.userEmail = email;
        profileModal.style.display = 'none';

        if (tagline) tagline.textContent = `Welcome, ${name} — periodic table study tool`;
        loadWelcomeModal();
    });
}


function loadWelcomeModal() {
    const welcome = document.getElementById('welcomeModal');
    const start = document.getElementById('welcomeClose');
    welcome.style.display = "flex"

    start.addEventListener('click', () => {
        welcome.style.display = "none"
    })

}

function loadState() {
    try {
        const weak = localStorage.getItem(STORAGE_KEYS.WEAK_ELEMENTS);
        if (weak) state.weakElements = JSON.parse(weak);

        const last = localStorage.getItem(STORAGE_KEYS.LAST_VIEWED);
        if (last) state.lastViewed = last;

        const hidden = localStorage.getItem(STORAGE_KEYS.STUDY_HIDDEN);
        if (hidden) state.studyHidden = JSON.parse(hidden);

    } catch (e) {
        console.warn("State load error:", e);
    }
}
function setupSearch() {
    const input = document.getElementById('searchInput');

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();

        const cells = document.querySelectorAll('.element-cell');

        // Reset if empty
        if (query === '') {
            cells.forEach(cell => {
                cell.classList.remove('highlight');
                cell.classList.remove('hidden');
            });
            return;
        }

        // Filter matching elements
        const matches = ELEMENTS.filter(el =>
            el.name.toLowerCase().includes(query) ||
            el.symbol.toLowerCase().includes(query) ||
            el.atomicNumber.toString().includes(query)
        );


        cells.forEach(cell => {
            const symbol = cell.dataset.symbol;

            let isMatch = false;


            for (let i = 0; i < matches.length; i++) {
                if (matches[i].symbol === symbol) {
                    isMatch = true;
                    break; // stop loop once found
                }
            }

            if (isMatch) {
                cell.classList.add('highlight');
                cell.classList.remove('hidden');
            } else {
                cell.classList.remove('highlight');

                if (query.length >= 2) {
                    cell.classList.add('hidden');
                }
            }
        });
    });
}
// Applies All/Weak and period filters before rendering
function getFilteredElements() {
    let elements = ELEMENTS;
    if (state.filterMode === 'weak') {
        elements = elements.filter(el => state.weakElements[el.symbol] ===
            'weak');
    }
    if (state.filterPeriods.length > 0) {
        elements = elements.filter(el =>
            state.filterPeriods.includes(el.period));
    }
    return elements;
}

function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const periodCheckboxes = document.querySelectorAll('.period-filter');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filterMode = btn.dataset.filter;
            renderElement();
        });
    });
    periodCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {

            state.filterPeriods = Array.from(document.querySelectorAll('.period-filter:checked'))

                .map(c => parseInt(c.value, 10));
            renderElement();
        });
    });
}

function restoreUIState() {
    // Restore weak styling
    Object.keys(state.weakElements).forEach(sym => {
        document.querySelectorAll(`[data-symbol="${sym}"]`)
            .forEach(c => c.classList.add('weak'));
    });

    // Restore last viewed
    if (state.lastViewed) {
        const el = elements.find(e => e.symbol === state.lastViewed);
        if (el) handleElementClick(el);
    }
}

//Quiz part 

function startQuiz() {
    state.quizScore = 0;
    state.quizTotal = 0;
    state.quizActive = true;
    document.getElementById('quizModal').style.display = 'flex';

    nextQuestion();
}

function nextQuestion() {
    if (!state.quizActive) return; // 🔥 IMPORTANT FIX
    const questionEl = document.getElementById('quizQuestion');
    const optionsEl = document.getElementById('quizOptions');

    const correct = elements[Math.floor(Math.random() * elements.length)];

    const options = [correct];

    while (options.length < 4) {
        const rand = elements[Math.floor(Math.random() * elements.length)];
        if (!options.includes(rand)) options.push(rand);
    }

    options.sort(() => Math.random() - 0.5);

    questionEl.textContent = `What is the symbol of ${correct.name}?`;
    optionsEl.innerHTML = '';

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt.symbol;

        btn.addEventListener('click', () => {
            state.quizTotal++;

            if (opt.symbol === correct.symbol) {
                state.quizScore++;
            }

            updateQuizScore();
            nextQuestion();
        });

        optionsEl.appendChild(btn);
    });
}

function updateQuizScore() {
    document.getElementById('quizScore').textContent = state.quizScore;
    document.getElementById('quizTotal').textContent = state.quizTotal;
}

document.getElementById('quizBtn').addEventListener('click', startQuiz);
function endQuiz() {
    state.quizActive = false; // 🔥 STOP quiz
    const questionEl = document.getElementById('quizQuestion');
    const optionsEl = document.getElementById('quizOptions');

    questionEl.textContent = `Final Score: ${state.quizScore} / ${state.quizTotal}`;
    optionsEl.innerHTML = `<p>Great job! 🎉</p>`;

    // Reset state AFTER showing result (optional delay)
    setTimeout(() => {
        state.quizScore = 0;
        state.quizTotal = 0;

        document.getElementById('quizModal').style.display = 'none';
    }, 2000);
}
document.getElementById('quizClose').addEventListener('click', endQuiz);




document.addEventListener('DOMContentLoaded', () => {
    // Run on load - table is built when DOM is ready
    loadState();
    renderElement();
    loginModal();
    loadWeakElements();
    setupSearch();
    setupFilters();
    updateProgressUI();
    loadContinueBanner();
    restoreUIState();
})
