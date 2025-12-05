import puppeteer, { Browser, Page } from "puppeteer-core";
import { EventEmitter } from "events";
import type { AutomationConfig, AutomationState, ProgressData, LogEntry } from "@shared/schema";

export interface AutomationEvents {
  stateChange: (state: AutomationState, data?: { bookTitle?: string; userRa?: string }) => void;
  progress: (progress: ProgressData) => void;
  log: (type: LogEntry["type"], message: string) => void;
  error: (message: string) => void;
  completed: (data: { bookQueueId?: string; pagesRead: number; totalPages: number; timeSpent: number }) => void;
}

export class AutomationService extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: AutomationConfig | null = null;
  private isPaused: boolean = false;
  private shouldStop: boolean = false;
  private currentPage: number = 0;
  private totalPages: number | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private lastPauseStart: number = 0;
  private bookQueueId: string | null = null;

  constructor() {
    super();
  }

  getCurrentBookQueueId(): string | null {
    return this.bookQueueId;
  }

  private emitState(state: AutomationState, data?: { bookTitle?: string; userRa?: string }) {
    this.emit("stateChange", state, data);
  }

  private emitProgress() {
    const elapsedTime = this.getElapsedTime();
    const percentage = this.totalPages 
      ? (this.currentPage / this.totalPages) * 100 
      : 0;
    
    let estimatedTimeRemaining: number | null = null;
    if (this.totalPages && this.currentPage > 0 && percentage > 0) {
      const timePerPage = elapsedTime / this.currentPage;
      const remainingPages = this.totalPages - this.currentPage;
      estimatedTimeRemaining = timePerPage * remainingPages;
    }

    const progress: ProgressData = {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      percentage,
      elapsedTime,
      estimatedTimeRemaining,
    };

    this.emit("progress", progress);
  }

  private emitLog(type: LogEntry["type"], message: string) {
    this.emit("log", type, message);
  }

  private emitError(message: string) {
    this.emit("error", message);
  }

  private emitCompleted() {
    this.emit("completed", {
      bookQueueId: this.bookQueueId || undefined,
      pagesRead: this.currentPage,
      totalPages: this.totalPages || this.currentPage,
      timeSpent: this.getElapsedTime()
    });
  }

  private getElapsedTime(): number {
    if (!this.startTime) return 0;
    const now = Date.now();
    return (now - this.startTime - this.pausedTime) / 1000;
  }

  async start(config: AutomationConfig): Promise<void> {
    this.config = config;
    this.isPaused = false;
    this.shouldStop = false;
    this.currentPage = 0;
    this.totalPages = null;
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.bookQueueId = config.bookQueueId || null;

    try {
      this.emitState("connecting");
      this.emitLog("info", "Iniciando navegador...");

      const chromiumPaths = [
        process.env.CHROME_PATH,
        "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
      ].filter(Boolean) as string[];

      let executablePath = chromiumPaths[0];
      for (const path of chromiumPaths) {
        try {
          const { execSync } = await import("child_process");
          execSync(`test -f "${path}"`, { stdio: "ignore" });
          executablePath = path;
          break;
        } catch {
          continue;
        }
      }

      this.browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });

      this.emitLog("success", "Navegador iniciado com sucesso");
      
      await this.login();
      
      if (this.shouldStop) {
        await this.cleanup();
        return;
      }

      await this.openBook();
      
      if (this.shouldStop) {
        await this.cleanup();
        return;
      }

      await this.readPages();

    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      this.emitError(message);
      this.emitLog("error", `Erro: ${message}`);
    } finally {
      await this.cleanup();
    }
  }

  private parseRA(raFull: string): { ra: string; digito: string; uf: string } {
    const raClean = raFull.trim().toLowerCase();
    
    const ufMatch = raClean.match(/([a-z]{2})$/);
    const uf = ufMatch ? ufMatch[1].toUpperCase() : "SP";
    
    const numbersOnly = raClean.replace(/[a-z]/g, "");
    
    const ra = numbersOnly.slice(0, -1);
    const digito = numbersOnly.slice(-1);
    
    return { ra, digito, uf };
  }

  private async login(): Promise<void> {
    if (!this.page || !this.config) return;

    this.emitState("logging_in");
    this.emitLog("info", "Acessando página de login de alunos...");

    try {
      await this.page.goto("https://saladofuturo.educacao.sp.gov.br/login-alunos", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await this.sleep(2000);
      this.emitLog("info", "Página de login carregada");

      const { ra, digito, uf } = this.parseRA(this.config.ra);
      this.emitLog("info", `RA: ${ra}, Dígito: ${digito}, UF: ${uf}`);

      this.emitLog("info", "Preenchendo campo RA...");

      const raSelectors = [
        "input[placeholder*='186735683']",
        "input[name*='ra']",
        "input[id*='ra']",
        "input[placeholder*='RA']"
      ];

      let raInput = null;
      
      const allInputs = await this.page.$$("input[type='text'], input[type='number'], input:not([type='password']):not([type='hidden']):not([type='submit'])");
      
      this.emitLog("info", `Encontrados ${allInputs.length} campos de input`);
      
      for (const input of allInputs) {
        const placeholder = await input.evaluate(el => el.getAttribute("placeholder") || "");
        const name = await input.evaluate(el => el.getAttribute("name") || "");
        const id = await input.evaluate(el => el.getAttribute("id") || "");
        const isVisible = await input.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null;
        });
        
        this.emitLog("info", `Input: placeholder="${placeholder}", name="${name}", id="${id}", visible=${isVisible}`);
        
        if (!isVisible) continue;
        
        if (placeholder.includes("186735683") || placeholder.includes("Ex.:") || 
            placeholder.toLowerCase().includes("ex:") ||
            (name.toLowerCase().includes("ra") && !name.toLowerCase().includes("digito")) || 
            (id.toLowerCase().includes("ra") && !id.toLowerCase().includes("digito"))) {
          raInput = input;
          this.emitLog("info", `Campo RA encontrado: placeholder="${placeholder}"`);
          break;
        }
      }

      if (!raInput) {
        for (const input of allInputs) {
          const isVisible = await input.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null;
          });
          if (isVisible) {
            raInput = input;
            this.emitLog("info", "Usando primeiro campo visível como RA");
            break;
          }
        }
      }

      if (!raInput) {
        throw new Error("Campo de RA não encontrado");
      }

      await raInput.click();
      await this.sleep(200);
      await raInput.type(ra, { delay: 30 });

      this.emitLog("info", "Preenchendo campo Dígito RA...");

      let digitoInput = null;
      const digitoInputs = await this.page.$$("input[type='text'], input[type='number'], input:not([type])");
      
      for (const input of digitoInputs) {
        const placeholder = await input.evaluate(el => el.getAttribute("placeholder") || "");
        const name = await input.evaluate(el => el.getAttribute("name") || "");
        const id = await input.evaluate(el => el.getAttribute("id") || "");
        const value = await input.evaluate(el => (el as HTMLInputElement).value || "");
        
        if ((placeholder === "0" || placeholder.toLowerCase().includes("dígito") || placeholder.toLowerCase().includes("digito") ||
            name.toLowerCase().includes("digito") || id.toLowerCase().includes("digito")) && value === "") {
          digitoInput = input;
          this.emitLog("info", "Campo Dígito encontrado");
          break;
        }
      }

      if (!digitoInput) {
        for (let i = 0; i < digitoInputs.length; i++) {
          const value = await digitoInputs[i].evaluate(el => (el as HTMLInputElement).value || "");
          if (value === "" && digitoInputs[i] !== raInput) {
            digitoInput = digitoInputs[i];
            this.emitLog("info", "Usando segundo campo vazio como Dígito");
            break;
          }
        }
      }

      if (digitoInput) {
        await digitoInput.click();
        await this.sleep(200);
        await digitoInput.type(digito, { delay: 30 });
      }

      this.emitLog("info", `Selecionando UF: ${uf}...`);

      const ufSelectors = [
        "select[name*='uf']",
        "select[id*='uf']",
        "select[name*='estado']",
        "select"
      ];

      let ufSelect = null;
      
      for (const selector of ufSelectors) {
        try {
          ufSelect = await this.page.$(selector);
          if (ufSelect) break;
        } catch {
          continue;
        }
      }

      if (ufSelect) {
        await this.page.select(ufSelect as any, uf);
        this.emitLog("info", `UF ${uf} selecionado`);
      } else {
        const ufDropdown = await this.page.$("[class*='select'], [class*='dropdown']");
        if (ufDropdown) {
          await ufDropdown.click();
          await this.sleep(500);
          
          const options = await this.page.$$("li, option, [role='option']");
          for (const option of options) {
            const text = await option.evaluate(el => el.textContent?.trim().toUpperCase() || "");
            if (text === uf) {
              await option.click();
              this.emitLog("info", `UF ${uf} selecionado via dropdown`);
              break;
            }
          }
        }
      }

      await this.sleep(500);

      this.emitLog("info", "Preenchendo senha...");

      const passwordInput = await this.page.$("input[type='password']");

      if (!passwordInput) {
        throw new Error("Campo de senha não encontrado");
      }

      await passwordInput.click();
      await this.sleep(200);
      await passwordInput.type(this.config.password, { delay: 30 });

      this.emitLog("info", "Clicando em 'Acessar'...");

      let acessarBtn = null;
      const allButtons = await this.page.$$("button, input[type='submit'], a");
      
      for (const btn of allButtons) {
        const text = await btn.evaluate(el => el.textContent?.toLowerCase() || "");
        if (text.includes("acessar") || text.includes("entrar") || text.includes("login")) {
          acessarBtn = btn;
          break;
        }
      }

      if (!acessarBtn) {
        acessarBtn = await this.page.$("button[type='submit']");
      }

      if (acessarBtn) {
        await acessarBtn.click();
      } else {
        await this.page.keyboard.press("Enter");
      }

      await this.sleep(3000);
      
      try {
        await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
        this.emitLog("info", "Navegação detectada após login");
      } catch {
        this.emitLog("info", "Timeout na navegação, verificando página atual...");
      }

      await this.sleep(2000);

      const currentUrl = this.page.url();
      this.emitLog("info", `URL atual: ${currentUrl}`);

      const stillOnLoginPage = currentUrl.includes("login-alunos") || currentUrl.includes("login");
      
      if (stillOnLoginPage) {
        const errorMessages = await this.page.$$eval(
          ".error, .alert-danger, .message-error, [class*='error'], [class*='alert'], [class*='invalid']",
          elements => elements.map(el => el.textContent?.trim() || "")
        );
        
        const hasError = errorMessages.some(msg => 
          msg.toLowerCase().includes("inválid") || 
          msg.toLowerCase().includes("incorret") ||
          msg.toLowerCase().includes("erro") ||
          msg.toLowerCase().includes("senha") && msg.toLowerCase().includes("verifi")
        );

        if (hasError) {
          this.emitLog("error", `Mensagens de erro: ${errorMessages.join(", ")}`);
          throw new Error("Falha no login. Verifique seu RA, dígito e senha.");
        }
        
        const pageText = await this.page.evaluate(() => document.body.innerText);
        if (pageText.includes("RA ou senha inválidos") || 
            pageText.includes("dados inválidos") ||
            pageText.includes("Usuário não encontrado")) {
          throw new Error("Falha no login. Verifique seu RA, dígito e senha.");
        }
      }

      this.emitLog("success", "Login na Sala do Futuro realizado com sucesso!");
      
      await this.accessLeiasp();

      this.emitState("logging_in", { userRa: this.config.ra });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no login";
      throw new Error(`Falha no login: ${message}`);
    }
  }

  private async accessLeiasp(): Promise<void> {
    if (!this.page) return;

    this.emitLog("info", "Procurando LeiasSP na página...");

    await this.sleep(2000);

    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await this.sleep(1000);

    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.sleep(2000);

    const leiaspSelectors = [
      "a[href*='leiasp']",
      "a[href*='LeiaSP']",
      "a[href*='arvore']",
      "a[href*='leia']",
      "[data-testid*='leiasp']",
      "[data-testid*='leia']",
      "button:has-text('LeiasSP')",
      "a:has-text('LeiasSP')",
      "div:has-text('LeiasSP')"
    ];

    let leiaspElement = null;

    for (const selector of leiaspSelectors) {
      try {
        leiaspElement = await this.page.$(selector);
        if (leiaspElement) {
          this.emitLog("info", `LeiasSP encontrado: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!leiaspElement) {
      const allLinks = await this.page.$$("a");
      for (const link of allLinks) {
        const text = await link.evaluate(el => el.textContent?.toLowerCase() || "");
        const href = await link.evaluate(el => el.getAttribute("href")?.toLowerCase() || "");
        if (text.includes("leia") || text.includes("arvore") || href.includes("leia") || href.includes("arvore")) {
          leiaspElement = link;
          this.emitLog("info", `LeiasSP encontrado por texto: ${text}`);
          break;
        }
      }
    }

    if (!leiaspElement) {
      const allElements = await this.page.$$("*");
      for (const el of allElements) {
        const text = await el.evaluate(e => e.textContent?.toLowerCase() || "");
        if (text.includes("leiasp") || text.includes("leia sp")) {
          const clickable = await el.evaluate(e => {
            return e.tagName === "A" || e.tagName === "BUTTON" || 
                   (e as HTMLElement).onclick !== null || 
                   window.getComputedStyle(e).cursor === "pointer";
          });
          if (clickable) {
            leiaspElement = el;
            this.emitLog("info", "LeiasSP encontrado por busca de texto");
            break;
          }
        }
      }
    }

    if (!leiaspElement) {
      this.emitLog("warning", "LeiasSP não encontrado automaticamente. Tentando via URL direta...");
      
      await this.page.goto("https://leiasp.educacao.sp.gov.br/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      }).catch(() => {});
      
      await this.sleep(3000);
      return;
    }

    this.emitLog("info", "Clicando em LeiasSP...");

    let newPage: Page | null = null;
    
    if (this.browser) {
      const pagePromise = new Promise<Page | null>(resolve => {
        this.browser?.once("targetcreated", async target => {
          const page = await target.page();
          resolve(page as Page);
        });
        setTimeout(() => resolve(null), 5000);
      });
      
      await leiaspElement.click();
      newPage = await pagePromise;
    } else {
      await leiaspElement.click();
    }

    if (newPage) {
      this.page = newPage;
      await this.page.setViewport({ width: 1920, height: 1080 });
    }

    await this.sleep(3000);
    if (this.page) {
      await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
    }
    
    this.emitLog("success", "Acessou LeiasSP com sucesso!");
  }

  private async openBook(): Promise<void> {
    if (!this.page || !this.config) return;

    this.emitState("loading_book");
    this.emitLog("info", `Abrindo livro: ${this.config.bookSlug}...`);

    try {
      await this.page.goto(`https://e-reader.arvore.com.br/?slug=${this.config.bookSlug}`, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      await this.sleep(3000);

      try {
        await this.page.waitForSelector("[data-testid='reader-container']", { timeout: 15000 });
      } catch {
        const pageContent = await this.page.content();
        if (pageContent.includes("não encontrado") || pageContent.includes("not found")) {
          throw new Error("Livro não encontrado. Verifique o slug.");
        }
      }

      const bookTitle = await this.getBookTitle();
      
      this.emitLog("success", `Livro carregado: ${bookTitle || this.config.bookSlug}`);
      this.emitState("loading_book", { bookTitle: bookTitle || undefined });

      this.totalPages = await this.getTotalPages();
      if (this.totalPages) {
        this.emitLog("info", `Total de páginas detectado: ${this.totalPages}`);
      } else {
        this.emitLog("warning", "Não foi possível detectar o total de páginas");
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao abrir livro";
      throw new Error(`Falha ao abrir livro: ${message}`);
    }
  }

  private async getBookTitle(): Promise<string | null> {
    if (!this.page) return null;

    const selectors = [
      "[data-testid='book-title']",
      ".book-title",
      "h1",
      ".reader-title",
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.evaluate(el => el.textContent?.trim());
          if (text && text.length > 0 && text.length < 200) {
            return text;
          }
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async getTotalPages(): Promise<number | null> {
    if (!this.page) return null;

    const selectors = [
      "[data-testid='total-pages']",
      "[data-testid='pages-total']",
      ".total-pages",
      ".reader-total-pages",
      ".pagination .total",
      ".page-count .total",
      "#total-pages",
      ".total",
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.evaluate(el => el.textContent?.trim());
          if (text) {
            const digits = text.replace(/\D/g, "");
            if (digits) {
              return parseInt(digits, 10);
            }
          }
        }
      } catch {
        continue;
      }
    }

    try {
      const elements = await this.page.$$("*");
      for (const element of elements) {
        const text = await element.evaluate(el => el.textContent?.trim());
        if (text && text.includes("/")) {
          const parts = text.split("/");
          if (parts.length >= 2) {
            const right = parts[parts.length - 1].replace(/\D/g, "");
            if (right && parseInt(right, 10) > 0) {
              return parseInt(right, 10);
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  private async readPages(): Promise<void> {
    if (!this.page || !this.config) return;

    this.emitState("reading");
    this.emitLog("info", "Iniciando leitura automática...");

    // Detectar total de páginas no início
    await this.sleep(2000);
    this.totalPages = await this.getTotalPages();
    
    if (this.totalPages) {
      this.emitLog("success", `📖 Total de páginas do livro: ${this.totalPages} páginas`);
      this.emitLog("info", `⏱️ Tempo estimado de leitura: ${Math.ceil((this.totalPages * this.config.interval) / 60)} minutos`);
    } else {
      this.emitLog("warning", "Não foi possível detectar o total de páginas. Continuando leitura...");
    }

    this.emitLog("info", `Intervalo entre páginas: ${this.config.interval} segundos (${(this.config.interval / 60).toFixed(1)} minutos)`);
    this.emitProgress();

    while (!this.shouldStop) {
      while (this.isPaused && !this.shouldStop) {
        await this.sleep(100);
      }

      if (this.shouldStop) break;

      try {
        const nextButton = await this.page.$("[data-testid='next-page-button']");
        
        if (!nextButton) {
          const altSelectors = [
            ".next-page",
            ".page-next",
            "[aria-label='Next page']",
            "[aria-label='Próxima página']",
            "button.next",
            ".reader-next",
          ];

          let found = false;
          for (const selector of altSelectors) {
            const altButton = await this.page.$(selector);
            if (altButton) {
              await altButton.click().catch(() => {});
              found = true;
              break;
            }
          }

          if (!found) {
            this.emitLog("success", "Fim do livro alcançado!");
            this.emitCompleted();
            this.emitState("completed");
            break;
          }
        } else {
          const isDisabled = await nextButton.evaluate(el => {
            return (el as HTMLButtonElement).disabled || 
                   el.getAttribute("aria-disabled") === "true" ||
                   el.classList.contains("disabled");
          });

          if (isDisabled) {
            this.emitLog("success", "Fim do livro alcançado!");
            this.emitCompleted();
            this.emitState("completed");
            break;
          }

          await nextButton.click().catch(async () => {
            if (this.page) {
              await this.page.evaluate((btn) => {
                (btn as HTMLElement).click();
              }, nextButton);
            }
          });
        }

        this.currentPage++;
        this.emitProgress();

        if (!this.totalPages) {
          const newTotal = await this.getTotalPages();
          if (newTotal && newTotal !== this.totalPages) {
            this.totalPages = newTotal;
            this.emitLog("info", `Total de páginas detectado: ${newTotal}`);
            this.emitProgress();
          }
        }

        if (this.totalPages && this.currentPage >= this.totalPages) {
          this.emitLog("success", "Todas as páginas foram lidas!");
          this.emitCompleted();
          this.emitState("completed");
          break;
        }

        await this.sleep(this.config.interval * 1000);

      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao virar página";
        this.emitLog("error", `Erro: ${message}`);
        
        await this.sleep(1000);
      }
    }

    if (this.shouldStop) {
      this.emitLog("warning", "Automação interrompida pelo usuário");
      this.emitState("idle");
    }

    this.emitLog("info", `Total de páginas viradas: ${this.currentPage}`);
  }

  pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.lastPauseStart = Date.now();
      this.emitState("paused");
      this.emitLog("info", "Automação pausada");
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.pausedTime += Date.now() - this.lastPauseStart;
      this.emitState("reading");
      this.emitLog("info", "Automação retomada");
    }
  }

  async stop(): Promise<void> {
    this.shouldStop = true;
    this.isPaused = false;
    this.emitLog("warning", "Parando automação...");
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
      this.page = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
