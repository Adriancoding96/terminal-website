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
    { name: 'breakout', size: '2.1K', content: '01001110001101010100011001010011001100010010001110000000000000001111000' },
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
    const owner = 'adrian';
    files.forEach((file, index) => {
      const permissions = '.rw-r--r--';
      const sizeBytes = getFileSizeBytes(file);
      const sizeHuman = formatHumanSize(sizeBytes);
      const when = new Date(Date.now() - index * 60 * 60 * 1000);
      const whenStr = formatDateForLs(when);
      const icon = getFileIcon(file.name);

      const permsCol = permissions.padEnd(10, ' ');
      const sizeCol = sizeHuman.padStart(6, ' ');
      const ownerCol = owner.padEnd(7, ' ');
      const dateCol = whenStr.padEnd(12, ' ');
      const line = `${permsCol} ${sizeCol} ${ownerCol} ${dateCol} ${icon} ${file.name}`;
      printLine(escapeHtml(line));
    });
  }, 'List files');

  function getFileSizeBytes(file) {
    if (typeof file.content === 'string') return new TextEncoder().encode(file.content).length;
    return 0;
  }

  function formatHumanSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    const kb = bytes / 1024;
    if (kb < 10) return `${kb.toFixed(1)}k`;
    if (kb < 1024) return `${Math.round(kb)}k`;
    const mb = kb / 1024;
    if (mb < 10) return `${mb.toFixed(1)}m`;
    if (mb < 1024) return `${Math.round(mb)}m`;
    const gb = mb / 1024;
    return gb < 10 ? `${gb.toFixed(1)}g` : `${Math.round(gb)}g`;
  }

  function formatDateForLs(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const mon = months[date.getMonth()];
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${mon} ${hh}:${mm}`;
  }

  function getFileIcon(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return '';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif')) return '';
    if (lower.endsWith('.js')) return '';
    if (lower.endsWith('.css')) return '';
    if (lower.endsWith('.txt')) return '';
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return '';
    if (lower.endsWith('.json')) return '';
    return '';
  }

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

  // Simple Breakout game scaffold
  let breakoutState = null;

  registerCommand('./breakout', () => {
    if (breakoutState) {
      printLine('breakout already running (press Esc to exit)', 'warn');
      return;
    }
    startBreakout();
  }, 'Play Breakout');

  function startBreakout() {
    disableInput();
    const gameBlock = document.createElement('div');
    gameBlock.className = 'term-game';
    const screen = document.createElement('pre');
    screen.className = 'game-screen';
    screen.setAttribute('aria-label', 'Breakout game');
    screen.textContent = '';
    gameBlock.appendChild(screen);
    // Insert inside terminal just above the prompt line
    const promptLine = document.getElementById('prompt-line');
    outputEl.insertBefore(gameBlock, promptLine);

    const keyState = { left: false, right: false };

    let paused = false;
    let awaitingSave = false;
    let awaitingName = false;
    let nameBuffer = '';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); endBreakout(); return; }
      if (awaitingSave) {
        const k = e.key.toLowerCase();
        if (k === 'y') { e.preventDefault(); awaitingSave = false; awaitingName = true; nameBuffer = ''; return; }
        if (k === 'n') { e.preventDefault(); restartGame(); return; }
        return;
      }
      if (awaitingName) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const name = nameBuffer.trim() || 'anon';
          highScores.push({ name, score });
          highScores.sort((a, b) => b.score - a.score);
          highScores = highScores.slice(0, 50);
          saveHighScores();
          restartGame();
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          nameBuffer = nameBuffer.slice(0, -1);
          return;
        }
        if (e.key.length === 1 && /^[a-zA-Z0-9 _-]$/.test(e.key)) {
          e.preventDefault();
          if (nameBuffer.length < 16) nameBuffer += e.key;
        }
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); keyState.left = true; }
      if (e.key === 'ArrowRight') { e.preventDefault(); keyState.right = true; }
    };
    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft') { keyState.left = false; }
      if (e.key === 'ArrowRight') { keyState.right = false; }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // ASCII grid settings
    const cols = 96;
    const rows = 32;
    const leftWall = 0, rightWall = cols - 1, topWall = 0, bottomWall = rows - 1;

    // Paddle and ball in grid coordinates (float for smooth motion)
    const paddle = { w: 16, x: (cols - 16) / 2, y: rows - 3, speed: 28 }; // chars/sec
    const ball = { x: cols / 2, y: rows - 4, vx: 18, vy: -18 }; // chars/sec

    // Bricks and score
    let score = 0;
    const highScoreKey = 'breakout_high_scores_v1';
    let highScores = [];
    try {
      const raw = localStorage.getItem(highScoreKey);
      if (raw) highScores = JSON.parse(raw);
      if (!Array.isArray(highScores)) highScores = [];
    } catch { highScores = []; }
    function saveHighScores() {
      try { localStorage.setItem(highScoreKey, JSON.stringify(highScores.slice(0, 100))); } catch {}
    }
    const bricks = [];
    const interiorWidth = cols - 2;
    const brickW = 7;
    const brickRows = 4;
    const bricksPerRow = Math.floor(interiorWidth / brickW);
    const bricksStartX = 1 + Math.floor((interiorWidth - bricksPerRow * brickW) / 2);
    const bricksStartY = 2;

    function createBricks() {
      bricks.length = 0;
      for (let r = 0; r < brickRows; r++) {
        const y = bricksStartY + r;
        for (let c = 0; c < bricksPerRow; c++) {
          const x = bricksStartX + c * brickW;
          bricks.push({ x, y, w: brickW, alive: true });
        }
      }
    }

    function bricksRemaining() { return bricks.some(b => b.alive); }

    function drawBricks(buffer) {
      for (const b of bricks) {
        if (!b.alive) continue;
        const row = buffer[b.y];
        const brickStr = '#'.repeat(b.w);
        buffer[b.y] = row.slice(0, b.x) + brickStr + row.slice(b.x + b.w);
      }
    }

    function hitBrickAtCell(x, y) {
      for (const b of bricks) {
        if (!b.alive) continue;
        if (y === b.y && x >= b.x && x < b.x + b.w) {
          b.alive = false;
          score += 1;
          // Slightly increase speed to keep things lively
          const speedCap = 26;
          if (Math.abs(ball.vx) < speedCap) ball.vx *= 1.03;
          if (Math.abs(ball.vy) < speedCap) ball.vy *= 1.03;
          return true;
        }
      }
      return false;
    }

    function resetPositions() {
      paddle.x = (cols - paddle.w) / 2;
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - 1;
      ball.vx = 18; ball.vy = -18;
    }

    createBricks();
    resetPositions();

    let lastTs = performance.now();
    let accumulator = 0;
    const fixedDt = 1 / 60; // 60 FPS physics
    let raf = null;
    let lastFrame = '';
    let prevBallX = Math.floor(ball.x + 0.5);
    let prevBallY = Math.floor(ball.y + 0.5);

    function simulate(dt) {
      if (paused) return;
      // Move paddle
      if (keyState.left) paddle.x -= paddle.speed * dt;
      if (keyState.right) paddle.x += paddle.speed * dt;
      if (paddle.x < 1) paddle.x = 1; // inside walls
      if (paddle.x + paddle.w > cols - 1) paddle.x = cols - 1 - paddle.w;

      // Move ball
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Collide with walls (inside borders)
      if (ball.x <= 1) { ball.x = 1; ball.vx *= -1; }
      if (ball.x >= cols - 2) { ball.x = cols - 2; ball.vx *= -1; }
      if (ball.y <= 1) { ball.y = 1; ball.vy *= -1; }

      // Paddle collision
      const paddleTop = paddle.y;
      if (ball.y >= paddleTop - 1 && ball.y <= paddleTop && ball.vy > 0) {
        if (ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
          // Compute deflection based on where the ball hits the paddle
          const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1 (left) .. 1 (right)
          const speed = Math.min(26, Math.max(12, Math.hypot(ball.vx, ball.vy))); // keep a stable speed range
          const maxAngle = Math.PI / 3; // 60 degrees max
          const angle = hit * maxAngle;
          // Optional edge boost for stronger side influence
          const edgeBoost = 1 + Math.max(0, Math.abs(hit) - 0.6) * 0.5; // up to +20% at edges
          const newSpeed = Math.min(28, speed * edgeBoost);
          ball.vx = newSpeed * Math.sin(angle);
          ball.vy = -Math.abs(newSpeed * Math.cos(angle));
          ball.y = paddleTop - 1;
        }
      }

      // Brick collision
      const bx = Math.floor(ball.x + 0.5);
      const by = Math.floor(ball.y + 0.5);
      if (by >= bricksStartY && by < bricksStartY + brickRows) {
        if (hitBrickAtCell(bx, by)) {
          ball.vy *= -1;
          if (!bricksRemaining()) {
            createBricks();
          }
        }
      }

      // Lose condition: ball below field
      if (ball.y > rows - 2) {
        paused = true;
        awaitingSave = true;
      }
    }

    function render() {
      const buffer = new Array(rows);
      for (let r = 0; r < rows; r++) {
        if (r === topWall) {
          let top = '+' + '-'.repeat(cols - 2) + '+';
          const label = ` SCORE ${score} `;
          const start = 3;
          if (label.length < cols - 2 - start) {
            top = top.slice(0, start) + label + top.slice(start + label.length);
          }
          buffer[r] = top;
        } else if (r === bottomWall) {
          buffer[r] = '+' + '-'.repeat(cols - 2) + '+';
        } else {
          buffer[r] = '|' + ' '.repeat(cols - 2) + '|';
        }
      }

      // Draw bricks
      drawBricks(buffer);

      // Draw paddle with '=' characters
      const px = Math.floor(paddle.x + 0.5);
      const py = paddle.y;
      const paddleStr = '='.repeat(paddle.w);
      buffer[py] = buffer[py].slice(0, px) + paddleStr + buffer[py].slice(px + paddle.w);

      // Draw ball as 'o' and a faint trail '.' at previous position
      const bx = Math.floor(ball.x + 0.5);
      const by = Math.floor(ball.y + 0.5);
      if (by > 0 && by < rows - 1 && bx > 0 && bx < cols - 1) {
        buffer[by] = buffer[by].slice(0, bx) + 'o' + buffer[by].slice(bx + 1);
      }
      if (prevBallX !== bx || prevBallY !== by) {
        if (prevBallY > 0 && prevBallY < rows - 1 && prevBallX > 0 && prevBallX < cols - 1) {
          // Only draw trail if it doesn't overwrite walls or paddle row edges
          buffer[prevBallY] = buffer[prevBallY].slice(0, prevBallX) + '.' + buffer[prevBallY].slice(prevBallX + 1);
        }
        prevBallX = bx; prevBallY = by;
      }

      // Prompts
      if (awaitingSave) {
        const msg = ' GAME OVER - Save score? (y/n) ';
        const r = Math.floor(rows / 2);
        const start = Math.max(1, Math.floor((cols - msg.length) / 2));
        buffer[r] = buffer[r].slice(0, start) + msg + buffer[r].slice(start + msg.length);
      } else if (awaitingName) {
        const msg = ` Enter name: ${nameBuffer}_`;
        const r = Math.floor(rows / 2);
        const start = Math.max(1, Math.floor((cols - msg.length) / 2));
        buffer[r] = buffer[r].slice(0, start) + msg + buffer[r].slice(start + msg.length);
      }

      // Build right-side high score panel
      const scoreCols = 28;
      const panel = new Array(rows).fill(' '.repeat(scoreCols));
      function putPanelLine(rowIndex, text) {
        if (rowIndex < 0 || rowIndex >= rows) return;
        const t = (text || '').slice(0, scoreCols);
        panel[rowIndex] = t + ' '.repeat(Math.max(0, scoreCols - t.length));
      }
      putPanelLine(0, '');
      putPanelLine(1, ' HIGH SCORES');
      const top = [...highScores].sort((a,b) => b.score - a.score).slice(0, 10);
      for (let i = 0; i < 10; i++) {
        const entry = top[i];
        const rank = String(i + 1).padStart(2, ' ');
        if (entry) {
          const name = entry.name.length > 16 ? entry.name.slice(0, 16) : entry.name;
          const scoreStr = String(entry.score);
          const line = `${rank}. ${name.padEnd(16, ' ')} ${scoreStr.padStart(6, ' ')}`;
          putPanelLine(3 + i, line);
        } else {
          putPanelLine(3 + i, `${rank}.`);
        }
      }

      // Combine game buffer and panel
      const combined = buffer.map((row, idx) => row + '  ' + panel[idx]);
      const frame = combined.join('\n');
      if (frame !== lastFrame) {
        screen.textContent = frame;
        lastFrame = frame;
      }
    }

    function loop(ts) {
      let dt = (ts - lastTs) / 1000;
      if (dt > 0.25) dt = 0.25; // avoid big jumps on tab switch
      lastTs = ts;
      if (!paused) {
        accumulator += dt;
      } else {
        accumulator = 0;
      }
      while (accumulator >= fixedDt) {
        simulate(fixedDt);
        accumulator -= fixedDt;
      }
      render();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function restartGame() {
      score = 0;
      createBricks();
      resetPositions();
      paused = false;
      awaitingSave = false;
      awaitingName = false;
      nameBuffer = '';
    }

    breakoutState = { gameBlock, screen, onKeyDown, onKeyUp, raf };
  }

  function endBreakout() {
    if (!breakoutState) return;
    const { gameBlock, onKeyDown, onKeyUp, raf } = breakoutState;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    if (gameBlock && gameBlock.parentNode) gameBlock.parentNode.removeChild(gameBlock);
    breakoutState = null;
    enableInput();
    printLine('Exited breakout', 'dim');
  }

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


