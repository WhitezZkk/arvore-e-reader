import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, BookOpen, Search, RefreshCw, User, Lock, Eye, EyeOff } from "lucide-react";
import type { AvailableBook, BookCategory } from "@shared/schema";

interface BookBrowserProps {
  onSelectBook: (book: AvailableBook) => void;
  defaultRa?: string;
  defaultPassword?: string;
}

export function BookBrowser({ onSelectBook, defaultRa = "", defaultPassword = "" }: BookBrowserProps) {
  const [ra, setRa] = useState(defaultRa);
  const [password, setPassword] = useState(defaultPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchBooks = async () => {
    if (!ra || !password) {
      setError("Preencha o RA e a senha para buscar os livros");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/books/browse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ra, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao buscar livros");
      }

      setCategories(data.categories || []);
      setSearched(true);

      if (data.categories.length === 0) {
        setError("Nenhum livro encontrado. Verifique suas credenciais.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar livros");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const totalBooks = categories.reduce((acc, cat) => acc + cat.books.length, 0);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <BookOpen className="h-5 w-5" />
          Livros Disponíveis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="RA (ex: 00001152877136sp)"
              value={ra}
              onChange={(e) => setRa(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button onClick={fetchBooks} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando livros...
              </>
            ) : searched ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Livros
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Buscar Livros
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        {searched && categories.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {totalBooks} livros encontrados em {categories.length} categorias
          </div>
        )}

        <ScrollArea className="h-[500px]">
          <div className="space-y-6 pr-4">
            {categories.map((category, catIndex) => (
              <div key={catIndex} className="space-y-3">
                <h3 className="text-sm font-semibold text-primary sticky top-0 bg-background py-2">
                  {category.name}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {category.books.map((book, bookIndex) => (
                    <button
                      key={book.id || bookIndex}
                      onClick={() => onSelectBook(book)}
                      className="group relative flex flex-col items-center p-2 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-all duration-200"
                    >
                      <div className="relative w-full aspect-[3/4] rounded-md overflow-hidden bg-muted mb-2">
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-xs font-medium bg-primary text-primary-foreground px-2 py-1 rounded transition-opacity">
                            Selecionar
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-center line-clamp-2 font-medium leading-tight">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-xs text-muted-foreground text-center line-clamp-1 mt-1">
                          {book.author}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {!loading && !searched && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Digite seu RA e senha para ver os livros disponíveis</p>
          </div>
        )}

        {!loading && searched && categories.length === 0 && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum livro encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
