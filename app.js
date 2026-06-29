// AWS Cloud Practitioner - Application principale
// Version 3.0 - Architecture statique : contenu pré-rendu, données embarquées, zéro fetch

let quizData = window.EMBEDDED_DATA.qcm;
let simulationData = window.EMBEDDED_DATA.simulation;
let examTimer = null;
let examAnswers = {};

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
});

// ===== NAVIGATION (simple bascule d'affichage, contenu déjà dans le DOM) =====
function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            loadContent(tabId);
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

function loadContent(tabId) {
    document.querySelectorAll('.tab-section').forEach(sec => {
        sec.style.display = 'none';
    });
    const target = document.getElementById(`section-${tabId}`);
    if (target) target.style.display = 'block';

    document.getElementById('examTimer').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'qcm' && !document.getElementById('quizQuestionsContainer').dataset.loaded) {
        loadQuizQuestions();
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

    const selectedQuestions = shuffleArray([...quizData]).slice(0, 20);
    container.dataset.loaded = 'true';

    container.innerHTML = selectedQuestions.map((q, index) => `
        <div class="quiz-container">
            <div class="question" data-question-id="${q.id}">
                <h4>
                    <span class="question-number">Question ${index + 1}</span>
                    ${q.question}
                </h4>
                <div class="options-container">
                    ${q.options.map((option, optIndex) => `
                        <div class="option" onclick="selectQuizOption(${q.id}, ${optIndex})">
                            <input type="radio" name="quiz_${q.id}" value="${optIndex}" id="quiz_${q.id}_${optIndex}">
                            <label for="quiz_${q.id}_${optIndex}">${option}</label>
                        </div>
                    `).join('')}
                </div>
                <div class="explanation" id="explanation_${q.id}">
                    <strong>💡 Explication :</strong> ${q.explanation}
                </div>
            </div>
        </div>
    `).join('');
}

function selectQuizOption(questionId, optionIndex) {
    const options = document.querySelectorAll(`input[name="quiz_${questionId}"]`);
    options.forEach((opt, idx) => {
        opt.parentElement.classList.remove('selected');
        if (idx === optionIndex) {
            opt.checked = true;
            opt.parentElement.classList.add('selected');
        }
    });
}

function checkQuizAnswers() {
    let score = 0;
    let total = 0;

    document.querySelectorAll('#quizQuestionsContainer .question').forEach(questionDiv => {
        const questionId = parseInt(questionDiv.getAttribute('data-question-id'));
        const question = quizData.find(q => q.id === questionId);
        if (!question) return;

        total++;
        const selected = questionDiv.querySelector('input:checked');
        const options = questionDiv.querySelectorAll('.option');

        options.forEach(opt => {
            opt.classList.add('disabled');
            opt.querySelector('input').disabled = true;
        });

        if (selected) {
            const answer = parseInt(selected.value);
            if (answer === question.correct) {
                score++;
                options[answer].classList.add('correct');
            } else {
                options[answer].classList.add('incorrect');
                options[question.correct].classList.add('correct');
            }
        } else {
            options[question.correct].classList.add('correct');
        }

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

    examAnswers = {};
    document.getElementById('examTimer').style.display = 'block';
    document.getElementById('examContent').style.display = 'block';
    document.getElementById('examResults').style.display = 'none';
    document.getElementById('examStartBtnWrapper').style.display = 'none';

    renderExamQuestions();
    startExamTimer(90 * 60);
}

function renderExamQuestions() {
    const container = document.getElementById('examQuestions');
    const total = simulationData.length;

    document.getElementById('examProgress').innerHTML = `
        <div class="info-box">
            <strong>📋 ${total} question${total > 1 ? 's' : ''} au total</strong>
            <p>Répondez à toutes les questions puis cliquez sur "Terminer l'Examen".</p>
        </div>
    `;

    container.innerHTML = simulationData.map((q, index) => {
        const isMultiple = q.type === 'multiple' || Array.isArray(q.correct);
        const inputType = isMultiple ? 'checkbox' : 'radio';

        return `
            <div class="quiz-container">
                <div class="question" data-question-id="${q.id}">
                    <h4>
                        <span class="question-number">Question ${index + 1}/${total}</span>
                        ${q.question}
                        ${isMultiple ? '<br><small style="color:#c0392b;">⚠️ Sélectionnez ' + q.correct.length + ' réponses</small>' : ''}
                    </h4>
                    <div class="options-container">
                        ${q.options.map((option, optIndex) => `
                            <div class="option" onclick="selectExamOption(${q.id}, ${optIndex}, ${isMultiple})">
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

function selectExamOption(questionId, optionIndex, isMultiple) {
    if (!examAnswers[questionId]) examAnswers[questionId] = [];

    const input = document.getElementById(`exam_${questionId}_${optionIndex}`);
    const optionDiv = input.parentElement;

    if (isMultiple) {
        input.checked = !input.checked;
        optionDiv.classList.toggle('selected', input.checked);
        examAnswers[questionId] = examAnswers[questionId].includes(optionIndex)
            ? examAnswers[questionId].filter(i => i !== optionIndex)
            : [...examAnswers[questionId], optionIndex];
    } else {
        document.querySelectorAll(`input[name="exam_${questionId}"]`).forEach(opt => {
            opt.parentElement.classList.remove('selected');
        });
        input.checked = true;
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

function submitExam() {
    clearInterval(examTimer);
    document.getElementById('examTimer').style.display = 'none';

    let score = 0;
    const total = simulationData.length;
    const details = [];

    simulationData.forEach(q => {
        const userAnswer = (examAnswers[q.id] || []).slice().sort();
        const correctAnswer = Array.isArray(q.correct) ? [...q.correct].sort() : [q.correct];
        const isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
        if (isCorrect) score++;
        details.push({ q, userAnswer, correctAnswer, isCorrect });
    });

    const percentage = total > 0 ? ((score / total) * 100).toFixed(1) : '0.0';
    const passed = percentage >= 70;

    document.getElementById('examContent').style.display = 'none';

    const resultsEl = document.getElementById('examResults');
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
        <div class="score-card">
            <div class="emoji">${passed ? '🎉' : '📚'}</div>
            <h2>${score} / ${total}</h2>
            <p style="font-size: 2em; margin: 20px 0;">${percentage}%</p>
            <p style="font-size: 1.3em;">${passed ? '✅ Réussi ! (seuil : 70%)' : '❌ Non atteint (seuil : 70%)'}</p>
        </div>
        <div class="module-card" style="margin-top: 20px;">
            <h3>📝 Détail des réponses</h3>
            ${details.map((d, i) => `
                <div class="detail-box" style="border-left: 4px solid ${d.isCorrect ? '#27ae60' : '#c0392b'};">
                    <strong>Question ${i + 1} : ${d.isCorrect ? '✅ Correct' : '❌ Incorrect'}</strong>
                    <p>${d.q.question}</p>
                    <p><strong>💡 Explication :</strong> ${d.q.explanation}</p>
                </div>
            `).join('')}
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <button class="btn btn-primary" onclick="loadContent('simulation'); document.getElementById('examStartBtnWrapper').style.display='block';">🔄 Refaire la simulation</button>
        </div>
    `;
    resultsEl.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}
