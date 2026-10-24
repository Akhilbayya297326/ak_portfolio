/* AKHIL — accessible, dependency-free portfolio interactions. */
(() => {
  'use strict';
  const init = () => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const navbar = document.getElementById('navbar');
    const progress = document.getElementById('scroll-progress');
    const toggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');
    const focus = (element) => { if (element && element.focus) element.focus({ preventScroll: true }); };
    const closeMenu = (restore = false) => {
      if (!toggle || !menu) return;
      const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
      menu.hidden = true;
      menu.classList.remove('is-open');
      if (restore && wasOpen) focus(toggle);
    };
    if (toggle && menu) {
      closeMenu();
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        menu.hidden = !open;
        menu.classList.toggle('is-open', open);
      });
      menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
      document.addEventListener('click', event => {
        if (!menu.contains(event.target) && !toggle.contains(event.target)) closeMenu();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu(true);
        if (event.key === 'Tab' && toggle.getAttribute('aria-expanded') === 'true') {
          const items = [toggle, ...menu.querySelectorAll('a[href], button:not([disabled])')];
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); focus(last);
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); focus(first);
          }
        }
      });
      window.matchMedia('(min-width: 761px)').addEventListener('change', event => {
        if (event.matches) closeMenu();
      });
    }
    const localTarget = (anchor) => {
      let url;
      try { url = new URL(anchor.href, location.href); } catch { return null; }
      if (url.origin !== location.origin || url.pathname !== location.pathname ||
          url.search !== location.search || !url.hash || url.hash === '#') return null;
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { return null; }
      const target = document.getElementById(id);
      return target ? { target, hash: url.hash } : null;
    };
    document.addEventListener('click', event => {
      const anchor = event.target.closest('a[href]');
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || anchor.hasAttribute('download') ||
          (anchor.target && anchor.target !== '_self')) return;
      const result = localTarget(anchor);
      if (!result) return;
      event.preventDefault();
      closeMenu();
      const { target, hash } = result;
      const offset = navbar ? navbar.getBoundingClientRect().height + 28 : 28;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      focus(target);
      try { if (location.hash !== hash) history.pushState(null, '', hash); } catch { /* File previews may restrict history. */ }
      window.scrollTo({ top, behavior: motion.matches ? 'instant' : 'smooth' });
    });
    const reveals = [...document.querySelectorAll('.reveal')];
    let observer;
    const showAll = () => {
      document.documentElement.classList.remove('js-motion');
      reveals.forEach(element => element.classList.add('is-visible'));
      if (observer) observer.disconnect();
    };
    if ('IntersectionObserver' in window && !motion.matches) {
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }), { threshold: 0.1 });
      document.documentElement.classList.add('js-motion');
      reveals.forEach(element => observer.observe(element));
    } else showAll();
    motion.addEventListener('change', event => { if (event.matches) showAll(); });
    const navItems = [...document.querySelectorAll('[data-nav]')]
      .map(link => ({ link, result: localTarget(link) })).filter(item => item.result);
    const sections = [...new Set(navItems.map(item => item.result.target))];
    let queued = false;
    const updateScroll = () => {
      queued = false;
      if (navbar) navbar.classList.toggle('is-scrolled', window.scrollY > 24);
      if (progress) {
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        const value = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
        progress.style.transform = `scaleX(${value})`;
        if (progress.getAttribute('role') === 'progressbar') {
          progress.setAttribute('aria-valuenow', String(Math.round(value * 100)));
        }
      }
      const line = Math.max(120, window.innerHeight * 0.3);
      let active = sections[0] || null;
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= line && rect.bottom > 0) active = section;
      });
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8) {
        active = sections[sections.length - 1] || active;
      }
      navItems.forEach(({ link, result }) => {
        const current = result.target === active;
        link.classList.toggle('is-active', current);
        if (current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const queueScroll = () => {
      if (!queued) { queued = true; window.requestAnimationFrame(updateScroll); }
    };
    window.addEventListener('scroll', queueScroll, { passive: true });
    window.addEventListener('resize', queueScroll, { passive: true });
    updateScroll();
    const filters = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('[data-category]')];
    const count = document.getElementById('project-count');
    const filterProjects = (value) => {
      let visible = 0;
      cards.forEach(card => {
        const show = value === 'all' || (card.dataset.category || '').split(/\s+/).includes(value);
        card.hidden = !show;
        if (show) visible++;
      });
      filters.forEach(button => {
        const selected = button.dataset.filter === value;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      if (count) count.textContent = `${visible} project${visible === 1 ? '' : 's'}`;
      queueScroll();
    };
    filters.forEach(button => button.addEventListener('click', () => filterProjects(button.dataset.filter)));
    if (filters.length && cards.length) filterProjects('all');
    // Descriptions and URLs from the supplied portfolio. No invented impact metrics.
    const projects = {
      krishi: {
        title: 'Krishi Chakra 2.0', subtitle: 'Intelligent tools for a more informed farming day.',
        type: 'Agriculture / Full-stack + GenAI',
        challenge: 'Bring agricultural information, resource planning and equipment access into one experience that helps farmers make practical decisions.',
        approach: ['A location-aware dashboard brings groundwater context and market trends together with revenue and profit planning.', 'Nearby pest mapping uses the Haversine distance algorithm with voice alerts, alongside irrigation planning tools.', 'Sahayog adds equipment discovery and booking with UPI QR support. Backend authentication controls access to subscription features.'],
        stack: ['MongoDB', 'Express.js', 'React', 'Node.js', 'Generative AI'],
        demo: 'https://krishichakra-frontend.vercel.app/', images: ['krishi-1.jpeg', 'krishi-2.jpeg', 'krishi-3.jpeg']
      },
      mediflow: {
        title: 'MediFlow AI', subtitle: 'A connected hospital experience, from discovery to administration.',
        type: 'Healthcare / Java Spring Boot',
        challenge: 'Connect public access to specialists and hospital resource information with the separate, secure workflows doctors and administrators need.',
        approach: ['Symptom-based routing helps patients find relevant specialists without navigating medical terminology.', 'Database-backed bed and patient status tracking connects public resource information to clinical updates.', 'Role-based access separates administrator and doctor dashboards, with Spring Security filtering protected endpoints.'],
        stack: ['Java', 'Spring Boot', 'Spring Security', 'MVC', 'Role-based access'],
        images: ['mediflow-3.jpeg', 'mediflow-4.jpeg', 'mediflow-5.jpeg', 'mediflow-2.jpeg']
      },
      apex: {
        title: 'ApexResume', subtitle: 'Turn resume feedback into a clearer next step.', type: 'Career tools / MERN + NLP',
        challenge: 'Help job seekers understand resume structure and skill alignment, then turn generic ATS feedback into specific improvements.',
        approach: ['A Gemini and NLP pipeline analyzes resume content and provides ATS-oriented feedback.', 'Role-specific suggestions and skill roadmaps give candidates practical direction for improving their applications.', 'A leaderboard introduces a continuing feedback loop for job seekers working on their profiles.'],
        stack: ['React', 'Node.js', 'MongoDB', 'Gemini API', 'NLP'], demo: 'https://apexresume.netlify.app/'
      },
      auro: {
        title: 'Insight Companion — Auro', subtitle: 'Making visual information accessible through voice.', type: 'Accessibility / Multimodal AI',
        challenge: 'Make camera-based information easier to access for people with visual impairments through a hands-free, audio-led interface.',
        approach: ['Gemini vision analyzes camera input and translates surrounding visual context into descriptive audio.', 'Spoken commands drive system actions, reducing dependence on visual controls.', 'The Node.js backend coordinates image analysis and voice synthesis, with sign reading and hazard description as assistive capabilities.'],
        stack: ['React', 'Node.js', 'Gemini Vision API', 'Voice synthesis']
      },
      carebridge: {
        title: 'CareBridge', subtitle: 'Keeping rural surgical aftercare connected.', type: 'Healthcare / MERN + Multimodal AI',
        challenge: 'Keep rural patients connected to their care team after discharge, using familiar tools to share recovery updates without a new app.',
        approach: ['Patients can send text updates and wound photos through WhatsApp.', 'Gemini analyzes multimodal updates to organize symptoms and help prioritize recovery status for review.', 'A clinician dashboard presents patient priorities and chronological recovery timelines to support follow-up.'],
        stack: ['React', 'Node.js', 'WhatsApp API', 'Google Gemini AI', 'Cloud dashboard'], demo: 'https://care-bridge-zeta-jet.vercel.app/'
      }
    };
    const node = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text) element.textContent = text;
      return element;
    };
    const prepareDialog = (dialog) => {
      if (!dialog || typeof dialog.showModal !== 'function') return null;
      let trigger = null;
      let backdropDown = false;
      dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()));
      const outside = event => {
        const rect = dialog.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      };
      dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog && outside(event); });
      dialog.addEventListener('click', event => {
        if (backdropDown && event.target === dialog && outside(event)) dialog.close();
        backdropDown = false;
      });
      dialog.addEventListener('close', () => {
        if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('dialog-open');
        if (trigger && trigger.isConnected) focus(trigger);
        trigger = null;
      });
      return opener => {
        trigger = opener || document.activeElement;
        if (!dialog.open) dialog.showModal();
        document.documentElement.classList.add('dialog-open');
      };
    };
    const projectDialog = document.getElementById('project-dialog');
    const content = document.getElementById('dialog-content');
    const openProject = prepareDialog(projectDialog);
    const renderProject = project => {
      const fragment = document.createDocumentFragment();
      fragment.append(node('p', 'dialog-kicker', project.type));
      const title = node('h2', 'dialog-title', project.title);
      title.id = 'project-dialog-title';
      fragment.append(title, node('p', 'dialog-summary', project.subtitle));
      const tags = node('div', 'dialog-tags');
      project.stack.forEach(item => tags.append(node('span', 'tag', item)));
      fragment.append(tags);
      const grid = node('div', 'dialog-grid');
      const challenge = node('section', 'dialog-section');
      challenge.append(node('h3', '', 'The challenge'), node('p', '', project.challenge));
      const approach = node('section', 'dialog-section');
      const list = node('ul');
      project.approach.forEach(item => list.append(node('li', '', item)));
      approach.append(node('h3', '', 'The approach'), list);
      grid.append(challenge, approach);
      fragment.append(grid);
      if (project.demo) {
        const links = node('div', 'dialog-links');
        const demo = node('a', 'button button-primary', 'Explore live demo ↗');
        demo.href = project.demo;
        demo.target = '_blank';
        demo.rel = 'noopener noreferrer';
        demo.setAttribute('aria-label', `Explore ${project.title} live demo (opens in a new tab)`);
        links.append(demo);
        fragment.append(links);
      }
      if (project.images) {
        const gallery = node('section', 'dialog-gallery');
        gallery.append(node('h3', '', 'A closer look'));
        project.images.forEach((filename, index) => {
          const figure = node('figure');
          const link = node('a', 'dialog-gallery-link');
          link.href = `images/${filename}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', `Open ${project.title} screenshot ${index + 1} at full size (opens in a new tab)`);
          const image = node('img');
          image.src = `images/${filename}`;
          image.alt = `${project.title} interface — screenshot ${index + 1}`;
          image.loading = 'lazy';
          link.append(image);
          figure.append(link, node('figcaption', '', `Interface ${String(index + 1).padStart(2, '0')} / Open full image ↗`));
          gallery.append(figure);
        });
        fragment.append(gallery);
      }
      content.replaceChildren(fragment);
    };
    if (openProject && content) document.querySelectorAll('[data-project]').forEach(button => {
      button.addEventListener('click', () => {
        const project = projects[button.dataset.project];
        if (!project) return;
        renderProject(project);
        openProject(button);
        projectDialog.scrollTop = 0;
        const heading = projectDialog.querySelector('.dialog-title');
        if (heading) { heading.tabIndex = -1; focus(heading); }
      });
    });
    const imageDialog = document.getElementById('image-dialog');
    const lightboxImage = document.getElementById('lightbox-image');
    const caption = document.getElementById('lightbox-caption');
    const openImage = prepareDialog(imageDialog);
    if (openImage && lightboxImage) document.querySelectorAll('[data-lightbox]').forEach(button => {
      button.addEventListener('click', event => {
        const image = button.querySelector('img');
        const source = button.dataset.lightbox || (image && (image.currentSrc || image.src)) || button.href;
        if (!source) return;
        event.preventDefault();
        lightboxImage.src = source;
        lightboxImage.alt = button.dataset.caption || (image && image.alt) || 'Portfolio image';
        if (caption) caption.textContent = lightboxImage.alt;
        openImage(button);
      });
    });
    const copy = document.getElementById('copy-email');
    const status = document.getElementById('copy-status');
    let copyTimeout;
    if (copy) copy.addEventListener('click', async () => {
      const email = 'akhilbayya111@gmail.com';
      window.clearTimeout(copyTimeout);
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(email);
        if (status) status.textContent = 'Email copied. Let’s make something meaningful.';
      } catch {
        const link = document.querySelector(`.email-link[href="mailto:${email}"]`) || document.querySelector(`a[href="mailto:${email}"]`);
        if (link) {
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(link);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          focus(link);
        }
        if (status) status.textContent = `Copy manually: ${email}`;
      }
      copyTimeout = window.setTimeout(() => { if (status) status.textContent = ''; }, 8000);
    });
    document.querySelectorAll('[data-year]').forEach(element => { element.textContent = String(new Date().getFullYear()); });
    const clocks = document.querySelectorAll('[data-local-time]');
    if (clocks.length) {
      const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
      const updateTime = () => clocks.forEach(element => { element.textContent = `${formatter.format(new Date())} IST`; });
      updateTime();
      window.setInterval(() => { if (!document.hidden) updateTime(); }, 30000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) updateTime(); });
    }
    const portrait = document.querySelector('.portrait-scene');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (portrait) {
      let portraitFrame = 0;
      let pointerX = 0;
      let pointerY = 0;
      const resetPortrait = () => {
        window.cancelAnimationFrame(portraitFrame);
        portraitFrame = 0;
        portrait.style.setProperty('--pointer-x', '0');
        portrait.style.setProperty('--pointer-y', '0');
      };
      portrait.addEventListener('pointermove', event => {
        if (motion.matches || !pointer.matches) return;
        const rect = portrait.getBoundingClientRect();
        pointerX = (event.clientX - rect.left) / rect.width * 2 - 1;
        pointerY = (event.clientY - rect.top) / rect.height * 2 - 1;
        if (!portraitFrame) portraitFrame = window.requestAnimationFrame(() => {
          portraitFrame = 0;
          portrait.style.setProperty('--pointer-x', pointerX.toFixed(3));
          portrait.style.setProperty('--pointer-y', pointerY.toFixed(3));
        });
      });
      portrait.addEventListener('pointerleave', resetPortrait);
      motion.addEventListener('change', event => { if (event.matches) resetPortrait(); });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
