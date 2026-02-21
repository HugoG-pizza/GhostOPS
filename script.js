import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCyag9xRPwQ_abIWO7Ng-paqdUg5sIjqHk",
  authDomain: "train-manager-83516.firebaseapp.com",
  databaseURL: "https://train-manager-83516-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "train-manager-83516",
  storageBucket: "train-manager-83516.firebasestorage.app",
  messagingSenderId: "877276977784",
  appId: "1:877276977784:web:839e7f2f234139a3692b8d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth();

// --- PARAMÈTRES MÉTIER APP 3 ---
// Tu peux modifier les noms ici, tout le reste s'adaptera automatiquement !
const CHARACTERS = ["Adam", "Fiona","McGregor", "Tesla", "Schuyler", "Lucius", "Morrison"];
const LEVELS = ["NAN", "3⭐", "4⭐"];
const RANK_POWER = { 'R5': 5, 'R4': 4, 'R3': 3, 'R2': 2, 'R1': 1, 'ABS': 0 };

// --- DONNÉES ---
let members = [];
let rosterData = {}; // Format: { "Pseudo": { "Perso 1": "3⭐", "Perso 2": "NAN"... } }

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            startDatabaseListener();
        } else {
            signInAnonymously(auth).catch(console.error);
        }
    });
});

function initFilters() {
    const charSelect = document.getElementById('filterChar');
    CHARACTERS.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c;
        charSelect.appendChild(opt);
    });
}

function startDatabaseListener() {
    // 1. Lire la liste des joueurs partagée
    onValue(ref(db, 'members'), (snapshot) => {
        const val = snapshot.val();
        members = val ? Object.values(val) : [];
        renderGrid();
    });

    // 2. Lire les données de possession (Uniquement App 3)
    onValue(ref(db, 'app3/roster'), (snapshot) => {
        rosterData = snapshot.val() || {};
        renderGrid();
    });
}

// --- LOGIQUE METIER (CLIC POUR CHANGER DE NIVEAU) ---

window.cycleLevel = function(playerName, characterName) {
    if (!auth.currentUser) return;

    // Récupérer le niveau actuel (ou NAN par défaut)
    const playerRoster = rosterData[playerName] || {};
    const currentLevel = playerRoster[characterName] || "NAN";

    // Trouver le prochain niveau dans le cycle
    let currentIndex = LEVELS.indexOf(currentLevel);
    let nextIndex = (currentIndex + 1) % LEVELS.length;
    let newLevel = LEVELS[nextIndex];

    // Sauvegarder dans Firebase
    const updates = {};
    updates[`app3/roster/${playerName}/${characterName}`] = newLevel;
    
    update(ref(db), updates).catch(console.error);

    // Optionnel: Ajouter un log pour tracer qui a modifié quoi
    // push(ref(db, 'app3/logs'), `[${new Date().toLocaleString()}] ${playerName} -> ${characterName} = ${newLevel}`);
}

// --- RENDU UI ---

window.resetFilters = function() {
    document.getElementById('filterChar').value = "ALL";
    document.getElementById('filterLevel').value = "ALL";
    document.getElementById('searchPlayer').value = "";
    renderGrid();
}

window.renderGrid = function() {
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    
    const filterChar = document.getElementById('filterChar').value;
    const filterLevel = document.getElementById('filterLevel').value;
    const search = document.getElementById('searchPlayer').value.toLowerCase();

    // 1. Construire les en-têtes (Joueur + Les 7 persos)
    tableHeader.innerHTML = '<th style="text-align:left; padding-left:15px; width:200px;">Joueur</th>';
    CHARACTERS.forEach(c => {
        // Mettre en surbrillance la colonne si elle est filtrée
        const isFiltered = (filterChar === c) ? 'color: var(--accent);' : '';
        tableHeader.innerHTML += `<th style="${isFiltered}">${c}</th>`;
    });

    tableBody.innerHTML = '';

    // 2. Trier les membres (Par Rang puis par nom)
    let sortedMembers = [...members].sort((a, b) => {
        const diff = RANK_POWER[b.rank] - RANK_POWER[a.rank];
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

    // 3. Appliquer les filtres
    let filteredMembers = sortedMembers.filter(m => {
        // Filtre de nom
        if (search && !m.name.toLowerCase().includes(search)) return false;
        
        // Filtre "Aiguilleur"
        if (filterChar !== "ALL" && filterLevel !== "ALL") {
            const charLvl = (rosterData[m.name] && rosterData[m.name][filterChar]) ? rosterData[m.name][filterChar] : "NAN";
            if (filterLevel === "4⭐" && charLvl !== "4⭐") return false;
            if (filterLevel === "3⭐" && charLvl === "NAN") return false; // Accepte 3* et 4*
        }
        return true;
    });

    // 4. Générer les lignes
    if(filteredMembers.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${CHARACTERS.length + 1}" style="text-align:center; padding:20px; color:#666;">Aucun joueur ne correspond aux critères.</td></tr>`;
        return;
    }

    filteredMembers.forEach(m => {
        let rowHTML = `
            <tr>
                <td class="player-cell">
                    <span class="rank-mini-badge ${m.rank === 'ABS' ? 'abs-badge' : ''}">${m.rank}</span>
                    <span class="player-name">${m.name}</span>
                </td>
        `;

        CHARACTERS.forEach(c => {
            const playerRoster = rosterData[m.name] || {};
            const lvl = playerRoster[c] || "NAN";
            
            // Classes CSS selon le niveau
            let btnClass = "btn-nan";
            if(lvl === "3⭐") btnClass = "btn-3star";
            if(lvl === "4⭐") btnClass = "btn-4star";

            // Atténuer les colonnes non concernées par le filtre pour une meilleure lisibilité
            let opacityStyle = (filterChar !== "ALL" && filterChar !== c) ? "opacity: 0.3;" : "";

            rowHTML += `
                <td style="${opacityStyle}">
                    <button class="roster-btn ${btnClass}" onclick="cycleLevel('${m.name}', '${c}')">
                        ${lvl}
                    </button>
                </td>
            `;
        });

        rowHTML += `</tr>`;
        tableBody.innerHTML += rowHTML;
    });
}