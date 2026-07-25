// ANIMACAO DISPLACEMENT TEMPORARIA, APENAS TESTANDO
// TER OS "EFEITOS" EM UM ARQUIVO SEPARADO
export function animateNavbarLogo(){
    const logo = document.querySelector('#logo');
    const turb = document.querySelector('#turbulence');
    const disp = document.querySelector('#displacement');

    document.addEventListener('mousemove', (e) => {
        const logo = e.target.closest('.logo');
        if (!logo) return;

        const turb = document.querySelector('#turbulence');
        const disp = document.querySelector('#displacement');
        if (!turb || !disp) return;

        // Randomize for a high-energy glitch
        turb.setAttribute('baseFrequency', `${Math.random() * 0.1} ${Math.random() * 0.02}`);
        disp.setAttribute('scale', Math.random() * 15);
    });

    document.addEventListener('mouseout', (e) => {
        const logo = e.target.closest('.logo');
        if (!logo) return;

        const turb = document.querySelector('#turbulence');
        const disp = document.querySelector('#displacement');
        if (turb && disp) {
            turb.setAttribute('baseFrequency', '0');
            disp.setAttribute('scale', '0');
        }
    });
}

// GLITCH DE TEXTO NOS TITULOS DOS PROJECT CARDS
// Enquanto o mouse estiver sobre o card, as letras do titulo
// trocam aleatoriamente por caracteres aleatorios. Ao sair, volta ao normal.
const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#$%&@ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function scramble(originalText) {
    return originalText
        .split('')
        .map(ch => {
            if (ch === ' ') return ' ';
            // ~25% chance de cada letra "piscar" para um caractere aleatorio a cada frame
            if (Math.random() < 0.1) {
                return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            }
            return ch;
        })
        .join('');
}

export function initProjectCardGlitch() {
    // WeakMap guarda o interval ativo de cada <h3>, indexado pelo proprio elemento
    const activeGlitches = new WeakMap();

    function startGlitch(h3) {
        if (activeGlitches.has(h3)) return;

        const originalText = h3.dataset.originalText || h3.textContent;
        h3.dataset.originalText = originalText;
        h3.classList.add('is-glitching');

        const intervalId = setInterval(() => {
            // Se o card sumiu do DOM (troca de rota), limpa o interval sozinho
            if (!document.body.contains(h3)) {
                clearInterval(intervalId);
                activeGlitches.delete(h3);
                return;
            }
            h3.textContent = scramble(originalText);
        }, 60);

        activeGlitches.set(h3, intervalId);
    }

    function stopGlitch(h3) {
        const intervalId = activeGlitches.get(h3);
        if (intervalId) clearInterval(intervalId);
        activeGlitches.delete(h3);
        h3.classList.remove('is-glitching');
        h3.textContent = h3.dataset.originalText || h3.textContent;
    }

    // Delegacao de eventos no document: funciona mesmo com os cards
    // sendo recriados dinamicamente pelo renderer/router.
    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.project-card');
        if (!card) return;
        if (e.relatedTarget && card.contains(e.relatedTarget)) return; // ja estava dentro do card

        const h3 = card.querySelector('.project-info h3');
        if (h3) startGlitch(h3);
    });

    document.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.project-card');
        if (!card) return;
        if (e.relatedTarget && card.contains(e.relatedTarget)) return; // ainda dentro do card

        const h3 = card.querySelector('.project-info h3');
        if (h3) stopGlitch(h3);
    });
}
