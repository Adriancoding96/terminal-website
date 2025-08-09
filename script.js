/*
  adrian-shell: browser terminal that boots with a pacman-like install
  Commands supported: ls, cat
  Design: extensible command registry to add new commands easily
*/

(function () {
  const outputEl = document.getElementById('output');
  const inputEl = document.getElementById('input');
  const promptEl = document.getElementById('prompt');

  // Virtual filesystem model
  const files = [
    { name: 'about.txt', size: '694B', content: 'I am a software engineer working on server-side Rust and embedded Linux. I am available for freelance work; email for enquiries.' },
    { name: 'contact.yaml', size: '388B', content: 'name: Adrian\nemail: adrian.nilsson.coding@gmail.com' },
    { name: 'projects.json', size: '2.1K', content: '{\n  "featured": ["shell", "web", "linux"]\n}' },
  ];

  // Utility: print line(s)
  function printLine(html, cssClass) {
    const line = document.createElement('div');
    line.className = cssClass ? `line ${cssClass}` : 'line';
    line.innerHTML = html;
    // Insert before the prompt-line so prompt stays at bottom
    const promptLine = document.getElementById('prompt-line');
    outputEl.insertBefore(line, promptLine);
    outputEl.scrollTop = outputEl.scrollHeight;
    return line;
  }

  function printPromptWithCommand(cmd) {
    printLine(`${escapeHtml(promptEl.textContent)} <span class="cyan">${escapeHtml(cmd)}</span>`);
  }

  function escapeHtml(s) {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  // Command registry
  const commands = new Map();

  function registerCommand(name, handler, description) {
    commands.set(name, { handler, description });
  }

  function runCommand(rawInput) {
    const input = rawInput.trim();
    if (!input) return;

    const [name, ...args] = tokenize(input);
    const entry = commands.get(name);
    if (!entry) {
      printLine(`command not found: ${escapeHtml(name)}`, 'err');
      return;
    }
    try {
      return entry.handler(args);
    } catch (err) {
      printLine(`error: ${escapeHtml(String(err))}`, 'err');
    }
  }

  function tokenize(s) {
    // simple tokenizer supporting quoted strings
    const out = [];
    let cur = '';
    let quote = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quote) {
        if (ch === quote) { quote = null; continue; }
        if (ch === '\\' && i + 1 < s.length) { cur += s[++i]; continue; }
        cur += ch;
      } else {
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === ' ') { if (cur) { out.push(cur); cur = ''; } continue; }
        cur += ch;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  // Built-in commands
  registerCommand('ls', () => {
    for (const f of files) {
      printLine(`<span class="file"><span class="name">${escapeHtml(f.name)}</span>  <span class="size">${f.size}</span></span>`);
    }
  }, 'List files');

  registerCommand('cat', (args) => {
    if (args.length === 0) {
      printLine('usage: cat <file>', 'dim');
      return;
    }
    const wanted = args[0];
    const file = files.find(f => f.name === wanted);
    if (!file) {
      printLine(`cat: ${escapeHtml(wanted)}: No such file`, 'err');
      return;
    }
    printLine(escapeHtml(file.content));
  }, 'Print file contents');

  registerCommand('help', () => {
    printLine('Available commands:', 'dim');
    for (const [name, meta] of commands) {
      printLine(`<span class="cyan">${name}</span> - ${escapeHtml(meta.description || '')}`);
    }
  }, 'Show help');

  // Input handling
  let history = [];
  let historyIndex = -1;
  let acceptingInput = false;

  function enableInput() {
    acceptingInput = true;
    inputEl.classList.add('cursor');
    inputEl.setAttribute('contenteditable', 'true');
    inputEl.focus();
  }

  function disableInput() {
    acceptingInput = false;
    inputEl.classList.remove('cursor');
    inputEl.setAttribute('contenteditable', 'false');
  }

  function submitCurrentInput() {
    const cmd = inputEl.textContent;
    inputEl.textContent = '';
    printPromptWithCommand(cmd);
    history.push(cmd);
    historyIndex = history.length;
    runCommand(cmd);
  }

  inputEl.addEventListener('keydown', (e) => {
    if (!acceptingInput) { e.preventDefault(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCurrentInput();
      return;
    }
    if (e.key === 'c' && e.ctrlKey) {
      // Ctrl+C
      e.preventDefault();
      const current = inputEl.textContent;
      printLine(`^C`, 'warn');
      inputEl.textContent = '';
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) {
        historyIndex = Math.max(0, historyIndex - 1);
        inputEl.textContent = history[historyIndex] || '';
        placeCaretAtEnd(inputEl);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length) {
        historyIndex = Math.min(history.length, historyIndex + 1);
        inputEl.textContent = history[historyIndex] || '';
        placeCaretAtEnd(inputEl);
      }
      return;
    }
  });

  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Boot sequence: type and run `sudo pacman -S adrian-shell`
  async function boot() {
    disableInput();
    await typeAndEcho('sudo pacman -S adrian-shell', 45);
    await sleep(300);
    printLine('[sudo] password for adrian: ********', 'dim');
    await sleep(350);
    await pacmanInstallSimulation();
    // After install finishes, wait then simulate typing clear and wtfetch
    await sleep(2000);
    await typeAndEcho('clear', 45);
    runCommand('clear');
    await sleep(200);
    await typeAndEcho('wtfetch', 45);
    await runCommand('wtfetch');
    enableInput();
  }

  async function typeAndEcho(text, delayMs = 24) {
    inputEl.textContent = '';
    inputEl.classList.add('cursor');
    for (let i = 0; i < text.length; i++) {
      inputEl.textContent += text[i];
      await sleep(delayMs);
    }
    inputEl.classList.remove('cursor');
    printPromptWithCommand(text);
    inputEl.textContent = '';
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function pacmanInstallSimulation() {
    // A stylized, condensed pacman-like sequence
    printLine('resolving dependencies...', 'dim');
    await sleep(300);
    printLine('looking for conflicting packages...', 'dim');
    await sleep(250);
    printLine('', '');
    printLine('Packages (1)  adrian-shell-1.0.0', 'info');
    printLine('', '');
    printLine('Total Installed Size:  0.00 MiB', 'dim');
    printLine('Net Upgrade Size:      0.00 MiB', 'dim');
    await sleep(350);
    printLine('', '');
    printLine(':: Proceed with installation? [Y/n]', 'cyan');
    await sleep(400);
    printLine('checking keys in keyring...', 'dim');
    await sleep(180);
    printLine('checking package integrity...', 'dim');
    await sleep(160);
    printLine('loading package files...', 'dim');
    await sleep(160);
    printLine('checking for file conflicts...', 'dim');
    await sleep(160);
    printLine('checking available disk space...', 'dim');
    await sleep(160);
    printLine('downloading adrian-shell-1.0.0...', 'dim');
    await renderProgressLine(8.4, 23.5, 1800);
    printLine('adrian-shell installed', 'ok');
  }

  async function renderProgressLine(totalMiB, speedMiBps, durationMs) {
    const line = document.createElement('div');
    line.className = 'line progress';
    const promptLine = document.getElementById('prompt-line');
    outputEl.insertBefore(line, promptLine);

    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const percent = Math.round((i / steps) * 100);
      const downloaded = (totalMiB * percent) / 100;
      const remainingMiB = Math.max(0, totalMiB - downloaded);
      const remainingSec = speedMiBps > 0 ? remainingMiB / speedMiBps : 0;

      const barWidth = 69; // visually similar to pacman width
      const filled = Math.round((percent / 100) * barWidth);
      const bar = `[${'#'.repeat(filled)}${' '.repeat(Math.max(0, barWidth - filled))}]`;
      const text = `${formatMiB(downloaded)}  ${formatMiB(speedMiBps)}/s ${formatTime(remainingSec)} ${bar} ${String(percent).padStart(3)}%`;
      line.textContent = text;
      outputEl.scrollTop = outputEl.scrollHeight;
      await sleep(durationMs / steps);
    }
  }

  function formatMiB(value) {
    return `${value.toFixed(1)} MiB`;
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function clearOutput() {
    const promptLine = document.getElementById('prompt-line');
    const children = Array.from(outputEl.children);
    for (const node of children) {
      if (node !== promptLine) outputEl.removeChild(node);
    }
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  // wtfetch command with Tux ASCII and user info
  registerCommand('wtfetch', async () => {
    await renderWtfetch({
      name: 'Adrian Nilsson',
      email: 'adrian.nilsson.coding@gmail.com',
      favoriteLanguage: 'Rust',
      experience: '2 years',
      title: 'Associate Software Engineer',
      shell: 'adrian-shell',
      os: 'WebTerm Linux',
    });
  }, 'Show system information');

  async function renderWtfetch(info) {
    const tux = [
      "    .--.",
      "   |o_o |",
      "   |:_/ |",
      "  //   \\ \\",
      " (|     | )",
      "/'\\_   _/`\\",
      "\\___)=(___/",
    ];

    const lines = [
      `<span class="wt-key">Name</span>: <span class="wt-val">${escapeHtml(info.name)}</span>`,
      `<span class="wt-key">Title</span>: <span class="wt-val">${escapeHtml(info.title)}</span>`,
      `<span class="wt-key">Email</span>: <span class="wt-val">${escapeHtml(info.email)}</span>`,
      `<span class="wt-key">Favorite Language</span>: <span class="wt-val">${escapeHtml(info.favoriteLanguage)}</span>`,
      `<span class="wt-key">Experience</span>: <span class="wt-val">${escapeHtml(info.experience)}</span>`,
      `<span class="wt-key">OS</span>: <span class="wt-val">${escapeHtml(info.os)}</span>`,
      `<span class="wt-key">Shell</span>: <span class="wt-val">${escapeHtml(info.shell)}</span>`,
    ];

    const padWidth = tux.reduce((m, l) => Math.max(m, l.length), 0) + 2;
    const maxLen = Math.max(tux.length, lines.length);

    for (let i = 0; i < maxLen; i++) {
      const left = tux[i] || '';
      const right = lines[i] || '';
      const html = `<span class="wtfetch">${escapeHtml(left.padEnd(padWidth, ' '))}</span>${right}`;
      printLine(html);
      await sleep(24);
    }
  }

  // Clear command
  registerCommand('clear', () => {
    clearOutput();
  }, 'Clear the terminal screen');

  // Initialize
  window.addEventListener('load', () => {
    boot();
  });
})();


