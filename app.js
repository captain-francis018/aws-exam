// AWS Cloud Practitioner - Application principale
// Version 3.0 - Architecture statique : contenu pré-rendu, données embarquées, zéro fetch

let quizData = window.EMBEDDED_DATA.qcm;
let simulationData = window.EMBEDDED_DATA.simulation;
let scenarioData = window.EMBEDDED_DATA.scenarios || [];
let examTimer = null;
let examAnswers = {};
let selectedDifficulty = 'simulation';
let currentExamQuestions = [];
let currentExamMode = selectedDifficulty;
let deferredPrompt = null;
const EXAM_MODE_DEDICATED = 'simulation';
const EXAM_TOTAL_QUESTIONS = 65;
const EXAM_SCORED_QUESTIONS = 50;
const EXAM_PASS_PERCENTAGE = 70;
const PRACTICE_QUESTIONS_PER_MODE = 20;
let learningProgressState = [];
let currentLearningStep = -1;
let currentLearningTab = 'accueil';
const LEARNING_PROGRESS_KEY = 'awsExamLearningProgress';
const LEARNING_PROGRESS_SESSION_KEY = 'awsExamLearningProgressSession';

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupDifficultySelector();
    setupLearningProgress();
    registerServiceWorker();
    setupInstallPrompt();
    setupKeyboardShortcuts();
    setupScrollToNavButton();
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js?v=2').catch(() => {});
        });
    }
}

function setupInstallPrompt() {
    const banner = document.getElementById('installBanner');
    const button = document.getElementById('installButton');
    const message = banner ? banner.querySelector('p') : null;
    if (!banner || !button) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
        banner.hidden = true;
        return;
    }

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    const showFallbackMessage = (text) => {
        if (message) {
            message.textContent = text;
        }
        banner.hidden = false;
    };

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        if (message) {
            message.textContent = 'Ajoutez cette formation à votre écran d’accueil pour l’utiliser hors ligne et plus rapidement sur votre téléphone.';
        }
        button.textContent = 'Installer';
        banner.hidden = false;
    });

    button.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                banner.hidden = true;
            }
            deferredPrompt = null;
            return;
        }

        if (isIOS) {
            showFallbackMessage('Sur iPhone ou iPad, ouvrez le menu Partager puis choisissez “Ajouter à l’écran d’accueil”.');
        } else if (isAndroid) {
            showFallbackMessage('Sur Android, ouvrez le menu du navigateur puis choisissez “Ajouter à l’écran d’accueil”.');
        } else {
            showFallbackMessage('L’installation n’est pas disponible dans ce navigateur. Essayez Chrome ou Edge sur mobile.');
        }
    });

    window.addEventListener('appinstalled', () => {
        banner.hidden = true;
    });

    if (isIOS) {
        showFallbackMessage('Sur iPhone ou iPad, ouvrez le menu Partager puis choisissez “Ajouter à l’écran d’accueil”.');
    } else if (isAndroid) {
        showFallbackMessage('Sur Android, ouvrez le menu du navigateur puis choisissez “Ajouter à l’écran d’accueil”.');
    } else {
        showFallbackMessage('L’installation n’est pas disponible dans ce navigateur. Essayez Chrome ou Edge sur mobile.');
    }
}

function setupScrollToNavButton() {
    const button = document.getElementById('scrollToNavBtn');
    const nav = document.getElementById('navTabs');
    if (!button || !nav) return;

    const toggleButton = () => {
        const shouldShow = window.scrollY > 250;
        button.classList.toggle('show', shouldShow);
    };

    window.addEventListener('scroll', toggleButton, { passive: true });
    toggleButton();

    button.addEventListener('click', () => {
        const navTop = nav.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: navTop - 8, behavior: 'auto' });
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        const shortcuts = {
            h: 'accueil',
            q: 'qcm',
            e: 'simulation',
            c: 'module1',
            s: 'module2'
        };

        if (event.target && ['input', 'textarea', 'select'].includes(event.target.tagName.toLowerCase())) {
            return;
        }

        if (shortcuts[key]) {
            event.preventDefault();
            loadContent(shortcuts[key]);
            document.querySelectorAll('.nav-tab, .quick-action').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-tab') === shortcuts[key]);
            });
        }
    });
}

function setupDifficultySelector() {
    const buttons = document.querySelectorAll('.difficulty-option');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDifficulty = btn.getAttribute('data-difficulty');

            const hints = {
                facile: 'Mode Facile : questions aléatoires de niveau facile.',
                moyen: 'Mode Moyen : questions aléatoires de niveau moyen.',
                difficile: 'Mode Difficile : questions aléatoires de niveau difficile.',
                simulation: 'Mode Simulation réelle : examen AWS Cloud Practitioner réaliste avec questions dédiées.',
            };
            document.getElementById('difficultyHint').textContent = hints[selectedDifficulty] || 'Choisissez un mode de simulation.';
        });
    });
}

// ===== NAVIGATION (simple bascule d'affichage, contenu déjà dans le DOM) =====
function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const quickActions = document.querySelectorAll('.quick-action');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            loadContent(tabId);
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    quickActions.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            loadContent(tabId);
            tabs.forEach(t => t.classList.remove('active'));
            const matchingTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
            if (matchingTab) matchingTab.classList.add('active');
        });
    });
}

function setupLearningProgress() {
    const steps = document.querySelectorAll('.progress-step');
    const resetButton = document.getElementById('resetLearningProgressBtn');
    if (!steps.length) return;

    const savedState = loadLearningProgressState();
    if (savedState.steps && savedState.steps.length) {
        learningProgressState = savedState.steps;
        currentLearningStep = savedState.currentStep;
        currentLearningTab = savedState.lastTab || 'accueil';
    }

    steps.forEach(step => {
        step.addEventListener('click', () => {
            const target = step.getAttribute('data-target');
            if (target) {
                loadContent(target);
                markLearningStep(target);
            }
        });
    });

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (window.confirm('Réinitialiser la progression du parcours ?')) {
                resetLearningProgress();
            }
        });
    }

    const restoredTab = currentLearningTab && document.getElementById(`section-${currentLearningTab}`) ? currentLearningTab : 'accueil';
    if (restoredTab !== 'accueil') {
        loadContent(restoredTab, { persist: false, scroll: false });
    }

    renderLearningProgress();
}

function loadLearningProgressState() {
    try {
        const sessionState = sessionStorage.getItem(LEARNING_PROGRESS_SESSION_KEY);
        if (sessionState) {
            return JSON.parse(sessionState);
        }
    } catch (error) {
        console.warn('Impossible de lire la progression de session', error);
    }

    try {
        const storedState = localStorage.getItem(LEARNING_PROGRESS_KEY);
        if (storedState) {
            return JSON.parse(storedState);
        }
    } catch (error) {
        console.warn('Impossible de lire la progression sauvegardée', error);
    }

    return { steps: [], currentStep: -1, lastTab: 'accueil' };
}

function saveLearningProgressState() {
    const payload = {
        steps: learningProgressState,
        currentStep: currentLearningStep,
        lastTab: currentLearningTab
    };

    try {
        sessionStorage.setItem(LEARNING_PROGRESS_SESSION_KEY, JSON.stringify(payload));
        localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Impossible d’enregistrer la progression', error);
    }
}

function markLearningStep(tabId) {
    const stepIndex = getLearningStepIndex(tabId);
    if (stepIndex === -1) return;

    const completedSteps = new Set(learningProgressState);
    for (let i = 0; i <= stepIndex; i += 1) {
        completedSteps.add(i);
    }

    learningProgressState = Array.from(completedSteps).sort((a, b) => a - b);
    currentLearningStep = stepIndex;
    currentLearningTab = tabId;
    saveLearningProgressState();
    renderLearningProgress();
}

function resetLearningProgress() {
    learningProgressState = [];
    currentLearningStep = -1;
    currentLearningTab = 'accueil';

    try {
        sessionStorage.removeItem(LEARNING_PROGRESS_SESSION_KEY);
        localStorage.removeItem(LEARNING_PROGRESS_KEY);
    } catch (error) {
        console.warn('Impossible de supprimer la progression', error);
    }

    renderLearningProgress();
    loadContent('accueil', { persist: false, scroll: false });
}

function getLearningStepIndex(tabId) {
    const stepMap = {
        module1: 0,
        module2: 1,
        module3: 2,
        services: 3,
        module4: 4,
        comparaisons: 5,
        qcm: 6,
        scenarios: 6,
        simulation: 6
    };
    return stepMap[tabId] ?? -1;
}

function renderLearningProgress() {
    const steps = document.querySelectorAll('.progress-step');
    if (!steps.length) return;

    const totalSteps = steps.length;
    const progressPercent = Math.round((learningProgressState.length / totalSteps) * 100);
    const progressBar = document.getElementById('learningProgressBar');
    const progressText = document.getElementById('learningProgressText');

    if (progressBar) {
        progressBar.style.width = `${Math.max(progressPercent, 8)}%`;
    }

    if (progressText) {
        progressText.textContent = `${learningProgressState.length}/${totalSteps} étapes terminées`;
    }

    steps.forEach((step, index) => {
        const isCompleted = learningProgressState.includes(index);
        const isCurrent = index === currentLearningStep;
        step.classList.toggle('completed', isCompleted);
        step.classList.toggle('current', isCurrent);
    });
}

function loadContent(tabId, options = {}) {
    const { persist = true, scroll = true } = options;

    if (persist) {
        markLearningStep(tabId);
    }

    document.querySelectorAll('.tab-section').forEach(sec => {
        sec.style.display = 'none';
    });
    const target = document.getElementById(`section-${tabId}`);
    if (target) target.style.display = 'block';

    document.getElementById('examTimer').style.display = 'none';
    if (scroll) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (tabId === 'qcm' && !document.getElementById('quizQuestionsContainer').dataset.loaded) {
        loadQuizQuestions();
    }

    if (tabId === 'scenarios' && !document.getElementById('scenarioQuestionsContainer').dataset.loaded) {
        loadScenarioQuestions();
    }
}

// ===== ACCORDÉON (page d'accueil) =====
function toggleAccordion(header) {
    const content = header.nextElementSibling;
    const isActive = header.classList.contains('active');
    document.querySelectorAll('.accordion-header').forEach(h => {
        h.classList.remove('active');
        h.nextElementSibling.classList.remove('show');
    });
    if (!isActive) {
        header.classList.add('active');
        content.classList.add('show');
    }
}

// ===== QCM DE PRATIQUE =====
function loadQuizQuestions() {
    const container = document.getElementById('quizQuestionsContainer');
    if (!container) return;

    // Exclure les questions scénario et multiples du QCM simple
    const simpleQuestions = quizData.filter(q => !q.scenario && !Array.isArray(q.correct) && q.type !== 'multiple');
    const selectedQuestions = shuffleArray([...simpleQuestions]).slice(0, 20);
    container.dataset.loaded = 'true';

    container.innerHTML = selectedQuestions.map((q, index) => {
        const isMultiple = q.type === 'multiple' || Array.isArray(q.correct);
        const inputType = isMultiple ? 'checkbox' : 'radio';

        return `
        <div class="quiz-container">
            <div class="question" data-question-id="${q.id}" data-is-multiple="${isMultiple}">
                <h4>
                    <span class="question-number">Question ${index + 1}</span>
                    ${q.question}
                    ${isMultiple ? '<br><small style="color:#c0392b;">⚠️ Sélectionnez ' + (Array.isArray(q.correct) ? q.correct.length : 2) + ' réponses</small>' : ''}
                </h4>
                <div class="options-container">
                    ${q.options.map((option, optIndex) => `
                        <div class="option" onclick="selectQuizOption(event, ${q.id}, ${optIndex}, ${isMultiple})">
                            <input type="${inputType}" name="quiz_${q.id}" value="${optIndex}" id="quiz_${q.id}_${optIndex}">
                            <label for="quiz_${q.id}_${optIndex}">${option}</label>
                        </div>
                    `).join('')}
                </div>
                <div class="explanation" id="explanation_${q.id}">
                    <strong>💡 Explication :</strong> ${q.explanation}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function selectQuizOption(event, questionId, optionIndex, isMultiple) {
    const input = document.getElementById(`quiz_${questionId}_${optionIndex}`);
    const optionDiv = input.parentElement;
    // Si le clic vient directement de l'input ou du label, le navigateur a déjà
    // mis à jour input.checked nativement : il ne faut pas le retoggler ici.
    const clickedOnNativeControl = event.target === input || event.target.tagName === 'LABEL';

    if (isMultiple) {
        // Checkbox : toggle (sauf si déjà togglé nativement)
        if (!clickedOnNativeControl) {
            input.checked = !input.checked;
        }
        optionDiv.classList.toggle('selected', input.checked);
    } else {
        // Radio : désélectionner les autres
        if (!clickedOnNativeControl) {
            input.checked = true;
        }
        const options = document.querySelectorAll(`input[name="quiz_${questionId}"]`);
        options.forEach((opt) => {
            opt.parentElement.classList.remove('selected');
        });
        optionDiv.classList.add('selected');
    }
}

function checkQuizAnswers() {
    let score = 0;
    let total = 0;

    document.querySelectorAll('#quizQuestionsContainer .question').forEach(questionDiv => {
        const questionId = parseInt(questionDiv.getAttribute('data-question-id'));
        const question = quizData.find(q => q.id === questionId);
        if (!question) return;

        total++;
        const isMultiple = Array.isArray(question.correct);
        const selectedInputs = questionDiv.querySelectorAll('input:checked');
        const userAnswers = Array.from(selectedInputs).map(inp => parseInt(inp.value)).sort();
        const correctAnswers = isMultiple ? [...question.correct].sort() : [question.correct];

        const options = questionDiv.querySelectorAll('.option');

        // Désactiver toutes les options
        options.forEach(opt => {
            opt.classList.add('disabled');
            opt.querySelector('input').disabled = true;
        });

        // Vérifier si la réponse est correcte
        const isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);

        if (isCorrect) {
            score++;
        }

        // Marquer visuellement les réponses
        options.forEach((opt, idx) => {
            const isCorrectOption = correctAnswers.includes(idx);
            const wasSelected = userAnswers.includes(idx);

            if (isCorrectOption) {
                opt.classList.add('correct');
            } else if (wasSelected && !isCorrectOption) {
                opt.classList.add('incorrect');
            }
        });

        document.getElementById(`explanation_${questionId}`).classList.add('show');
    });

    const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';
    const passed = percentage >= 70;

    document.getElementById('quizResults').innerHTML = `
        <div class="score-card">
            <div class="emoji">${passed ? '🎉' : '📚'}</div>
            <h2>${score} / ${total}</h2>
            <p style="font-size: 2em; margin: 20px 0;">${percentage}%</p>
            <p style="font-size: 1.3em;">
                ${passed ? '✅ Excellent ! Vous êtes prêt pour la simulation complète !' : '❌ Continuez à réviser'}
            </p>
            ${!passed ? '<p>Score de réussite requis : 70%. Révisez les modules et réessayez !</p>' : ''}
        </div>
    `;
    document.getElementById('quizResults').style.display = 'block';
    document.getElementById('quizResults').scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function resetQuiz() {
    loadQuizQuestions();
    document.getElementById('quizResults').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== SCÉNARIOS PRATIQUES =====
function loadScenarioQuestions() {
    const container = document.getElementById('scenarioQuestionsContainer');
    if (!container || scenarioData.length === 0) return;

    container.dataset.loaded = 'true';

    const shuffledScenarios = shuffleArray(scenarioData);

    container.innerHTML = shuffledScenarios.map((q, index) => {
        const isMultiple = q.type === 'multiple' || Array.isArray(q.correct);
        const inputType = isMultiple ? 'checkbox' : 'radio';

        return `
        <div class="quiz-container">
            <div class="question" data-question-id="${q.id}" data-is-multiple="${isMultiple}">
                <div style="margin-bottom: 10px;">
                    <span class="difficulty-badge ${q.difficulty}">${q.difficulty}</span>
                    <span class="badge badge-info">${q.domain}</span>
                </div>
                <h4>
                    <span class="question-number">Scénario ${index + 1}/${scenarioData.length}</span>
                    ${q.question}
                    ${isMultiple ? '<br><small style="color:#c0392b;">⚠️ Sélectionnez ' + (Array.isArray(q.correct) ? q.correct.length : 2) + ' réponses</small>' : ''}
                </h4>
                <div class="options-container">
                    ${q.options.map((option, optIndex) => `
                        <div class="option" onclick="selectScenarioOption(event, ${q.id}, ${optIndex}, ${isMultiple})">
                            <input type="${inputType}" name="scenario_${q.id}" value="${optIndex}" id="scenario_${q.id}_${optIndex}">
                            <label for="scenario_${q.id}_${optIndex}">${option}</label>
                        </div>
                    `).join('')}
                </div>
                <div class="explanation" id="explanation_scenario_${q.id}">
                    <strong>💡 Explication :</strong> ${q.explanation}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function selectScenarioOption(event, questionId, optionIndex, isMultiple) {
    const input = document.getElementById(`scenario_${questionId}_${optionIndex}`);
    const optionDiv = input.parentElement;
    const clickedOnNativeControl = event.target === input || event.target.tagName === 'LABEL';

    if (isMultiple) {
        // Checkbox : toggle (sauf si déjà togglé nativement)
        if (!clickedOnNativeControl) {
            input.checked = !input.checked;
        }
        optionDiv.classList.toggle('selected', input.checked);
    } else {
        // Radio : désélectionner les autres
        if (!clickedOnNativeControl) {
            input.checked = true;
        }
        const options = document.querySelectorAll(`input[name="scenario_${questionId}"]`);
        options.forEach((opt) => {
            opt.parentElement.classList.remove('selected');
        });
        optionDiv.classList.add('selected');
    }
}

function checkScenarioAnswers() {
    let score = 0;
    let total = 0;

    document.querySelectorAll('#scenarioQuestionsContainer .question').forEach(questionDiv => {
        const questionId = parseInt(questionDiv.getAttribute('data-question-id'));
        const question = scenarioData.find(q => q.id === questionId);
        if (!question) return;

        total++;
        const isMultiple = Array.isArray(question.correct);
        const selectedInputs = questionDiv.querySelectorAll('input:checked');
        const userAnswers = Array.from(selectedInputs).map(inp => parseInt(inp.value)).sort();
        const correctAnswers = isMultiple ? [...question.correct].sort() : [question.correct];

        const options = questionDiv.querySelectorAll('.option');

        // Désactiver toutes les options
        options.forEach(opt => {
            opt.classList.add('disabled');
            opt.querySelector('input').disabled = true;
        });

        // Vérifier si la réponse est correcte
        const isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);

        if (isCorrect) {
            score++;
        }

        // Marquer visuellement les réponses
        options.forEach((opt, idx) => {
            const isCorrectOption = correctAnswers.includes(idx);
            const wasSelected = userAnswers.includes(idx);

            if (isCorrectOption) {
                opt.classList.add('correct');
            } else if (wasSelected && !isCorrectOption) {
                opt.classList.add('incorrect');
            }
        });

        document.getElementById(`explanation_scenario_${questionId}`).classList.add('show');
    });

    const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';
    const passed = percentage >= 70;

    document.getElementById('scenarioResults').innerHTML = `
        <div class="score-card">
            <div class="emoji">${passed ? '🎉' : '📚'}</div>
            <h2>${score} / ${total}</h2>
            <p style="font-size: 2em; margin: 20px 0;">${percentage}%</p>
            <p style="font-size: 1.3em;">
                ${passed ? '✅ Excellent ! Vous maîtrisez les scénarios complexes !' : '❌ Ces scénarios nécessitent plus de pratique'}
            </p>
            ${!passed ? '<p>Révisez les concepts clés dans les modules, puis réessayez. Les scénarios testent votre capacité à combiner plusieurs notions AWS.</p>' : ''}
        </div>
    `;
    document.getElementById('scenarioResults').style.display = 'block';
    document.getElementById('scenarioResults').scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function resetScenarios() {
    loadScenarioQuestions();
    document.getElementById('scenarioResults').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== UTILITAIRES =====
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ===== SIMULATION D'EXAMEN BLANC (moteur complet, implémenté) =====
function startExamSimulation() {
    if (!simulationData || simulationData.length === 0) {
        alert("Aucune question de simulation n'est disponible pour le moment.");
        return;
    }

    currentExamMode = selectedDifficulty;
    currentExamQuestions = getExamQuestionSet(currentExamMode);

    if (!currentExamQuestions || currentExamQuestions.length === 0) {
        alert("Aucune question disponible pour ce mode. Choisissez un autre niveau ou réessayez plus tard.");
        return;
    }

    currentExamQuestions.sort((a, b) => (a.scenario === b.scenario) ? 0 : (a.scenario ? 1 : -1));

    examAnswers = {};
    document.getElementById('examTimer').style.display = 'block';
    document.getElementById('examContent').style.display = 'block';
    document.getElementById('examResults').style.display = 'none';
    document.getElementById('examStartBtnWrapper').style.display = 'none';

    renderExamQuestions();
    startExamTimer(currentExamMode === 'simulation' ? 90 * 60 : 20 * 60);
}

function getExamQuestionSet(mode) {
    if (mode === 'simulation') {
        const shuffled = shuffleArray([...simulationData]);
        const total = Math.min(EXAM_TOTAL_QUESTIONS, shuffled.length);
        const deck = shuffled.slice(0, total);
        const scoredCount = Math.min(EXAM_SCORED_QUESTIONS, total);
        return deck.map((q, index) => ({ ...q, isTestQuestion: index >= scoredCount }));
    }

    const pool = simulationData.filter(q => q.difficulty === mode);
    return shuffleArray(pool).slice(0, PRACTICE_QUESTIONS_PER_MODE).map(q => ({ ...q, isTestQuestion: false }));
}

function renderExamQuestions() {
    const container = document.getElementById('examQuestions');
    const total = currentExamQuestions.length;
    const difficultyLabels = { facile: '🟢 Facile', moyen: '🟡 Moyen', difficile: '🔴 Difficile' };
    const isRealSimulation = currentExamMode === 'simulation';
    const scoredCount = currentExamQuestions.filter(q => !q.isTestQuestion).length;
    const testCount = currentExamQuestions.filter(q => q.isTestQuestion).length;

    document.getElementById('examProgress').innerHTML = `
        <div class="info-box">
            <strong>📋 ${total} question${total > 1 ? 's' : ''} au total</strong>
            ${isRealSimulation ? `<p>50 questions notées + ${testCount} questions test. Les résultats sont calculés uniquement sur les questions notées.</p>` : `<p>Mode pratique : ${total} questions de niveau ${currentExamMode}.</p>`}
            <p>Répondez à toutes les questions puis cliquez sur "Terminer l'Examen". Les scénarios complexes arrivent en fin d'examen.</p>
        </div>
    `;

    let firstScenarioRendered = false;

    container.innerHTML = currentExamQuestions.map((q, index) => {
        const isMultiple = q.type === 'multiple' || Array.isArray(q.correct);
        const inputType = isMultiple ? 'checkbox' : 'radio';

        let dividerHtml = '';
        if (q.scenario && !firstScenarioRendered) {
            dividerHtml = `<div class="scenario-divider">🧩 Scénarios approfondis — mobilisez plusieurs notions à la fois</div>`;
            firstScenarioRendered = true;
        }

        return `
            ${dividerHtml}
            <div class="quiz-container">
                <div class="question" data-question-id="${q.id}">
                    <div>
                        ${q.difficulty ? `<span class="difficulty-badge ${q.difficulty}">${difficultyLabels[q.difficulty] || q.difficulty}</span>` : ''}
                        ${q.scenario ? `<span class="scenario-badge">🧩 Scénario</span>` : ''}
                    </div>
                    <h4>
                        <span class="question-number">Question ${index + 1}/${total}</span>
                        ${q.question}
                        ${isMultiple ? '<br><small style="color:#c0392b;">⚠️ Sélectionnez ' + q.correct.length + ' réponses</small>' : ''}
                    </h4>
                    <div class="options-container">
                        ${q.options.map((option, optIndex) => `
                            <div class="option" onclick="selectExamOption(event, ${q.id}, ${optIndex}, ${isMultiple})">
                                <input type="${inputType}" name="exam_${q.id}" value="${optIndex}" id="exam_${q.id}_${optIndex}">
                                <label for="exam_${q.id}_${optIndex}">${option}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectExamOption(event, questionId, optionIndex, isMultiple) {
    if (!examAnswers[questionId]) examAnswers[questionId] = [];

    const input = document.getElementById(`exam_${questionId}_${optionIndex}`);
    const optionDiv = input.parentElement;
    const clickedOnNativeControl = event.target === input || event.target.tagName === 'LABEL';

    if (isMultiple) {
        if (!clickedOnNativeControl) {
            input.checked = !input.checked;
        }
        optionDiv.classList.toggle('selected', input.checked);
        examAnswers[questionId] = input.checked
            ? [...new Set([...examAnswers[questionId], optionIndex])]
            : examAnswers[questionId].filter(i => i !== optionIndex);
    } else {
        if (!clickedOnNativeControl) {
            input.checked = true;
        }
        document.querySelectorAll(`input[name="exam_${questionId}"]`).forEach(opt => {
            opt.parentElement.classList.remove('selected');
        });
        optionDiv.classList.add('selected');
        examAnswers[questionId] = [optionIndex];
    }
}

function startExamTimer(seconds) {
    let remaining = seconds;
    const timerEl = document.getElementById('examTimer');

    clearInterval(examTimer);
    examTimer = setInterval(() => {
        remaining--;
        timerEl.textContent = `⏱️ ${formatTime(remaining)}`;
        timerEl.classList.remove('warning', 'danger');
        if (remaining <= 300) timerEl.classList.add('danger');
        else if (remaining <= 900) timerEl.classList.add('warning');

        if (remaining <= 0) {
            clearInterval(examTimer);
            submitExam();
        }
    }, 1000);
}

let lastExamDetails = [];

function submitExam() {
    clearInterval(examTimer);
    document.getElementById('examTimer').style.display = 'none';

    let score = 0;
    const details = [];

    currentExamQuestions.forEach(q => {
        const userAnswer = (examAnswers[q.id] || []).slice().sort();
        const correctAnswer = Array.isArray(q.correct) ? [...q.correct].sort() : [q.correct];
        const isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
        if (isCorrect && !q.isTestQuestion) score++;
        details.push({ q, userAnswer, correctAnswer, isCorrect });
    });

    lastExamDetails = details;

    const scoredDetails = details.filter(d => !d.q.isTestQuestion);
    const totalScored = scoredDetails.length;
    const scoredCorrect = scoredDetails.filter(d => d.isCorrect).length;
    const percentage = totalScored > 0 ? ((scoredCorrect / totalScored) * 100).toFixed(1) : '0.0';
    const passed = percentage >= EXAM_PASS_PERCENTAGE;
    const incorrectCount = details.filter(d => !d.isCorrect).length;

    document.getElementById('examContent').style.display = 'none';

    const resultsEl = document.getElementById('examResults');
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
        <div class="score-card">
            <div class="emoji">${passed ? '🎉' : '📚'}</div>
            <h2>${scoredCorrect} / ${totalScored}</h2>
            <p style="font-size: 2em; margin: 20px 0;">${percentage}%</p>
            <p style="font-size: 1.3em;">${passed ? '✅ Réussi ! (seuil : ' + EXAM_PASS_PERCENTAGE + '%)' : '❌ Non atteint (seuil : ' + EXAM_PASS_PERCENTAGE + '%)'}</p>
        </div>
        <div class="module-card" style="margin-top: 20px;">
            <h3>📝 Détail des réponses</h3>
            <div class="tw flex flex-wrap gap-2 mb-5" id="examReviewFilter">
                <button type="button" class="review-filter-btn active" data-filter="all">Toutes (${details.length})</button>
                <button type="button" class="review-filter-btn" data-filter="incorrect">❌ Incorrectes (${incorrectCount})</button>
                <button type="button" class="review-filter-btn" data-filter="correct">✅ Correctes (${scoredCorrect})</button>
            </div>
            <div id="examReviewList"></div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <button class="btn btn-primary" onclick="loadContent('simulation'); document.getElementById('examStartBtnWrapper').style.display='block';">🔄 Refaire la simulation</button>
        </div>
    `;

    document.querySelectorAll('.review-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.review-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderExamReview(btn.getAttribute('data-filter'));
        });
    });

    renderExamReview('all');
    resultsEl.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function renderExamReview(filter) {
    const list = document.getElementById('examReviewList');
    if (!list) return;

    const filtered = lastExamDetails
        .map((d, i) => ({ ...d, originalIndex: i }))
        .filter(d => filter === 'all' || (filter === 'incorrect' && !d.isCorrect) || (filter === 'correct' && d.isCorrect));

    if (filtered.length === 0) {
        list.innerHTML = `<div class="info-box">Aucune question dans cette catégorie. 🎉</div>`;
        return;
    }

    list.innerHTML = filtered.map(d => {
        const isMultiple = Array.isArray(d.q.correct);
        return `
            <div class="detail-box" style="border-left: 4px solid ${d.isCorrect ? '#27ae60' : '#c0392b'}; margin-bottom: 20px;">
                <strong>Question ${d.originalIndex + 1} : ${d.isCorrect ? '✅ Correct' : '❌ Incorrect'}</strong>
                ${d.q.difficulty ? `<span class="difficulty-badge ${d.q.difficulty}" style="margin-left:8px;">${d.q.difficulty}</span>` : ''}
                ${d.q.scenario ? `<span class="scenario-badge">🧩 Scénario</span>` : ''}
                <p style="margin-top:10px;">${d.q.question}</p>
                <div class="options-container" style="margin-top:10px;">
                    ${d.q.options.map((opt, idx) => {
                        const isCorrectOpt = d.correctAnswer.includes(idx);
                        const wasSelected = d.userAnswer.includes(idx);
                        let cls = 'option disabled';
                        if (isCorrectOpt) cls += ' correct';
                        else if (wasSelected) cls += ' incorrect';
                        return `
                            <div class="${cls}">
                                <input type="${isMultiple ? 'checkbox' : 'radio'}" disabled ${wasSelected ? 'checked' : ''}>
                                <label>${opt}${wasSelected && !isCorrectOpt ? ' <em>(votre réponse)</em>' : ''}${isCorrectOpt ? ' ✓' : ''}</label>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${d.userAnswer.length === 0 ? '<p style="color:#c0392b; margin-top:8px;"><em>Vous n\'avez pas répondu à cette question.</em></p>' : ''}
                <p style="margin-top:10px;"><strong>💡 Explication :</strong> ${d.q.explanation}</p>
            </div>
        `;
    }).join('');
}
