import puppeteer, { Browser, Page } from "puppeteer-core";
import type { AvailableBook, BookCategory } from "@shared/schema";

export class BookBrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  private parseRA(raFull: string): { ra: string; digito: string; uf: string } {
    const raClean = raFull.trim().toLowerCase();
    const ufMatch = raClean.match(/([a-z]{2})$/);
    const uf = ufMatch ? ufMatch[1].toUpperCase() : "SP";
    const numbersOnly = raClean.replace(/[a-z]/g, "");
    const ra = numbersOnly.slice(0, -1);
    const digito = numbersOnly.slice(-1);
    return { ra, digito, uf };
  }

  async fetchBooks(ra: string, password: string): Promise<BookCategory[]> {
    try {
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
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920,1080",
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });

      await this.login(ra, password);
      
      await this.navigateToLeiasp();
      
      const categories = await this.scrapeBooks();
      
      return categories;
    } catch (error) {
      console.error("Error fetching books:", error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async login(ra: string, password: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    await this.page.goto("https://saladofuturo.educacao.sp.gov.br/login-alunos", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await this.sleep(2000);

    const { ra: raNumber, digito, uf } = this.parseRA(ra);

    const allInputs = await this.page.$$("input[type='text'], input[type='number'], input:not([type='password']):not([type='hidden']):not([type='submit'])");
    
    let raInput = null;
    for (const input of allInputs) {
      const placeholder = await input.evaluate(el => el.getAttribute("placeholder") || "");
      const isVisible = await input.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null;
      });
      
      if (!isVisible) continue;
      
      if (placeholder.includes("186735683") || placeholder.includes("Ex.:")) {
        raInput = input;
        break;
      }
    }

    if (!raInput && allInputs.length > 0) {
      for (const input of allInputs) {
        const isVisible = await input.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null;
        });
        if (isVisible) {
          raInput = input;
          break;
        }
      }
    }

    if (!raInput) throw new Error("Campo RA não encontrado");

    await raInput.click();
    await this.sleep(200);
    await raInput.type(raNumber, { delay: 30 });

    const digitoInputs = await this.page.$$("input[type='text'], input[type='number'], input:not([type='password']):not([type='hidden'])");
    let digitoInput = null;
    
    for (const input of digitoInputs) {
      const placeholder = await input.evaluate(el => el.getAttribute("placeholder") || "");
      const value = await input.evaluate(el => (el as HTMLInputElement).value || "");
      
      if ((placeholder === "0" || placeholder.toLowerCase().includes("dígito") || placeholder.toLowerCase().includes("digito")) && value === "") {
        digitoInput = input;
        break;
      }
    }

    if (!digitoInput) {
      for (let i = 0; i < digitoInputs.length; i++) {
        const value = await digitoInputs[i].evaluate(el => (el as HTMLInputElement).value || "");
        if (value === "" && digitoInputs[i] !== raInput) {
          digitoInput = digitoInputs[i];
          break;
        }
      }
    }

    if (digitoInput) {
      await digitoInput.click();
      await this.sleep(200);
      await digitoInput.type(digito, { delay: 30 });
    }

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
      try {
        await this.page.select(ufSelect as any, uf);
        console.log(`UF ${uf} selecionado via select nativo`);
      } catch {
        console.log("Falha ao usar select nativo, tentando dropdown...");
      }
    }
    
    const ufDropdown = await this.page.$("[class*='select'], [class*='dropdown'], [class*='uf']");
    if (ufDropdown) {
      await ufDropdown.click();
      await this.sleep(500);
      
      const options = await this.page.$$("li, option, [role='option'], [class*='option']");
      for (const option of options) {
        const text = await option.evaluate(el => el.textContent?.trim().toUpperCase() || "");
        if (text === uf || text.includes(uf)) {
          await option.click();
          console.log(`UF ${uf} selecionado via dropdown`);
          break;
        }
      }
    }

    await this.sleep(500);

    const passwordInput = await this.page.$("input[type='password']");
    if (!passwordInput) throw new Error("Campo de senha não encontrado");

    await passwordInput.click();
    await this.sleep(200);
    await passwordInput.type(password, { delay: 30 });

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
      console.log("Navegação detectada após login");
    } catch {
      console.log("Timeout na navegação, verificando página...");
    }

    await this.sleep(2000);

    const currentUrl = this.page.url();
    console.log(`URL atual após login: ${currentUrl}`);
    
    const stillOnLoginPage = currentUrl.includes("login-alunos") || currentUrl.includes("login");
    
    if (stillOnLoginPage) {
      const pageText = await this.page.evaluate(() => document.body.innerText);
      if (pageText.includes("inválid") || pageText.includes("incorret") || 
          pageText.includes("Usuário não encontrado")) {
        throw new Error("Login falhou. Verifique suas credenciais.");
      }
    }
  }

  private async navigateToLeiasp(): Promise<void> {
    if (!this.page) return;

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
    ];

    let leiaspElement = null;

    for (const selector of leiaspSelectors) {
      try {
        leiaspElement = await this.page.$(selector);
        if (leiaspElement) break;
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
          break;
        }
      }
    }

    if (leiaspElement) {
      await leiaspElement.click();
      await this.sleep(3000);
      
      try {
        await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
      } catch {
        // Continue
      }
    }

    await this.sleep(3000);
  }

  private async scrapeBooks(): Promise<BookCategory[]> {
    if (!this.page) return [];

    const categories: BookCategory[] = [];

    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await this.sleep(1000);

    for (let i = 0; i < 5; i++) {
      await this.page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await this.sleep(500);
    }

    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await this.sleep(1000);

    const pageContent = await this.page.content();
    
    const categoryElements = await this.page.$$("h2, h3, [class*='title'], [class*='heading']");
    const processedCategories = new Set<string>();

    for (const categoryEl of categoryElements) {
      const categoryName = await categoryEl.evaluate(el => el.textContent?.trim() || "");
      
      if (!categoryName || 
          categoryName.length < 5 || 
          categoryName.length > 100 ||
          processedCategories.has(categoryName) ||
          !categoryName.includes("Leitura") && !categoryName.includes("Ano") && !categoryName.includes("Bimestre") && !categoryName.includes("Sugerida")) {
        continue;
      }

      processedCategories.add(categoryName);
      
      const books: AvailableBook[] = [];
      
      const bookCards = await this.page.$$("[class*='book'], [class*='card'], [class*='item'], a[href*='livro'], a[href*='book']");
      
      for (const card of bookCards) {
        try {
          const bookData = await card.evaluate(el => {
            const img = el.querySelector("img");
            const titleEl = el.querySelector("[class*='title'], h3, h4, p, span");
            const link = el.tagName === "A" ? el : el.querySelector("a");
            
            const coverUrl = img?.src || img?.getAttribute("data-src") || "";
            const title = titleEl?.textContent?.trim() || img?.alt || "";
            const href = (link as HTMLAnchorElement)?.href || "";
            
            let slug = "";
            if (href) {
              const match = href.match(/\/(?:livro|book|reader)\/([^/?]+)/);
              if (match) {
                slug = match[1];
              } else {
                const parts = href.split("/").filter(Boolean);
                slug = parts[parts.length - 1] || "";
              }
            }

            return { coverUrl, title, slug, href };
          });

          if (bookData.title && bookData.title.length > 2 && bookData.title.length < 200) {
            books.push({
              id: `book-${books.length}-${Date.now()}`,
              title: bookData.title,
              coverUrl: bookData.coverUrl,
              slug: bookData.slug || bookData.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
              category: categoryName,
            });
          }
        } catch {
          continue;
        }
      }

      if (books.length > 0) {
        categories.push({
          name: categoryName,
          books: books.slice(0, 20),
        });
      }
    }

    if (categories.length === 0) {
      const allBooks: AvailableBook[] = [];
      
      const bookElements = await this.page.$$("img[src*='cover'], img[src*='book'], img[alt], [class*='book'] img");
      
      for (const bookEl of bookElements) {
        try {
          const bookData = await bookEl.evaluate(el => {
            const img = el as HTMLImageElement;
            const parent = img.closest("a, [class*='book'], [class*='card'], [class*='item']");
            const titleEl = parent?.querySelector("[class*='title'], h3, h4, p") || img;
            
            return {
              coverUrl: img.src || "",
              title: (titleEl as HTMLElement)?.textContent?.trim() || img.alt || "",
              href: (parent as HTMLAnchorElement)?.href || "",
            };
          });

          if (bookData.title && bookData.coverUrl) {
            let slug = "";
            if (bookData.href) {
              const match = bookData.href.match(/\/(?:livro|book|reader)\/([^/?]+)/);
              if (match) slug = match[1];
            }

            allBooks.push({
              id: `book-${allBooks.length}-${Date.now()}`,
              title: bookData.title,
              coverUrl: bookData.coverUrl,
              slug: slug || bookData.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
              category: "Livros Disponíveis",
            });
          }
        } catch {
          continue;
        }
      }

      if (allBooks.length > 0) {
        categories.push({
          name: "Livros Disponíveis",
          books: allBooks.slice(0, 50),
        });
      }
    }

    return categories;
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore
      }
      this.browser = null;
      this.page = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
