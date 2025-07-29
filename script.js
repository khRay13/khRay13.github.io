document.addEventListener('DOMContentLoaded', () => {
  const appIcons = document.querySelectorAll('.app-icon');

  appIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      const href = icon.getAttribute('href');
      icon.style.transform = 'scale(0.95)';
      setTimeout(() => {
        window.location.href = href;
      }, 300);
    });

    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        icon.click();
      }
    });
  });
});