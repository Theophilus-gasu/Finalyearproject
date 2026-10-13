const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-navigation');
const schoolEmail = 'apedotheo345@gmail.com';

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
  navigation.classList.toggle('is-open', !isOpen);
});

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    navigation.classList.remove('is-open');
  }
});

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Date().getFullYear();
});

const visitForm = document.querySelector('#visit-form');

if (visitForm) {
  visitForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(visitForm);
    const name = formData.get('name').trim();
    const email = formData.get('email').trim();
    const note = formData.get('note').trim();
    const body = [
      'Hello Petite Fleur Montessori School,',
      '',
      `My name is ${name} (${email}). I would love to learn more about visiting the school.`,
      note ? `\nA little more about my enquiry: ${note}` : '',
    ].filter(Boolean).join('\n');

    document.querySelector('#form-note').textContent = schoolEmail
      ? 'Your email draft is ready in your email app.'
      : 'Your email draft is ready. Add the school email in the To field before sending.';
    window.location.href = `mailto:${schoolEmail}?subject=${encodeURIComponent('A visit to Petite Fleur Montessori School')}&body=${encodeURIComponent(body)}`;
  });
}