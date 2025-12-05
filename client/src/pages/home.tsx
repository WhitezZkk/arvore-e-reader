import { useState, useCallback } from "react";
import { BookOpen, Library } from "lucide-react";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { ControlPanel } from "@/components/control-panel";
import { ProgressPanel } from "@/components/progress-panel";
import { ActivityLog } from "@/components/activity-log";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookBrowser } from "@/components/book-browser";
import { useAutomation } from "@/hooks/use-automation";
import { automationConfigSchema, type AutomationConfig, type AvailableBook } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const {
    session,
    isConnected,
    startAutomation,
    pauseAutomation,
    resumeAutomation,
    stopAutomation,
    resetSession,
  } = useAutomation();

  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [selectedBook, setSelectedBook] = useState<AvailableBook | null>(null);
  const [activeTab, setActiveTab] = useState("config");

  const handleConfigChange = useCallback((newConfig: AutomationConfig) => {
    setConfig(newConfig);
  }, []);

  const handleSelectBook = useCallback((book: AvailableBook) => {
    setSelectedBook(book);
    if (config) {
      setConfig({ ...config, bookSlug: book.slug });
    } else {
      setConfig({
        ra: "",
        password: "",
        bookSlug: book.slug,
        interval: 60,
      });
    }
    setActiveTab("config");
  }, [config]);

  const handleStart = useCallback(() => {
    if (config) {
      const result = automationConfigSchema.safeParse(config);
      if (result.success) {
        startAutomation(result.data);
      }
    }
  }, [config, startAutomation]);

  const isConfigValid = config !== null && automationConfigSchema.safeParse(config).success;
  const isIdle = session.state === "idle";
  const isCompleted = session.state === "completed";
  const isError = session.state === "error";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BookOpen className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight hidden sm:block">
                Automação Árvore E-Reader
              </h1>
              <h1 className="text-lg font-semibold tracking-tight sm:hidden">
                Árvore E-Reader
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge 
                isConnected={isConnected} 
                userRa={session.userRa}
              />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="config" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="books" className="flex items-center gap-2">
              <Library className="h-4 w-4" />
              Livros Disponíveis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-8">
            {selectedBook && (
              <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
                {selectedBook.coverUrl && (
                  <img
                    src={selectedBook.coverUrl}
                    alt={selectedBook.title}
                    className="w-12 h-16 object-cover rounded"
                  />
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Livro selecionado:</p>
                  <p className="font-medium">{selectedBook.title}</p>
                </div>
              </div>
            )}

            <section>
              <ConfigurationPanel
                onConfigChange={handleConfigChange}
                disabled={!isIdle && !isCompleted && !isError}
                defaultValues={config || session.config || undefined}
              />
            </section>

            <section className="py-2">
              <ControlPanel
                state={session.state}
                onStart={handleStart}
                onPause={pauseAutomation}
                onResume={resumeAutomation}
                onStop={stopAutomation}
                onReset={resetSession}
                isConfigValid={isConfigValid && isConnected}
              />
            </section>

            <section>
              <ProgressPanel
                progress={session.progress}
                state={session.state}
                bookTitle={session.bookTitle || selectedBook?.title}
              />
            </section>

            <section>
              <ActivityLog logs={session.logs} />
            </section>
          </TabsContent>

          <TabsContent value="books">
            <BookBrowser
              onSelectBook={handleSelectBook}
              defaultRa={config?.ra}
              defaultPassword={config?.password}
            />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t py-6 mt-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            Automação Árvore E-Reader v1.0
          </p>
        </div>
      </footer>
    </div>
  );
}
