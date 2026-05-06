// NAV LOGO ANIMATION

export function animateNavbarLogo(){
    const logo = document.querySelector('#logo');
    const turb = document.querySelector('#turbulence');
    const disp = document.querySelector('#displacement');

    // Add this to js/app.js or a dedicated effects file
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
